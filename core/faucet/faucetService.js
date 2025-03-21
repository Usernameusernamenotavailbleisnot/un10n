// core/faucet/faucetService.js
import { createWalletLogger } from '../../utils/logger.js';
import ProgressService from '../progress/progress.js';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { sleep } from '../../utils/common.js';

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service for handling faucet requests with multithreading support
 */
class FaucetService {
  /**
   * Create a new FaucetService
   * @param {Object} config - Application configuration
   */
  constructor(config) {
    this.config = config;
    this.logger = createWalletLogger();
    
    // Faucet configuration
    this.faucetEndpoint = 'https://graphql.union.build/v1/graphql';
    this.faucetSiteKeys = {
      'UNION': '0x4AAAAAAA-eVs5k0b8Q1dl5',
      'STARGAZE': '0x4AAAAAAA-eVs5k0b8Q1dl5' // Same sitekey for both
    };
    this.faucetReferrer = 'https://app.union.build/';
  }

  /**
   * Run faucet requests for all wallets with multithreading
   * @param {string[]} privateKeys - Array of private keys
   * @param {Object} options - Faucet options
   * @returns {Promise<void>}
   */
  async runForAll(privateKeys, options) {
    const walletCount = privateKeys.length;
    this.logger.info(`Running faucet requests for ${walletCount} wallets in parallel`);
    
    // Determine max concurrent threads
    const maxConcurrentThreads = options.threads || 3; // Default to 3 concurrent threads
    this.logger.info(`Using ${maxConcurrentThreads} concurrent threads`);
    
    // Process wallets in batches
    let processedCount = 0;
    
    while (processedCount < walletCount) {
      const batch = [];
      const batchSize = Math.min(maxConcurrentThreads, walletCount - processedCount);
      
      for (let i = 0; i < batchSize; i++) {
        const walletIndex = processedCount + i;
        batch.push(this.run(privateKeys[walletIndex], walletIndex, options));
      }
      
      // Wait for all workers in this batch to complete
      await Promise.all(batch);
      
      processedCount += batchSize;
      
      if (processedCount < walletCount) {
        this.logger.info(`Processed ${processedCount}/${walletCount} wallets. Continuing with next batch...`);
        await sleep(2000); // Small delay between batches
      }
    }
    
    this.logger.info(`Completed faucet requests for all ${walletCount} wallets`);
  }

  /**
   * Run faucet request for a single wallet using a worker thread
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @param {Object} options - Faucet options
   * @returns {Promise<boolean>} Success status
   */
  async run(privateKey, walletIndex, options = {}) {
    const logger = createWalletLogger(walletIndex);
    logger.info('Starting faucet request process in worker thread');
    
    const progressService = new ProgressService(walletIndex);
    const progressData = await progressService.readProgressData();
    
    const { faucet, maxAttempts, apiKey } = options;
    
    // Get the address for the selected chain
    const address = progressData.addresses[faucet];
    if (!address) {
      logger.error(`No ${faucet} address found for wallet ${walletIndex + 1}`);
      return false;
    }
    
    logger.info(`Requesting ${faucet} faucet for address ${address} using worker thread`);
    
    // Set up chain parameters based on the faucet
    const chainConfig = {
      'UNION': {
        chainId: 'union-testnet-9',
        denom: 'muno',
        endpoint: this.config.chains.UNION.rpcEndpoint
      },
      'STARGAZE': {
        chainId: 'elgafar-1',
        denom: 'ustars',
        endpoint: this.config.chains.STARGAZE.rpcEndpoint
      }
    }[faucet];
    
    if (!chainConfig) {
      logger.error(`Unsupported faucet: ${faucet}`);
      return false;
    }
    
    // Worker file path
    const workerPath = path.join(__dirname, 'faucetWorker.js');
    
    // Worker data
    const workerData = {
      walletIndex,
      workerId: `${faucet}-${walletIndex}`,
      apiKey,
      address,
      faucet,
      chainConfig,
      siteKey: this.faucetSiteKeys[faucet],
      faucetReferrer: this.faucetReferrer,
      faucetEndpoint: this.faucetEndpoint,
      maxAttempts
    };
    
    // Create and run worker
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Starting worker thread for wallet ${walletIndex + 1}`);
        
        const worker = new Worker(workerPath, { 
          workerData,
          // ES modules need to use specific type
          type: 'module'
        });
        
        // Handle messages from worker
        worker.on('message', (message) => {
          if (message.success) {
            logger.info(`Worker completed successfully for wallet ${walletIndex + 1}`);
            resolve(true);
          } else {
            logger.error(`Worker failed for wallet ${walletIndex + 1}: ${message.error}`);
            resolve(false);
          }
        });
        
        // Handle worker errors
        worker.on('error', (error) => {
          logger.error(`Worker error for wallet ${walletIndex + 1}: ${error.message}`);
          if (error.stack) {
            logger.error(`Stack trace: ${error.stack}`);
          }
          resolve(false);
        });
        
        // Handle worker exit
        worker.on('exit', (code) => {
          if (code !== 0) {
            logger.error(`Worker for wallet ${walletIndex + 1} exited with code ${code}`);
            resolve(false);
          }
        });
      } catch (error) {
        logger.error(`Error creating worker for wallet ${walletIndex + 1}: ${error.message}`);
        if (error.stack) {
          logger.error(`Stack trace: ${error.stack}`);
        }
        resolve(false);
      }
    });
  }
}

export default FaucetService;