// core/quests/crossChainQuest.js
import { createWalletLogger } from '../../utils/logger.js';
import ProgressService from '../progress/progress.js';
import workerManager from '../workers/workerManager.js';

/**
 * Service for handling cross-chain quests with multi-threading support
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
   * Run cross-chain quests for all wallets with multi-threading
   * @param {string[]} privateKeys - Array of private keys
   * @param {Object} options - Cross-chain options
   * @param {number} maxThreads - Maximum number of concurrent threads
   * @returns {Promise<void>}
   */
  async runForAll(privateKeys, options, maxThreads = 3) {
    this.logger.info(`Running cross-chain quests for ${privateKeys.length} wallets with max ${maxThreads} threads`);
    
    // Create tasks for wallets where each wallet is a separate task
    const walletTasks = [];
    
    for (let i = 0; i < privateKeys.length; i++) {
      walletTasks.push({
        privateKey: privateKeys[i],
        walletIndex: i
      });
    }
    
    // Process wallets in parallel based on maxThreads
    // We'll use our own batching here to ensure correct threading
    const batchSize = Math.min(maxThreads, walletTasks.length);
    let processedCount = 0;
    
    while (processedCount < walletTasks.length) {
      const batch = [];
      const currentBatchSize = Math.min(batchSize, walletTasks.length - processedCount);
      
      this.logger.info(`Processing wallet batch ${processedCount+1}-${processedCount+currentBatchSize} of ${walletTasks.length}`);
      
      // Start tasks in this batch concurrently
      for (let i = 0; i < currentBatchSize; i++) {
        const task = walletTasks[processedCount + i];
        batch.push(this.run(task.privateKey, task.walletIndex, options));
      }
      
      // Wait for all wallets in this batch to complete
      await Promise.all(batch);
      
      processedCount += currentBatchSize;
    }
    
    this.logger.info(`Completed cross-chain quests for all ${walletTasks.length} wallets`);
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
            // Note: We continue even if a quest fails due to the updated requirement
          }
        }
        
        if (allSuccess) {
          logger.info('Successfully processed all cross-chain quests');
        } else {
          logger.warn('Some cross-chain quests failed, but processing continued');
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
      const failedSteps = [];
      
      // Process each step in the path SEQUENTIALLY
      for (let i = 0; i < path.length - 1; i++) {
        // Get the source and destination chains
        const sourceChain = path[i];
        const destinationChain = path[i + 1];
        
        logger.info(`Processing transfer ${i+1}/${path.length-1}: ${sourceChain} → ${destinationChain}`);
        
        // Execute the transfer using worker
        const task = this.createCrossChainTask(
          sourceChain,
          destinationChain,
          privateKey,
          walletIndex,
          progressData,
          transferAmount,
          `${questName}-${i+1}/${path.length-1}`
        );
        
        // Run the task directly, not in a batch
        const result = await workerManager.runWorker(task.workerPath, task.workerData);
        
        if (!result.success) {
          allSuccess = false;
          failedSteps.push(`${i+1}: ${sourceChain} → ${destinationChain}`);
          logger.error(`Failed at transfer ${i+1}: ${sourceChain} → ${destinationChain}`);
          // We continue to the next step despite the failure
        }
      }
      
      // Update progress if all transfers were successful
      if (allSuccess) {
        logger.info(`Successfully completed cross-chain path: ${path.join(' → ')}`);
        
        // Update progress data
        const progressService = new ProgressService(walletIndex);
        await progressService.updateCrossChainQuest(questName, true);
        
        logger.info(`Successfully completed the '${questName}' quest!`);
      } else {
        if (failedSteps.length > 0) {
          logger.error(`Quest '${questName}' not completed due to failed steps: ${failedSteps.join(', ')}`);
          logger.info(`Continuing to next quest. You can retry this quest later.`);
        } else {
          logger.error(`Failed to complete the '${questName}' quest for unknown reasons`);
        }
      }
      
      return allSuccess;
      
    } catch (error) {
      logger.error(`Error executing cross-chain quest: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Create a cross-chain transfer task
   * @param {string} sourceChain - Source chain name
   * @param {string} destChain - Destination chain name
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @param {Object} progressData - Progress data
   * @param {string} amount - Transfer amount
   * @param {string} taskId - Task identifier
   * @returns {Object} Task object for worker manager
   */
  createCrossChainTask(sourceChain, destChain, privateKey, walletIndex, progressData, amount, taskId) {
    // Get receiver address for the destination chain
    const receiverAddress = progressData.addresses[destChain];
    
    // Choose transfer type from source to destination
    const transferType = `${sourceChain}_TO_${destChain}`;
    
    // Create unique worker ID
    const workerId = `cross-chain-${transferType}-${walletIndex}-${taskId}-${Date.now()}`;
    
    return {
      workerPath: 'transferWorker.js',
      workerData: {
        workerId,
        walletIndex,
        privateKey,
        sourceChain,
        destinationChain: destChain,
        receiverAddress,
        amount,
        config: this.config,
        transferType,
        updateProgress: false, // Cross-chain progress updated after all transfers complete
        isCrossChain: true
      }
    };
  }
}

export default CrossChainQuestService;