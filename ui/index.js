import { 
    promptForCommand, 
    promptForWallet, 
    promptForChain, 
    promptForTransferCount, 
    promptForCrossChainQuest, 
    promptForAmount,
    promptForConfirmation
  } from './prompts.js';
  import { 
    displayBanner, 
    displayMessage, 
    displayProgress, 
    createSpinner, 
    displaySectionHeader, 
    displayAddresses 
  } from './screens.js';
  import { readPrivateKeys } from '../core/blockchain/wallet.js';
  import ProgressService from '../core/progress/progress.js';
  import logger from '../utils/logger.js';
  
  /**
   * Run the interactive UI
   * @param {Object} services - Core services
   * @param {Object} config - Application configuration
   */
  async function runInteractiveUI(services, config) {
    displayBanner();
    
    // Get private keys
    const privateKeys = await readPrivateKeys();
    
    if (privateKeys.length === 0) {
      displayMessage('No private keys found. Please add keys to pk.txt', 'error');
      return;
    }
    
    displayMessage(`Found ${privateKeys.length} wallet(s). Welcome to Union Quest Bot!`, 'info');
    
    // Main application loop
    while (true) {
      try {
        // Prompt for command
        const { command } = await promptForCommand();
        
        if (command === 'exit') {
          displayMessage('Goodbye!', 'info');
          process.exit(0);
        }
        
        // Handle the selected command
        switch (command) {
          case 'daily':
            await handleDailyCommand(services.daily, privateKeys);
            break;
          case 'transfer':
            await handleTransferCommand(services.transfer, privateKeys, config);
            break;
          case 'cross-chain':
            await handleCrossChainCommand(services.crossChain, privateKeys, config);
            break;
          case 'full':
            await handleFullCommand(services, privateKeys);
            break;
          case 'progress':
            await handleProgressCommand(privateKeys);
            break;
        }
      } catch (error) {
        logger.error(`Error in UI: ${error.message}`);
        displayMessage(`Error: ${error.message}`, 'error');
      }
    }
  }
  
  /**
   * Handle the daily command
   * @param {Object} dailyService - Daily interaction service
   * @param {string[]} privateKeys - Array of private keys
   */
  async function handleDailyCommand(dailyService, privateKeys) {
    displaySectionHeader('Daily Interactions');
    
    // Prompt for wallet selection
    const { walletIndex } = await promptForWallet(privateKeys.length);
    
    // Create spinner
    const spinner = createSpinner('Initializing daily interactions');
    spinner.start();
    
    try {
      if (walletIndex === 'all') {
        // Process all wallets
        spinner.text = 'Running daily interactions for all wallets';
        await dailyService.runForAll(privateKeys);
      } else {
        // Process only the specified wallet
        spinner.text = `Running daily interactions for wallet ${walletIndex + 1}`;
        await dailyService.run(privateKeys[walletIndex], walletIndex);
      }
      
      spinner.succeed('Daily interactions completed successfully');
    } catch (error) {
      spinner.fail(`Error running daily interactions: ${error.message}`);
      logger.error(`Error running daily interactions: ${error.message}`);
    }
  }
  
  /**
   * Handle the transfer command
   * @param {Object} transferService - Transfer quest service
   * @param {string[]} privateKeys - Array of private keys
   * @param {Object} config - Application configuration
   */
  async function handleTransferCommand(transferService, privateKeys, config) {
    displaySectionHeader('Transfer Quests');
    
    // Prompt for wallet selection
    const { walletIndex } = await promptForWallet(privateKeys.length);
    
    // Prompt for chain selection
    const chains = ['UNION', 'BABYLON'];
    const { chain } = await promptForChain(chains);
    
    // Prompt for transfer count
    const { countOption, customCount } = await promptForTransferCount();
    
    // Determine the actual count to use
    const transferCount = countOption === 'custom' ? customCount : 
                          countOption === 'next' ? 'next' : 
                          countOption;
    
    // Prepare options
    const options = {
      chain: chain === 'all' ? null : chain,
      count: transferCount === 'next' ? null : transferCount,
      completeNext: transferCount === 'next'
    };
    
    // Display confirmation
    const chainDisplay = chain === 'all' ? 'all chains' : chain;
    const countDisplay = transferCount === 'next' ? 'transfers to complete next quest' : 
                         `${transferCount} transfer(s)`;
    
    const { confirmed } = await promptForConfirmation(
      `Run ${countDisplay} for ${chainDisplay}?`
    );
    
    if (!confirmed) {
      displayMessage('Operation cancelled', 'info');
      return;
    }
    
    // Create spinner
    const spinner = createSpinner('Initializing transfer quests');
    spinner.start();
    
    try {
      if (walletIndex === 'all') {
        // Process all wallets
        spinner.text = 'Running transfers for all wallets';
        await transferService.runForAll(privateKeys, options);
      } else {
        // Process only the specified wallet
        spinner.text = `Running transfers for wallet ${walletIndex + 1}`;
        await transferService.run(privateKeys[walletIndex], walletIndex, options);
      }
      
      spinner.succeed('Transfer quests completed successfully');
    } catch (error) {
      spinner.fail(`Error running transfer quests: ${error.message}`);
      logger.error(`Error running transfer quests: ${error.message}`);
    }
  }
  
  /**
   * Handle the cross-chain command
   * @param {Object} crossChainService - Cross-chain quest service
   * @param {string[]} privateKeys - Array of private keys
   * @param {Object} config - Application configuration
   */
  async function handleCrossChainCommand(crossChainService, privateKeys, config) {
    displaySectionHeader('Cross-Chain Quests');
    
    // Prompt for wallet selection
    const { walletIndex } = await promptForWallet(privateKeys.length);
    
    // Prompt for quest selection
    const { quest } = await promptForCrossChainQuest(config.quests.CROSS_CHAIN);
    
    // Prompt for amount if a specific quest is selected
    let amount = config.DEFAULT_TRANSFER_AMOUNT;
    
    if (quest !== 'all') {
      const { amountOption, customAmount } = await promptForAmount(config.DEFAULT_TRANSFER_AMOUNT);
      amount = amountOption === 'custom' ? customAmount : config.DEFAULT_TRANSFER_AMOUNT;
    }
    
    // Prepare options
    const options = {
      quest: quest === 'all' ? null : quest,
      amount,
      all: quest === 'all'
    };
    
    // Display confirmation
    const questDisplay = quest === 'all' ? 'all cross-chain quests' : quest;
    
    const { confirmed } = await promptForConfirmation(
      `Run ${questDisplay} with amount ${amount}?`
    );
    
    if (!confirmed) {
      displayMessage('Operation cancelled', 'info');
      return;
    }
    
    // Create spinner
    const spinner = createSpinner('Initializing cross-chain quests');
    spinner.start();
    
    try {
      if (walletIndex === 'all') {
        // Process all wallets
        spinner.text = 'Running cross-chain quests for all wallets';
        await crossChainService.runForAll(privateKeys, options);
      } else {
        // Process only the specified wallet
        spinner.text = `Running cross-chain quests for wallet ${walletIndex + 1}`;
        await crossChainService.run(privateKeys[walletIndex], walletIndex, options);
      }
      
      spinner.succeed('Cross-chain quests completed successfully');
    } catch (error) {
      spinner.fail(`Error running cross-chain quests: ${error.message}`);
      logger.error(`Error running cross-chain quests: ${error.message}`);
    }
  }
  
  /**
   * Handle the full command
   * @param {Object} services - All services
   * @param {string[]} privateKeys - Array of private keys
   */
  async function handleFullCommand(services, privateKeys) {
    displaySectionHeader('Full Automation');
    
    // Prompt for wallet selection
    const { walletIndex } = await promptForWallet(privateKeys.length);
    
    // Display confirmation
    const walletDisplay = walletIndex === 'all' ? 'all wallets' : `wallet ${walletIndex + 1}`;
    
    const { confirmed } = await promptForConfirmation(
      `Run full automation for ${walletDisplay}?`
    );
    
    if (!confirmed) {
      displayMessage('Operation cancelled', 'info');
      return;
    }
    
    // Create spinner
    const spinner = createSpinner('Initializing full automation');
    spinner.start();
    
    try {
      if (walletIndex === 'all') {
        // Process all wallets
        spinner.text = 'Running full automation for all wallets';
        
        for (let i = 0; i < privateKeys.length; i++) {
          spinner.text = `Running full automation for wallet ${i + 1}/${privateKeys.length}`;
          await runFullAutomation(services, privateKeys[i], i);
        }
      } else {
        // Process only the specified wallet
        spinner.text = `Running full automation for wallet ${walletIndex + 1}`;
        await runFullAutomation(services, privateKeys[walletIndex], walletIndex);
      }
      
      spinner.succeed('Full automation completed successfully');
    } catch (error) {
      spinner.fail(`Error running full automation: ${error.message}`);
      logger.error(`Error running full automation: ${error.message}`);
    }
  }
  
  /**
   * Run full automation for a single wallet
   * @param {Object} services - All services
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   */
  async function runFullAutomation(services, privateKey, walletIndex) {
    // 1. Run daily interactions
    await services.daily.run(privateKey, walletIndex);
    
    // 2. Run transfer quests
    await services.transfer.run(privateKey, walletIndex, { count: 1 });
    
    // 3. Run cross-chain quests
    await services.crossChain.run(privateKey, walletIndex, { all: true });
  }
  
  /**
   * Handle the progress command
   * @param {string[]} privateKeys - Array of private keys
   */
  async function handleProgressCommand(privateKeys) {
    displaySectionHeader('Progress');
    
    // Prompt for wallet selection
    const { walletIndex } = await promptForWallet(privateKeys.length, false);
    
    // Create spinner
    const spinner = createSpinner(`Loading progress for wallet ${walletIndex + 1}`);
    spinner.start();
    
    try {
      // Get progress data
      const progressService = new ProgressService(walletIndex);
      const progressData = await progressService.readProgressData();
      
      spinner.succeed(`Progress loaded for wallet ${walletIndex + 1}`);
      
      // Display progress data
      displayProgress(progressData);
      
      // Display addresses
      displayAddresses(progressData.addresses);
      
    } catch (error) {
      spinner.fail(`Error loading progress: ${error.message}`);
      logger.error(`Error loading progress: ${error.message}`);
    }
  }
  
  export {
    runInteractiveUI
  };