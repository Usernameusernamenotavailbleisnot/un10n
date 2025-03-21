import { createWalletLogger } from '../../utils/logger.js';
import ProgressService from '../progress/progress.js';
import TransferFactory from '../blockchain/transfers/transferFactory.js';
import { sleep } from '../../utils/common.js';

/**
 * Service for handling daily interaction quests
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
   * Run daily interaction for all wallets
   * @param {string[]} privateKeys - Array of private keys
   * @returns {Promise<void>}
   */
  async runForAll(privateKeys) {
    this.logger.info(`Running daily interactions for ${privateKeys.length} wallets`);
    
    for (let i = 0; i < privateKeys.length; i++) {
      try {
        await this.run(privateKeys[i], i);
        
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
   * Run daily interaction for a single wallet
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @returns {Promise<void>}
   */
  async run(privateKey, walletIndex) {
    const logger = createWalletLogger(walletIndex);
    logger.info('Starting daily interaction checks');
    
    const progressService = new ProgressService(walletIndex);
    
    // Read progress data
    const progressData = await progressService.readProgressData();
    
    // Get current date
    const today = new Date().toISOString().split('T')[0];
    
    // Perform interactions for each chain
    await this.performInteraction('UNION', today, progressData, privateKey, walletIndex);
    await this.performInteraction('BABYLON', today, progressData, privateKey, walletIndex);
    
    logger.info('Daily interactions completed');
  }
  
  /**
   * Perform daily interaction for a specific chain
   * @param {string} chain - Chain name (UNION or BABYLON)
   * @param {string} today - Today's date in ISO format
   * @param {Object} progressData - Progress data
   * @param {string} privateKey - Private key
   * @param {number} walletIndex - Wallet index
   * @returns {Promise<void>}
   */
  async performInteraction(chain, today, progressData, privateKey, walletIndex) {
    const logger = createWalletLogger(walletIndex);
    
    try {
      const lastInteraction = progressData.dailyInteractions[chain].lastInteraction;
      
      if (lastInteraction === today) {
        logger.info(`${chain} daily interaction already done today`);
        return;
      }
      
      logger.info(`Performing daily interaction on ${chain}`);
      
      // Get appropriate transfer module
      let result;
      const minimalAmount = "0.000001";
      
      const transferFactory = new TransferFactory(this.config, walletIndex, privateKey);
      
      if (chain === 'UNION') {
        const transfer = transferFactory.createTransfer('UNION_TO_UNION');
        result = await transfer.transfer(progressData.addresses.UNION, minimalAmount);
      } else if (chain === 'BABYLON') {
        // TODO: Implement BABYLON_TO_BABYLON transfer
        logger.info(`${chain} transfers not yet implemented, skipping`);
        return;
      }
      
      if (result && result.success) {
        // Update progress
        const progressService = new ProgressService(walletIndex);
        await progressService.updateDailyInteraction(chain, today);
        
        logger.info(`${chain} daily interaction completed. Total days: ${progressData.dailyInteractions[chain].count + 1}`);
      } else {
        logger.error(`${chain} daily interaction failed`);
      }
    } catch (error) {
      logger.error(`Error in ${chain} daily interaction: ${error.message}`);
    }
  }
}

export default DailyInteractionService;