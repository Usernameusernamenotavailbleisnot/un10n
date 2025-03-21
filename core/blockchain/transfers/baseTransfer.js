import { StargateClient } from '@cosmjs/stargate';
import { createWallet } from '../wallet.js';
import { createWalletLogger } from '../../../utils/logger.js';
import { toRawAmount } from '../../../utils/common.js';

/**
 * Base class for all transfer implementations
 */
class BaseTransfer {
  /**
   * Create a new BaseTransfer instance
   * @param {Object} config - Configuration object
   * @param {number} walletIndex - Wallet index
   * @param {string} privateKey - Private key
   */
  constructor(config, walletIndex, privateKey) {
    this.config = config;
    this.walletIndex = walletIndex;
    this.privateKey = privateKey;
    this.logger = createWalletLogger(walletIndex);
  }

  /**
   * Initialize the transfer with source and destination chains
   * @param {string} sourceChainName - Source chain name
   * @param {string} destinationChainName - Destination chain name
   */
  async initialize(sourceChainName, destinationChainName) {
    this.sourceChain = this.config.chains[sourceChainName];
    this.destinationChain = this.config.chains[destinationChainName];
    
    if (!this.sourceChain) {
      throw new Error(`Source chain ${sourceChainName} not found in configuration`);
    }
    
    if (!this.destinationChain) {
      throw new Error(`Destination chain ${destinationChainName} not found in configuration`);
    }
    
    // Create wallet for source chain
    this.wallet = await createWallet(this.privateKey, this.sourceChain.prefix, this.walletIndex);
    const [account] = await this.wallet.getAccounts();
    this.senderAddress = account.address;
    
    this.logger.info(`Initializing transfer from ${sourceChainName} to ${destinationChainName}`);
    this.logger.info(`Sender address: ${this.senderAddress}`);
    
    // Connect to chain
    this.client = await StargateClient.connect(this.sourceChain.rpcEndpoint);
    
    this.logger.info(`Connected to ${sourceChainName} blockchain`);
  }

  /**
   * Check if the wallet has sufficient balance for the transfer
   * @param {string} amount - Amount to transfer
   * @returns {Promise<boolean>} True if balance is sufficient
   */
  async checkBalance(amount) {
    try {
      const balances = await this.client.getAllBalances(this.senderAddress);
      
      const denom = this.sourceChain.denom;
      const balance = balances.find(b => b.denom === denom);
      const availableAmount = balance ? parseInt(balance.amount) : 0;
      
      this.logger.info(`Balance: ${availableAmount / Math.pow(10, this.sourceChain.decimals)} ${denom.toUpperCase()}`);
      
      const requiredAmount = Math.floor(parseFloat(amount) * Math.pow(10, this.sourceChain.decimals));
      
      if (availableAmount < requiredAmount) {
        const humanReadableAvailable = availableAmount / Math.pow(10, this.sourceChain.decimals);
        throw new Error(`Insufficient balance: ${humanReadableAvailable} ${denom.toUpperCase()} (need ${amount} ${denom.toUpperCase()})`);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error checking balance: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get account information from the chain
   * @returns {Promise<{accountNumber: number, sequence: number}>} Account info
   */
  async getAccountInfo() {
    try {
      const accountInfo = await this.client.getAccount(this.senderAddress);
      
      if (accountInfo) {
        this.logger.info(`Account details: Number=${accountInfo.accountNumber}, Sequence=${accountInfo.sequence}`);
        return {
          accountNumber: accountInfo.accountNumber,
          sequence: accountInfo.sequence
        };
      } else {
        this.logger.warn('Account not found on chain, using defaults (accountNumber: 0, sequence: 0)');
        return { accountNumber: 0, sequence: 0 };
      }
    } catch (error) {
      this.logger.warn(`Could not get account info: ${error.message}`);
      return { accountNumber: 0, sequence: 0 };
    }
  }
  
  /**
   * Convert amount to raw (blockchain) format as string
   * @param {string} amount - Human-readable amount
   * @returns {string} Raw amount as string
   */
  toRawAmount(amount) {
    return toRawAmount(amount, this.sourceChain.decimals);
  }
  
  /**
   * Abstract method for performing a transfer
   * @param {string} receiverAddress - Destination address
   * @param {string} amount - Amount to transfer
   * @returns {Promise<Object|null>} Transfer result or null if failed
   */
  async transfer(receiverAddress, amount) {
    throw new Error('Transfer method must be implemented by subclasses');
  }
}

export default BaseTransfer;