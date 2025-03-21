// core/quests/transferQuest.js
import { createWalletLogger } from '../../utils/logger.js';
import ProgressService from '../progress/progress.js';
import workerManager from '../workers/workerManager.js';

/**
 * Service for handling transfer quests with multi-threading support
 */
class TransferQuestService {
  /**
   * Create a new TransferQuestService
   * @param {Object} config - Application configuration
   */
  constructor(config) {
    this.config = config;
    this.logger = createWalletLogger();
  }

  /**
   * Run transfer quests for all wallets with multi-threading
   * @param {string[]} privateKeys - Array of private keys
   * @param {Object} options - Transfer options
   * @param {number} maxThreads - Maximum number of concurrent threads
   * @returns {Promise<void>}
   */
  async runForAll(privateKeys, options, maxThreads = 3) {
    this.logger.info(`Running transfer quests for ${privateKeys.length} wallets with max ${maxThreads} threads`);
    
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
    
    this.logger.info(`Completed transfer quests for all ${walletTasks.length} wallets`);
  }

  /**
   * Run transfer quests for a single wallet
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @param {Object} options - Transfer options
   * @returns {Promise<void>}
   */
  async run(privateKey, walletIndex, options = {}) {
    const logger = createWalletLogger(walletIndex);
    logger.info('Starting transfer quest processing');
    
    // Prepare tasks for this wallet
    const tasks = await this.prepareWalletTasks(privateKey, walletIndex, options);
    
    if (tasks.length === 0) {
      logger.info('No transfer tasks needed for this wallet');
      return;
    }
    
    // Process all tasks for this wallet SEQUENTIALLY
    // This ensures one wallet doesn't use multiple threads
    logger.info(`Prepared ${tasks.length} transfer tasks`);
    
    let successCount = 0;
    let failCount = 0;
    
    // Process each task one by one
    for (const task of tasks) {
      try {
        const result = await workerManager.runWorker(task.workerPath, task.workerData);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        logger.error(`Error running transfer task: ${error.message}`);
        failCount++;
      }
    }
    
    logger.info(`Completed ${successCount}/${tasks.length} transfers (${failCount} failed)`);
  }
  
  /**
   * Prepare transfer tasks for a wallet
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @param {Object} options - Transfer options
   * @returns {Promise<Array>} Array of task objects
   */
  async prepareWalletTasks(privateKey, walletIndex, options = {}) {
    const logger = createWalletLogger(walletIndex);
    const progressService = new ProgressService(walletIndex);
    const progressData = await progressService.readProgressData();
    
    // Determine which chain(s) to process
    const chainsToProcess = [];
    
    if (options.chain) {
      // Process specific chain if provided
      chainsToProcess.push(options.chain);
    } else {
      // Process both chains by default
      chainsToProcess.push('UNION', 'BABYLON');
    }
    
    // Prepare tasks for each chain
    const tasks = [];
    
    for (const destChain of chainsToProcess) {
      const currentCount = progressData.transfers[destChain].count;
      
      let transfersToPerform = 0;
      
      if (options.count) {
        // Use specified count if provided
        transfersToPerform = parseInt(options.count);
      } else if (options.completeNext) {
        // Calculate transfers needed to complete next quest
        transfersToPerform = this.determineTransfersNeeded(destChain, currentCount);
      } else {
        // Default to 1 transfer if no options specified
        transfersToPerform = 1;
      }
      
      if (transfersToPerform > 0) {
        // Get a suitable source chain for this destination
        const sourceChain = this.getSuitableSourceChain(destChain, progressData);
        
        logger.info(`Will perform ${transfersToPerform} transfers from ${sourceChain} TO ${destChain}`);
        
        // Create tasks for each transfer
        for (let i = 0; i < transfersToPerform; i++) {
          const task = this.createTransferTask(
            sourceChain,
            destChain,
            privateKey,
            walletIndex,
            progressData,
            `${i+1}/${transfersToPerform}`
          );
          
          tasks.push(task);
        }
      } else {
        logger.info(`No transfers needed for ${destChain} or all quests completed`);
      }
    }
    
    return tasks;
  }
  
  /**
   * Determine number of transfers needed to complete next quest
   * @param {string} chain - Chain name
   * @param {number} currentCount - Current number of transfers
   * @returns {number} Number of transfers needed
   */
  determineTransfersNeeded(chain, currentCount) {
    const quests = this.config.quests.TRANSFER[chain];
    
    // Find the next quest that hasn't been completed
    for (let i = 0; i < quests.length; i++) {
      const quest = quests[i];
      if (currentCount < quest.count) {
        // Return the difference needed to complete this quest
        return quest.count - currentCount;
      }
    }
    
    // If all quests are complete, return 0
    return 0;
  }
  
  /**
   * Get a suitable source chain for the destination chain
   * @param {string} destChain - Destination chain
   * @param {Object} progressData - Progress data with addresses
   * @returns {string} Source chain name
   */
  getSuitableSourceChain(destChain, progressData) {
    // Special routing rules based on destination
    if (destChain === 'UNION') {
      // For transfers to UNION, prefer using STARGAZE as source
      if (progressData.addresses['STARGAZE']) {
        return 'STARGAZE';
      }
    } else if (destChain === 'BABYLON') {
      // For transfers to BABYLON, prefer using UNION as source
      if (progressData.addresses['UNION']) {
        return 'UNION';
      }
    }
    
    // Available chains besides the destination
    const availableChains = Object.keys(this.config.chains).filter(chain => 
      chain !== destChain && progressData.addresses[chain]
    );
    
    if (availableChains.length === 0) {
      throw new Error(`No suitable source chain found for transfers to ${destChain}`);
    }
    
    // General preferences for source chains
    if (availableChains.includes('STARGAZE')) {
      return 'STARGAZE';
    } else if (availableChains.includes('STRIDE')) {
      return 'STRIDE';
    } else if (availableChains.includes('UNION')) {
      return 'UNION';
    }
    
    // Otherwise just use the first available chain
    return availableChains[0];
  }
  
  /**
   * Create a transfer task
   * @param {string} sourceChain - Source chain name
   * @param {string} destChain - Destination chain name
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @param {Object} progressData - Progress data
   * @param {string} index - Task index for logging (e.g., "1/5")
   * @returns {Object} Task object for worker manager
   */
  createTransferTask(sourceChain, destChain, privateKey, walletIndex, progressData, index) {
    // Get receiver address for the destination chain
    const receiverAddress = progressData.addresses[destChain];
    
    // Choose transfer type from source to destination
    const transferType = `${sourceChain}_TO_${destChain}`;
    
    // Create unique worker ID
    const workerId = `transfer-${transferType}-${walletIndex}-${index}-${Date.now()}`;
    
    return {
      workerPath: 'transferWorker.js',
      workerData: {
        workerId,
        walletIndex,
        privateKey,
        sourceChain,
        destinationChain: destChain,
        receiverAddress,
        amount: this.config.DEFAULT_TRANSFER_AMOUNT,
        config: this.config,
        transferType,
        updateProgress: true,
        isDaily: false
      }
    };
  }
}

export default TransferQuestService;