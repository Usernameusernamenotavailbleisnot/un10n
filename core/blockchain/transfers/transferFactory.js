import UnionToUnionTransfer from './unionToUnion.js';
import BabylonToBabylonTransfer from './babylonToBabylon.js';
import UnifiedIBCTransfer from './unifiedIBCTransfer.js';
import { createWalletLogger } from '../../../utils/logger.js';

/**
 * Factory class for creating appropriate transfer handlers
 */
class TransferFactory {
  /**
   * Create a new TransferFactory instance
   * @param {Object} config - Configuration object
   * @param {number} walletIndex - Wallet index
   * @param {string} privateKey - Private key
   */
  constructor(config, walletIndex, privateKey) {
    this.config = config;
    this.walletIndex = walletIndex;
    this.privateKey = privateKey;
    this.logger = createWalletLogger(walletIndex);
    
    // Keep track of created transfer instances for reuse
    this.transferInstances = {};
  }
  
  /**
   * Create a transfer instance based on transfer type
   * @param {string} transferType - Type of transfer (e.g., 'UNION_TO_UNION')
   * @returns {BaseTransfer} Transfer instance
   */
  createTransfer(transferType) {
    this.logger.info(`Creating transfer handler for ${transferType}`);
    
    // If we've already created this transfer instance, return it
    if (this.transferInstances[transferType]) {
      return this.transferInstances[transferType];
    }
    
    // Special case for same-chain transfers, which use a different mechanism
    if (transferType === 'UNION_TO_UNION') {
      const instance = new UnionToUnionTransfer(this.config, this.walletIndex, this.privateKey);
      this.transferInstances[transferType] = instance;
      return instance;
    }
    
    // Special case for Babylon to Babylon transfers
    if (transferType === 'BABYLON_TO_BABYLON') {
      const instance = new BabylonToBabylonTransfer(this.config, this.walletIndex, this.privateKey);
      this.transferInstances[transferType] = instance;
      return instance;
    }
    
    // For all other transfers, use the unified IBC transfer implementation
    const [sourceChain, destinationChain] = this.parseTransferType(transferType);
    
    // Validate that the chains exist in the configuration
    if (!this.config.chains[sourceChain]) {
      throw new Error(`Invalid source chain: ${sourceChain}`);
    }
    
    if (!this.config.chains[destinationChain]) {
      throw new Error(`Invalid destination chain: ${destinationChain}`);
    }
    
    // Create a new unified IBC transfer instance
    const instance = new UnifiedIBCTransfer(
      this.config,
      this.walletIndex,
      this.privateKey,
      sourceChain,
      destinationChain
    );
    
    // Cache the instance for future use
    this.transferInstances[transferType] = instance;
    return instance;
  }
  
  /**
   * Parse a transfer type string into source and destination chains
   * @param {string} transferType - Transfer type string (e.g., 'UNION_TO_BABYLON')
   * @returns {string[]} Array containing [sourceChain, destinationChain]
   */
  parseTransferType(transferType) {
    const parts = transferType.split('_TO_');
    if (parts.length !== 2) {
      throw new Error(`Invalid transfer type format: ${transferType}`);
    }
    
    return parts;
  }
  
  /**
   * Get appropriate transfer type based on source and destination chains
   * @param {string} sourceChain - Source chain name
   * @param {string} destinationChain - Destination chain name
   * @returns {string} Transfer type
   */
  getTransferType(sourceChain, destinationChain) {
    return `${sourceChain}_TO_${destinationChain}`;
  }
}

export default TransferFactory;