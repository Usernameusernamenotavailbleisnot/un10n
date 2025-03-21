import { sleep } from '../../../utils/common.js';
import { createWalletLogger } from '../../../utils/logger.js';
import TransferFactory from './transferFactory.js';

/**
 * Class for executing multi-hop transfers that require intermediate steps
 */
class MultiHopTransferService {
  /**
   * Create a new MultiHopTransferService instance
   * @param {Object} config - Configuration object
   * @param {number} walletIndex - Wallet index
   * @param {string} privateKey - Private key
   */
  constructor(config, walletIndex, privateKey) {
    this.config = config;
    this.walletIndex = walletIndex;
    this.privateKey = privateKey;
    this.logger = createWalletLogger(walletIndex);
    this.transferFactory = new TransferFactory(config, walletIndex, privateKey);
  }
  
  /**
   * Execute a multi-hop transfer through Union as intermediary
   * @param {string} sourceChain - Source chain name
   * @param {string} destinationChain - Destination chain name
   * @param {string} receiverAddress - Final destination address
   * @param {string} amount - Amount to transfer
   * @param {Object} progressData - Progress data with addresses
   * @returns {Promise<Object|null>} Transfer result or null if failed
   */
  async executeViaUnion(sourceChain, destinationChain, receiverAddress, amount, progressData) {
    try {
      this.logger.info(`Executing multi-hop transfer from ${sourceChain} to ${destinationChain} via UNION`);
      
      // Use the Union address as an intermediary
      const unionIntermediaryAddress = progressData.addresses.UNION;
      
      if (!unionIntermediaryAddress) {
        this.logger.error('Missing UNION address for intermediary hop');
        return null;
      }
      
      // Step 1: Source -> Union
      this.logger.info(`Step 1: ${sourceChain} -> UNION`);
      const sourceToUnionType = this.transferFactory.getTransferType(sourceChain, 'UNION');
      const sourceToUnion = this.transferFactory.createTransfer(sourceToUnionType);
      
      // Execute first transfer
      const step1Result = await sourceToUnion.transfer(unionIntermediaryAddress, amount);
      
      if (!step1Result || !step1Result.success) {
        this.logger.error(`Failed at step 1: ${sourceChain} to UNION transfer`);
        return null;
      }
      
      // Wait for the transaction to be confirmed with a dynamic wait time based on source chain
      const waitTime = sourceChain === 'BABYLON' ? 15000 : 10000; // Babylon might need longer confirmation time
      this.logger.info(`Waiting for ${waitTime/1000} seconds to ensure transaction confirmation...`);
      await sleep(waitTime);
      
      // Step 2: Union -> Destination
      this.logger.info(`Step 2: UNION -> ${destinationChain}`);
      const unionToDestType = this.transferFactory.getTransferType('UNION', destinationChain);
      const unionToDest = this.transferFactory.createTransfer(unionToDestType);
      
      // Execute second transfer
      const step2Result = await unionToDest.transfer(receiverAddress, amount);
      
      if (!step2Result || !step2Result.success) {
        this.logger.error(`Failed at step 2: UNION to ${destinationChain} transfer`);
        return {
          success: false,
          step1: step1Result,
          step2: null,
          message: `Failed at step 2: UNION to ${destinationChain} transfer`
        };
      }
      
      this.logger.info(`Multi-hop transfer from ${sourceChain} to ${destinationChain} via UNION completed successfully`);
      
      return {
        success: true,
        step1: step1Result,
        step2: step2Result,
        message: "Multi-hop transfer successful"
      };
      
    } catch (error) {
      this.logger.error(`Error in multi-hop transfer: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Get a list of all available multi-hop transfers
   * @returns {Object} Map of source-destination pairs to transfer methods
   */
  getAvailableMultiHopTransfers() {
    return {
      'STRIDE_TO_STARGAZE': this.strideToStargaze.bind(this),
      'STARGAZE_TO_STRIDE': this.stargazeToStride.bind(this),
      'STRIDE_TO_BABYLON': this.strideToBabylon.bind(this),
      'BABYLON_TO_STRIDE': this.babylonToStride.bind(this),
      'STARGAZE_TO_BABYLON': this.stargazeToBabylon.bind(this),
      'BABYLON_TO_STARGAZE': this.babylonToStargaze.bind(this)
    };
  }
  
  // Multi-hop transfer implementations
  
  /**
   * Execute a Stride to Stargaze transfer via Union
   * @param {string} receiverAddress - Destination address
   * @param {string} amount - Amount to transfer
   * @param {Object} progressData - Progress data with addresses
   * @returns {Promise<Object|null>} Transfer result
   */
  async strideToStargaze(receiverAddress, amount, progressData) {
    return this.executeViaUnion('STRIDE', 'STARGAZE', receiverAddress, amount, progressData);
  }
  
  /**
   * Execute a Stargaze to Stride transfer via Union
   * @param {string} receiverAddress - Destination address
   * @param {string} amount - Amount to transfer
   * @param {Object} progressData - Progress data with addresses
   * @returns {Promise<Object|null>} Transfer result
   */
  async stargazeToStride(receiverAddress, amount, progressData) {
    return this.executeViaUnion('STARGAZE', 'STRIDE', receiverAddress, amount, progressData);
  }
  
  /**
   * Execute a Stride to Babylon transfer via Union
   * @param {string} receiverAddress - Destination address
   * @param {string} amount - Amount to transfer
   * @param {Object} progressData - Progress data with addresses
   * @returns {Promise<Object|null>} Transfer result
   */
  async strideToBabylon(receiverAddress, amount, progressData) {
    return this.executeViaUnion('STRIDE', 'BABYLON', receiverAddress, amount, progressData);
  }
  
  /**
   * Execute a Babylon to Stride transfer via Union
   * @param {string} receiverAddress - Destination address
   * @param {string} amount - Amount to transfer
   * @param {Object} progressData - Progress data with addresses
   * @returns {Promise<Object|null>} Transfer result
   */
  async babylonToStride(receiverAddress, amount, progressData) {
    return this.executeViaUnion('BABYLON', 'STRIDE', receiverAddress, amount, progressData);
  }
  
  /**
   * Execute a Stargaze to Babylon transfer via Union
   * @param {string} receiverAddress - Destination address
   * @param {string} amount - Amount to transfer
   * @param {Object} progressData - Progress data with addresses
   * @returns {Promise<Object|null>} Transfer result
   */
  async stargazeToBabylon(receiverAddress, amount, progressData) {
    return this.executeViaUnion('STARGAZE', 'BABYLON', receiverAddress, amount, progressData);
  }
  
  /**
   * Execute a Babylon to Stargaze transfer via Union
   * @param {string} receiverAddress - Destination address
   * @param {string} amount - Amount to transfer
   * @param {Object} progressData - Progress data with addresses
   * @returns {Promise<Object|null>} Transfer result
   */
  async babylonToStargaze(receiverAddress, amount, progressData) {
    return this.executeViaUnion('BABYLON', 'STARGAZE', receiverAddress, amount, progressData);
  }
}

export default MultiHopTransferService;