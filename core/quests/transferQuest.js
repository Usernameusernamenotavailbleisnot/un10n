import { createWalletLogger } from '../../utils/logger.js';
import ProgressService from '../progress/progress.js';
import TransferFactory from '../blockchain/transfers/transferFactory.js';
import { sleep } from '../../utils/common.js';

/**
 * Service for handling transfer quests
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
   * Run transfer quests for all wallets
   * @param {string[]} privateKeys - Array of private keys
   * @param {Object} options - Transfer options
   * @returns {Promise<void>}
   */
  async runForAll(privateKeys, options) {
    this.logger.info(`Running transfer quests for ${privateKeys.length} wallets`);
    
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
   * Run transfer quests for a single wallet
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @param {Object} options - Transfer options
   * @returns {Promise<void>}
   */
  async run(privateKey, walletIndex, options = {}) {
    const logger = createWalletLogger(walletIndex);
    logger.info('Starting transfer quest processing');
    
    const progressService = new ProgressService(walletIndex);
    
    // Read progress data
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
    
    // Process each chain
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
        logger.info(`Will perform ${transfersToPerform} transfers TO ${destChain}`);
        
        // Perform the transfers
        const result = await this.performTransfers(
          destChain, 
          transfersToPerform, 
          progressData, 
          privateKey, 
          walletIndex
        );
        
        if (result.successCount > 0) {
          logger.info(`Successfully performed ${result.successCount} transfers TO ${destChain}`);
        }
        
        if (result.failCount > 0) {
          logger.error(`${result.failCount} transfers TO ${destChain} failed`);
        }
      } else {
        logger.info(`No transfers needed for ${destChain} or all quests completed`);
      }
    }
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
    // Available chains besides the destination
    const availableChains = Object.keys(this.config.chains).filter(chain => 
      chain !== destChain && progressData.addresses[chain]
    );
    
    if (availableChains.length === 0) {
      throw new Error(`No suitable source chain found for transfers to ${destChain}`);
    }
    
    // Prefer STARGAZE or STRIDE for source if available
    if (availableChains.includes('STARGAZE')) {
      return 'STARGAZE';
    } else if (availableChains.includes('STRIDE')) {
      return 'STRIDE';
    }
    
    // Otherwise just use the first available chain
    return availableChains[0];
  }
  
  /**
   * Perform a series of transfers
   * @param {string} destChain - Destination chain
   * @param {number} count - Number of transfers to perform
   * @param {Object} progressData - Progress data
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @returns {Promise<{successCount: number, failCount: number}>} Transfer results
   */
  async performTransfers(destChain, count, progressData, privateKey, walletIndex) {
    const logger = createWalletLogger(walletIndex);
    
    try {
      logger.info(`Performing ${count} transfers TO ${destChain}`);
      
      let successCount = 0;
      let failCount = 0;
      
      // Get a suitable source chain for this destination
      const sourceChain = this.getSuitableSourceChain(destChain, progressData);
      logger.info(`Using ${sourceChain} as source chain for transfers to ${destChain}`);
      
      // Choose transfer type from source to destination
      const transferType = `${sourceChain}_TO_${destChain}`;
      
      // Get receiver address for the destination chain
      const receiverAddress = progressData.addresses[destChain];
      if (!receiverAddress) {
        logger.error(`Missing address for ${destChain}`);
        return { successCount: 0, failCount: count };
      }
      
      // Create transfer handler
      try {
        const transferFactory = new TransferFactory(this.config, walletIndex, privateKey);
        const transfer = transferFactory.createTransfer(transferType);
        
        // Perform transfers
        for (let i = 0; i < count; i++) {
          try {
            logger.info(`Processing transfer ${i+1}/${count} from ${sourceChain} to ${destChain}`);
            
            // Execute transfer
            const result = await transfer.transfer(
              receiverAddress,
              this.config.DEFAULT_TRANSFER_AMOUNT
            );
            
            // Check if transfer was successful
            if (result && (result.success || result.inMempool || result.pending)) {
              successCount++;
              
              // Update progress
              const progressService = new ProgressService(walletIndex);
              await progressService.updateTransferCount(destChain);
              
              logger.info(`Transfer ${i+1} successful`);
            } else {
              failCount++;
              logger.error(`Transfer ${i+1} failed`);
            }
            
            // Wait between transfers to avoid rate limiting
            if (i < count - 1) {
              logger.info('Waiting for 5 seconds before next transfer...');
              await sleep(5000);
            }
          } catch (error) {
            failCount++;
            logger.error(`Transfer ${i+1} failed: ${error.message}`);
          }
        }
      } catch (error) {
        logger.error(`Error creating transfer handler: ${error.message}`);
        failCount = count;
      }
      
      return { successCount, failCount };
    } catch (error) {
      logger.error(`Error performing transfers TO ${destChain}: ${error.message}`);
      return { successCount: 0, failCount: count };
    }
  }
}

export default TransferQuestService;