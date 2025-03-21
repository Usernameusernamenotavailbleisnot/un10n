import { createWalletLogger } from '../../utils/logger.js';
import ProgressService from '../progress/progress.js';
import TransferFactory from '../blockchain/transfers/transferFactory.js';
import { sleep } from '../../utils/common.js';

/**
 * Service for handling cross-chain quests
 */
class CrossChainQuestService {
  /**
   * Create a new CrossChainQuestService
   * @param {Object} config - Application configuration
   */
  constructor(config) {
    this.config = config;
    this.logger = createWalletLogger();
  }

  /**
   * Run cross-chain quests for all wallets
   * @param {string[]} privateKeys - Array of private keys
   * @param {Object} options - Cross-chain options
   * @returns {Promise<void>}
   */
  async runForAll(privateKeys, options) {
    this.logger.info(`Running cross-chain quests for ${privateKeys.length} wallets`);
    
    for (let i = 0; i < privateKeys.length; i++) {
      try {
        await this.run(privateKeys[i], i, options);
        
        // Add a small delay between wallets
        if (i < privateKeys.length - 1) {
          this.logger.info('Waiting 2 seconds before processing next wallet...');
          await sleep(2000);
        }
      } catch (error) {
        this.logger.error(`Failed to process wallet ${i+1}: ${error.message}`);
        // Continue with next wallet
      }
    }
  }

  /**
   * Run cross-chain quests for a single wallet
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @param {Object} options - Cross-chain options
   * @returns {Promise<void>}
   */
  async run(privateKey, walletIndex, options = {}) {
    const logger = createWalletLogger(walletIndex);
    logger.info('Starting cross-chain quest processing');
    
    const progressService = new ProgressService(walletIndex);
    
    // Read progress data
    const progressData = await progressService.readProgressData();
    
    try {
      const { quest, amount, all } = options;
      
      if (all) {
        // Execute all quests in order
        const quests = this.config.quests.CROSS_CHAIN;
        let allSuccess = true;
        
        for (const q of quests) {
          // Skip already completed quests
          if (progressData.crossChain[q.name].completed) {
            logger.info(`Quest ${q.name} already completed, skipping...`);
            continue;
          }
          
          logger.info(`Executing quest ${q.name}, path: ${q.path.join(' → ')}`);
          
          const success = await this.executeCrossChainQuest(
            q.name, 
            amount || this.config.DEFAULT_TRANSFER_AMOUNT, 
            progressData, 
            privateKey, 
            walletIndex
          );
          
          if (!success) {
            allSuccess = false;
            break;
          }
        }
        
        if (allSuccess) {
          logger.info('Successfully processed all cross-chain quests');
        }
      } else if (quest) {
        // Execute single specified quest
        await this.executeCrossChainQuest(
          quest, 
          amount || this.config.DEFAULT_TRANSFER_AMOUNT, 
          progressData, 
          privateKey, 
          walletIndex
        );
      } else {
        // No specific quest specified, provide info
        logger.info('No quest specified. Use quest option or all flag to run quests');
      }
    } catch (error) {
      logger.error(`Error running cross-chain quests: ${error.message}`);
    }
  }
  
  /**
   * Execute a specific cross-chain quest
   * @param {string} questName - Name of the quest
   * @param {string} amount - Amount to transfer
   * @param {Object} progressData - Progress data
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @returns {Promise<boolean>} Success status
   */
  async executeCrossChainQuest(questName, amount, progressData, privateKey, walletIndex) {
    const logger = createWalletLogger(walletIndex);
    
    try {
      logger.info(`Executing cross-chain quest: ${questName}`);
      
      // Get quest details
      const quest = this.config.quests.CROSS_CHAIN.find(q => q.name === questName);
      
      if (!quest) {
        logger.error(`Quest '${questName}' not found in configuration`);
        return false;
      }
      
      // Check if quest is already completed
      if (progressData.crossChain[questName] && progressData.crossChain[questName].completed) {
        logger.info(`The quest '${questName}' has already been completed`);
        return true;
      }
      
      // Execute the transfers along the path
      const path = quest.path;
      const transferAmount = amount;
      
      logger.info(`Processing cross-chain path: ${path.join(' → ')}`);
      
      let allSuccess = true;
      const transferFactory = new TransferFactory(this.config, walletIndex, privateKey);
      
      // Execute each transfer in the path
      for (let i = 0; i < path.length - 1; i++) {
        try {
          // Get the source and destination chains
          const sourceChain = path[i];
          const destinationChain = path[i + 1];
          
          logger.info(`Processing transfer ${i+1}/${path.length-1}: ${sourceChain} → ${destinationChain}`);
          
          // Get destination address
          const destinationAddress = progressData.addresses[destinationChain];
          
          if (!destinationAddress) {
            logger.error(`Missing address for ${destinationChain}`);
            allSuccess = false;
            break;
          }
          
          // Execute the transfer
          const transferType = `${sourceChain}_TO_${destinationChain}`;
          const transfer = transferFactory.createTransfer(transferType);
          
          const result = await transfer.transfer(destinationAddress, transferAmount);
          
          if (!result || !result.success) {
            allSuccess = false;
            logger.error(`Failed at transfer ${i+1}: ${sourceChain} → ${destinationChain}`);
            break;
          }
          
          // Wait before the next transfer
          if (i < path.length - 2) {
            logger.info('Waiting for 5 seconds before next transfer...');
            await sleep(5000);
          }
          
        } catch (error) {
          allSuccess = false;
          logger.error(`Error at transfer ${i+1}: ${error.message}`);
          break;
        }
      }
      
      if (allSuccess) {
        logger.info(`Successfully completed cross-chain path: ${path.join(' → ')}`);
        
        // Update progress data
        const progressService = new ProgressService(walletIndex);
        await progressService.updateCrossChainQuest(questName, true);
        
        logger.info(`Successfully completed the '${questName}' quest!`);
        return true;
      } else {
        logger.error(`Failed to complete the '${questName}' quest`);
        return false;
      }
      
    } catch (error) {
      logger.error(`Error executing cross-chain quest: ${error.message}`);
      return false;
    }
  }
}

export default CrossChainQuestService;