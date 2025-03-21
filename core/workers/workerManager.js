// core/workers/workerManager.js - A centralized manager for all worker threads
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWalletLogger } from '../../utils/logger.js';
import { sleep } from '../../utils/common.js';

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Centralized manager for worker threads with concurrency control
 */
class WorkerManager {
  /**
   * Create a new WorkerManager instance
   */
  constructor() {
    this.logger = createWalletLogger();
    this.activeWorkers = new Map(); // Track running workers
    this.maxConcurrentWorkers = 3; // Default limit
  }

  /**
   * Resolve worker path correctly regardless of where it's called from
   * @param {string} workerPath - Path to worker script
   * @returns {string} - Absolute path to worker
   */
  resolveWorkerPath(workerPath) {
    // Handle special cases for different workers
    if (workerPath === 'transferWorker.js') {
      return path.join(__dirname, 'transferWorker.js');
    } else if (workerPath === '../faucetWorker.js') {
      return path.join(__dirname, '..', 'faucet', 'faucetWorker.js');
    } else {
      // Default case - join with dirname
      return path.join(__dirname, workerPath);
    }
  }

  /**
   * Run a task using a worker thread
   * @param {string} workerPath - Path to worker script
   * @param {Object} workerData - Data to pass to worker
   * @returns {Promise<any>} - Result from worker
   */
  async runWorker(workerPath, workerData) {
    // Create full path to worker
    const fullWorkerPath = this.resolveWorkerPath(workerPath);
    
    // Create logger for this worker
    const logger = createWalletLogger(workerData.walletIndex);
    
    logger.info(`Starting worker: ${workerData.workerId || 'unknown'}`);
    
    return new Promise((resolve, reject) => {
      try {
        const worker = new Worker(fullWorkerPath, { 
          workerData,
          type: 'module' // ES modules need to use specific type
        });
        
        // Add to active workers
        this.activeWorkers.set(workerData.workerId, worker);
        
        // Handle messages from worker
        worker.on('message', (message) => {
          if (message.success) {
            logger.info(`Worker completed successfully: ${workerData.workerId}`);
            this.activeWorkers.delete(workerData.workerId);
            resolve(message.result || { success: true });
          } else {
            logger.error(`Worker failed: ${message.error}`);
            this.activeWorkers.delete(workerData.workerId);
            resolve({ success: false, error: message.error }); // We resolve with error data instead of rejecting to continue processing
          }
        });
        
        // Handle worker errors
        worker.on('error', (error) => {
          logger.error(`Worker error: ${error.message}`);
          if (error.stack) {
            logger.error(`Stack trace: ${error.stack}`);
          }
          this.activeWorkers.delete(workerData.workerId);
          resolve({ success: false, error: error.message }); // Resolve with error instead of rejecting
        });
        
        // Handle worker exit
        worker.on('exit', (code) => {
          if (code !== 0) {
            logger.error(`Worker exited with code ${code}`);
            resolve({ success: false, error: `Exited with code ${code}` });
          }
          this.activeWorkers.delete(workerData.workerId);
        });
      } catch (error) {
        logger.error(`Error creating worker: ${error.message}`);
        if (error.stack) {
          logger.error(`Stack trace: ${error.stack}`);
        }
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * Run multiple tasks in batches with limited concurrency
   * @param {Array<Object>} tasks - Array of task objects with workerPath and workerData
   * @param {number} maxConcurrent - Maximum concurrent workers
   * @returns {Promise<Array>} - Results from all workers
   */
  async runBatch(tasks, maxConcurrent = this.maxConcurrentWorkers) {
    const results = [];
    const batchSize = Math.min(maxConcurrent, tasks.length);
    let processedCount = 0;
    
    this.logger.info(`Processing ${tasks.length} tasks in batches of ${batchSize}`);
    
    while (processedCount < tasks.length) {
      const batch = [];
      const currentBatchSize = Math.min(batchSize, tasks.length - processedCount);
      
      for (let i = 0; i < currentBatchSize; i++) {
        const task = tasks[processedCount + i];
        batch.push(this.runWorker(task.workerPath, task.workerData));
      }
      
      // Wait for all workers in this batch to complete
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
      
      processedCount += currentBatchSize;
      
      if (processedCount < tasks.length) {
        this.logger.info(`Processed ${processedCount}/${tasks.length} tasks. Continuing with next batch...`);
        await sleep(2000); // Small delay between batches
      }
    }
    
    return results;
  }

  /**
   * Set maximum concurrent workers
   * @param {number} max - Max concurrent workers
   */
  setMaxConcurrentWorkers(max) {
    this.maxConcurrentWorkers = max;
  }

  /**
   * Get number of active workers
   * @returns {number} - Count of active workers
   */
  getActiveWorkerCount() {
    return this.activeWorkers.size;
  }
}

// Create singleton instance
const workerManager = new WorkerManager();

export default workerManager;