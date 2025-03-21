// core/faucet/faucetService.js
import { createWalletLogger } from '../../utils/logger.js';
import ProgressService from '../progress/progress.js';
import workerManager from '../workers/workerManager.js';
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
    
    // Prepare tasks for all wallets
    const tasks = [];
    
    for (let i = 0; i < walletCount; i++) {
      try {
        const task = await this.prepareFaucetTask(privateKeys[i], i, options);
        if (task) {
          tasks.push(task);
        }
      } catch (error) {
        this.logger.error(`Error preparing faucet task for wallet ${i+1}: ${error.message}`);
      }
    }
    
    if (tasks.length === 0) {
      this.logger.info('No faucet tasks to process');
      return;
    }
    
    // Process all tasks
    this.logger.info(`Prepared ${tasks.length} faucet tasks`);
    const results = await workerManager.runBatch(tasks, maxConcurrentThreads);
    
    // Process results
    const successCount = results.filter(r => r.success).length;
    this.logger.info(`Completed ${successCount}/${tasks.length} faucet requests`);
  }

  /**
   * Run faucet request for a single wallet
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @param {Object} options - Faucet options
   * @returns {Promise<boolean>} Success status
   */
  async run(privateKey, walletIndex, options = {}) {
    const logger = createWalletLogger(walletIndex);
    logger.info('Starting faucet request process');
    
    try {
      // Prepare faucet task
      const task = await this.prepareFaucetTask(privateKey, walletIndex, options);
      
      if (!task) {
        logger.warn('No faucet task to process');
        return false;
      }
      
      // Run the task
      const [result] = await workerManager.runBatch([task]);
      
      return result && result.success;
    } catch (error) {
      logger.error(`Error running faucet for wallet ${walletIndex + 1}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Prepare a faucet task for a wallet
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @param {Object} options - Faucet options
   * @returns {Promise<Object|null>} Task object or null if not applicable
   */
  async prepareFaucetTask(privateKey, walletIndex, options) {
    const logger = createWalletLogger(walletIndex);
    
    try {
      const progressService = new ProgressService(walletIndex);
      const progressData = await progressService.readProgressData();
      
      const { faucet, maxAttempts, apiKey } = options;
      
      // Get the address for the selected chain
      const address = progressData.addresses[faucet];
      if (!address) {
        logger.error(`No ${faucet} address found for wallet ${walletIndex + 1}`);
        return null;
      }
      
      logger.info(`Preparing ${faucet} faucet request for address ${address}`);
      
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
        return null;
      }
      
      // Create unique worker ID
      const workerId = `faucet-${faucet}-${walletIndex}-${Date.now()}`;
      
      // Worker data
      const workerData = {
        walletIndex,
        workerId,
        apiKey,
        address,
        faucet,
        chainConfig,
        siteKey: this.faucetSiteKeys[faucet],
        faucetReferrer: this.faucetReferrer,
        faucetEndpoint: this.faucetEndpoint,
        maxAttempts
      };
      
      return {
        workerPath: '../faucetWorker.js',
        workerData
      };
    } catch (error) {
      logger.error(`Error preparing faucet task: ${error.message}`);
      return null;
    }
  }
}

export default FaucetService;