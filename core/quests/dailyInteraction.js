// core/quests/dailyInteraction.js
import { createWalletLogger } from '../../utils/logger.js';
import ProgressService from '../progress/progress.js';
import workerManager from '../workers/workerManager.js';

/**
 * Service for handling daily interaction quests with multi-threading support
 */
class DailyInteractionService {
  /**
   * Create a new DailyInteractionService
   * @param {Object} config - Application configuration
   */
  constructor(config) {
    this.config = config;
    this.logger = createWalletLogger();
  }

  /**
   * Run daily interaction for all wallets with multi-threading
   * @param {string[]} privateKeys - Array of private keys
   * @param {number} maxThreads - Maximum number of concurrent threads
   * @returns {Promise<void>}
   */
  async runForAll(privateKeys, maxThreads = 3) {
    this.logger.info(`Running daily interactions for ${privateKeys.length} wallets with max ${maxThreads} threads`);
    
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
        batch.push(this.run(task.privateKey, task.walletIndex));
      }
      
      // Wait for all wallets in this batch to complete
      await Promise.all(batch);
      
      processedCount += currentBatchSize;
    }
    
    this.logger.info(`Completed daily interactions for all ${walletTasks.length} wallets`);
  }

  /**
   * Run daily interaction for a single wallet
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @returns {Promise<void>}
   */
  async run(privateKey, walletIndex) {
    const logger = createWalletLogger(walletIndex);
    logger.info('Starting daily interaction checks');
    
    // Prepare tasks for this wallet
    const tasks = await this.prepareWalletTasks(privateKey, walletIndex);
    
    if (tasks.length === 0) {
      logger.info('No daily interactions needed for this wallet');
      return;
    }
    
    // Run all tasks
    logger.info(`Prepared ${tasks.length} daily interaction tasks`);
    const results = await workerManager.runBatch(tasks);
    
    // Process results
    const successCount = results.filter(r => r.success).length;
    logger.info(`Completed ${successCount}/${tasks.length} daily interactions`);
  }
  
  /**
   * Prepare daily interaction tasks for a wallet
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @returns {Promise<Array>} Array of task objects
   */
  async prepareWalletTasks(privateKey, walletIndex) {
    const logger = createWalletLogger(walletIndex);
    const progressService = new ProgressService(walletIndex);
    const progressData = await progressService.readProgressData();
    
    // Get current date
    const today = new Date().toISOString().split('T')[0];
    
    // Check which chains need interaction today
    const tasks = [];
    
    // UNION daily interaction
    if (this.needsDailyInteraction('UNION', today, progressData)) {
      tasks.push(this.createDailyInteractionTask('UNION', privateKey, walletIndex, progressData, today));
      logger.info('Scheduled UNION daily interaction');
    }
    
    // BABYLON daily interaction
    if (this.needsDailyInteraction('BABYLON', today, progressData)) {
      tasks.push(this.createDailyInteractionTask('BABYLON', privateKey, walletIndex, progressData, today));
      logger.info('Scheduled BABYLON daily interaction');
    }
    
    return tasks;
  }
  
  /**
   * Check if a chain needs daily interaction
   * @param {string} chain - Chain name
   * @param {string} today - Today's date
   * @param {Object} progressData - Progress data
   * @returns {boolean} True if interaction is needed
   */
  needsDailyInteraction(chain, today, progressData) {
    const lastInteraction = progressData.dailyInteractions[chain].lastInteraction;
    return lastInteraction !== today && progressData.addresses[chain] !== null;
  }
  
  /**
   * Create a daily interaction task
   * @param {string} chain - Chain name
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @param {Object} progressData - Progress data
   * @param {string} today - Today's date
   * @returns {Object} Task object for worker manager
   */
  createDailyInteractionTask(chain, privateKey, walletIndex, progressData, today) {
    // Both UNION and BABYLON use self-transfers for daily interaction
    
    // Create minimal amount
    const minimalAmount = "0.000001";
    
    // Create unique worker ID
    const workerId = `daily-${chain}-${walletIndex}-${Date.now()}`;
    
    return {
      workerPath: 'transferWorker.js',
      workerData: {
        workerId,
        walletIndex,
        privateKey,
        sourceChain: chain,
        destinationChain: chain,
        receiverAddress: progressData.addresses[chain],
        amount: minimalAmount,
        config: this.config,
        transferType: `${chain}_TO_${chain}`,
        updateProgress: true,
        isDaily: true
      }
    };
  }
}

export default DailyInteractionService;