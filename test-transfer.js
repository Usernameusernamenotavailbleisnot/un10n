// test-transfer.js - Script to test specific transfers directly
import { readPrivateKeys, getAddressForChain } from './core/blockchain/wallet.js';
import logger from './utils/logger.js';
import config from './config/index.js';
import ProgressService from './core/progress/progress.js';
import TransferFactory from './core/blockchain/transfers/transferFactory.js';
import inquirer from 'inquirer';
import { displayBanner, displayMessage, createSpinner } from './ui/screens.js';

/**
 * Interactive test transfer utility
 * @returns {Promise<void>}
 */
async function interactiveTestTransfer() {
  displayBanner();
  
  try {
    // Read private keys
    const privateKeys = await readPrivateKeys();
    if (privateKeys.length === 0) {
      displayMessage('No private keys found. Please add keys to pk.txt', 'error');
      return;
    }
    
    // Get wallet selection
    const walletChoices = privateKeys.map((_, i) => ({ name: `Wallet ${i + 1}`, value: i }));
    const { walletIndex } = await inquirer.prompt([
      {
        type: 'list',
        name: 'walletIndex',
        message: 'Select a wallet:',
        choices: walletChoices
      }
    ]);
    
    const privateKey = privateKeys[walletIndex];
    
    // Get valid chains
    const validChains = Object.keys(config.chains);
    const chainChoices = validChains.map(chain => ({ name: chain, value: chain }));
    
    // Get source chain
    const { sourceChain } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sourceChain',
        message: 'Select source chain:',
        choices: chainChoices
      }
    ]);
    
    // Get destination chain
    const { destChain } = await inquirer.prompt([
      {
        type: 'list',
        name: 'destChain',
        message: 'Select destination chain:',
        choices: chainChoices
      }
    ]);
    
    // Get amount
    const { amount } = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount to transfer (or press Enter for default):',
        default: config.DEFAULT_TRANSFER_AMOUNT,
        validate: (input) => {
          const value = parseFloat(input);
          return !isNaN(value) && value > 0 ? true : 'Please enter a valid positive number';
        }
      }
    ]);
    
    // Get confirmation
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Confirm transfer of ${amount} from ${sourceChain} to ${destChain}?`,
        default: true
      }
    ]);
    
    if (!confirm) {
      displayMessage('Transfer cancelled', 'info');
      return;
    }
    
    // Create spinner
    const spinner = createSpinner(`Testing ${sourceChain} to ${destChain} transfer`);
    
    // Initialize progress service for the wallet
    const progressService = new ProgressService(walletIndex);
    const progressData = await progressService.readProgressData();
    
    // Ensure we have addresses
    if (!progressData.addresses[sourceChain] || !progressData.addresses[destChain]) {
      spinner.text = 'Deriving missing addresses...';
      
      if (!progressData.addresses[sourceChain]) {
        const sourceAddress = await getAddressForChain(
          privateKey, 
          config.chains[sourceChain].prefix, 
          walletIndex
        );
        await progressService.updateAddress(sourceChain, sourceAddress);
        logger.info(`Derived ${sourceChain} address: ${sourceAddress}`);
      }
      
      if (!progressData.addresses[destChain]) {
        const destAddress = await getAddressForChain(
          privateKey, 
          config.chains[destChain].prefix, 
          walletIndex
        );
        await progressService.updateAddress(destChain, destAddress);
        logger.info(`Derived ${destChain} address: ${destAddress}`);
      }
      
      // Reload progress data
      const updatedProgressData = await progressService.readProgressData();
      progressData.addresses = updatedProgressData.addresses;
    }
    
    // Log addresses
    logger.info(`${sourceChain} address: ${progressData.addresses[sourceChain]}`);
    logger.info(`${destChain} address: ${progressData.addresses[destChain]}`);
    
    // Create transfer factory
    const transferFactory = new TransferFactory(config, walletIndex, privateKey);
    
    // Get transfer type
    const transferType = transferFactory.getTransferType(sourceChain, destChain);
    logger.info(`Transfer type: ${transferType}`);
    
    try {
      // Create and execute transfer
      spinner.text = `Creating transfer handler for ${transferType}`;
      const transfer = transferFactory.createTransfer(transferType);
      
      // Execute transfer
      spinner.text = `Executing test transfer of ${amount} from ${sourceChain} to ${destChain}`;
      const result = await transfer.transfer(
        progressData.addresses[destChain],
        amount
      );
      
      if (result && result.success) {
        spinner.succeed(`Transfer successful: ${result.hash}`);
        
        // Update progress data if successful
        if (sourceChain === destChain) {
          await progressService.updateTransferCount(sourceChain);
          logger.info(`Updated ${sourceChain} transfer count`);
        }
      } else {
        spinner.fail('Transfer failed');
      }
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
      logger.error(`Error creating or executing transfer: ${error.message}`);
      if (error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
    }
    
  } catch (error) {
    logger.error(`Error testing transfer: ${error.message}`);
    if (error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
  }
}

// Run in interactive mode if no arguments provided
if (process.argv.length <= 2) {
  interactiveTestTransfer().catch(error => {
    logger.error(`Unhandled error: ${error.stack}`);
    process.exit(1);
  });
} else {
  // Handle command line arguments for backward compatibility
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && i + 1 < args.length) {
      options.sourceChain = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === '--dest' && i + 1 < args.length) {
      options.destChain = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === '--amount' && i + 1 < args.length) {
      options.amount = args[i + 1];
      i++;
    } else if (args[i] === '--wallet' && i + 1 < args.length) {
      options.walletIndex = args[i + 1];
      i++;
    }
  }
  
  // Run the test with command line arguments
  commandLineTestTransfer(options).catch(error => {
    logger.error(`Unhandled error: ${error.stack}`);
    process.exit(1);
  });
}

/**
 * Command line test transfer utility
 * @param {Object} options - Transfer options
 * @returns {Promise<void>}
 */
async function commandLineTestTransfer(options) {
  try {
    const { sourceChain, destChain, amount, walletIndex } = options;
    
    if (!sourceChain || !destChain) {
      logger.error('Source chain and destination chain must be specified.');
      console.log('Usage: npm run test-transfer -- --source UNION --dest STRIDE --amount 0.001 --wallet 1');
      return;
    }
    
    logger.info(`Testing ${sourceChain} to ${destChain} transfer`);
    
    // Read private keys
    const privateKeys = await readPrivateKeys();
    if (privateKeys.length === 0) {
      logger.error('No private keys found. Please add keys to pk.txt');
      return;
    }
    
    // Convert from 1-based (user) to 0-based (internal) indexing
    const walletIdx = walletIndex ? parseInt(walletIndex) - 1 : 0;
    if (walletIdx >= privateKeys.length || walletIdx < 0) {
      logger.error(`Wallet index ${walletIndex} is out of range. Valid range: 1-${privateKeys.length}`);
      return;
    }
    
    const privateKey = privateKeys[walletIdx];
    
    // Initialize progress service for the wallet
    const progressService = new ProgressService(walletIdx);
    const progressData = await progressService.readProgressData();
    
    // Verify source and destination chains are valid
    if (!config.chains[sourceChain]) {
      logger.error(`Invalid source chain: ${sourceChain}`);
      logger.info(`Valid chains: ${Object.keys(config.chains).join(', ')}`);
      return;
    }
    
    if (!config.chains[destChain]) {
      logger.error(`Invalid destination chain: ${destChain}`);
      logger.info(`Valid chains: ${Object.keys(config.chains).join(', ')}`);
      return;
    }
    
    // Ensure we have addresses
    if (!progressData.addresses[sourceChain] || !progressData.addresses[destChain]) {
      logger.info('Deriving missing addresses...');
      
      if (!progressData.addresses[sourceChain]) {
        const sourceAddress = await getAddressForChain(
          privateKey, 
          config.chains[sourceChain].prefix, 
          walletIdx
        );
        await progressService.updateAddress(sourceChain, sourceAddress);
        logger.info(`Derived ${sourceChain} address: ${sourceAddress}`);
      }
      
      if (!progressData.addresses[destChain]) {
        const destAddress = await getAddressForChain(
          privateKey, 
          config.chains[destChain].prefix, 
          walletIdx
        );
        await progressService.updateAddress(destChain, destAddress);
        logger.info(`Derived ${destChain} address: ${destAddress}`);
      }
      
      // Reload progress data
      const updatedProgressData = await progressService.readProgressData();
      progressData.addresses = updatedProgressData.addresses;
    }
    
    // Log addresses
    logger.info(`${sourceChain} address: ${progressData.addresses[sourceChain]}`);
    logger.info(`${destChain} address: ${progressData.addresses[destChain]}`);
    
    // Create transfer factory
    const transferFactory = new TransferFactory(config, walletIdx, privateKey);
    
    // Get transfer type
    const transferType = transferFactory.getTransferType(sourceChain, destChain);
    logger.info(`Transfer type: ${transferType}`);
    
    try {
      // Create and execute transfer
      const transfer = transferFactory.createTransfer(transferType);
      const transferAmount = amount || config.DEFAULT_TRANSFER_AMOUNT;
      
      // Execute transfer
      logger.info(`Starting test transfer of ${transferAmount} from ${sourceChain} to ${destChain}`);
      const result = await transfer.transfer(
        progressData.addresses[destChain],
        transferAmount
      );
      
      if (result && result.success) {
        logger.info(`Transfer successful: ${result.hash}`);
        
        // Update progress data if successful
        if (sourceChain === destChain) {
          await progressService.updateTransferCount(sourceChain);
          logger.info(`Updated ${sourceChain} transfer count`);
        }
      } else {
        logger.error('Transfer failed');
      }
    } catch (error) {
      logger.error(`Error creating or executing transfer: ${error.message}`);
      if (error.stack) {
        logger.error(`Stack trace: ${error.stack}`);
      }
    }
    
  } catch (error) {
    logger.error(`Error testing transfer: ${error.message}`);
    if (error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
  }
}