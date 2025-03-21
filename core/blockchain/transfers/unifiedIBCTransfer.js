import BaseTransfer from './baseTransfer.js';
import { sleep } from '../../../utils/common.js';

/**
 * Unified IBC Transfer class that handles transfers between any supported chains
 * Replaces multiple chain-specific transfer classes with a single implementation
 */
class UnifiedIBCTransfer extends BaseTransfer {
  /**
   * Create a new UnifiedIBCTransfer instance
   * @param {Object} config - Configuration object
   * @param {number} walletIndex - Wallet index
   * @param {string} privateKey - Private key
   * @param {string} sourceChainName - Source chain name
   * @param {string} destinationChainName - Destination chain name
   */
  constructor(config, walletIndex, privateKey, sourceChainName, destinationChainName) {
    super(config, walletIndex, privateKey);
    this.sourceChainName = sourceChainName;
    this.destinationChainName = destinationChainName;
  }
  
  /**
   * Transfer tokens from source chain to destination chain
   * @param {string} receiverAddress - Destination address
   * @param {string} amount - Amount to transfer
   * @returns {Promise<Object|null>} Transfer result or null if failed
   */
  async transfer(receiverAddress, amount) {
    try {
      await this.initialize(this.sourceChainName, this.destinationChainName);
      
      if (!await this.checkBalance(amount)) {
        return null;
      }

      this.logger.info(`Starting transfer of ${amount} ${this.getTokenName(this.sourceChainName)} from ${this.sourceChainName} to ${this.destinationChainName} (${receiverAddress})`);
      
      // Import required modules
      const [viem, unionlabs] = await this.importRequiredModules();
      
      // Get account info
      const { accountNumber, sequence } = await this.getAccountInfo();
      
      // Get channel information
      const channel = await this.getIBCChannel(unionlabs);
      if (!channel) return null;
      
      // Convert base token and prepare receiver address
      const { baseToken, baseTokenHex, receiverHex } = await this.prepareTokensAndAddresses(receiverAddress, viem, unionlabs);
      
      // Get quote token
      const quoteToken = await this.getQuoteToken(baseTokenHex, channel, unionlabs);
      if (!quoteToken) return null;
      
      // Create Union client
      const unionClient = this.createUnionClient(accountNumber, sequence, unionlabs);
      
      // Execute transfer
      return await this.executeTransfer(unionClient, baseToken, quoteToken, receiverHex, channel, amount, receiverAddress, viem);
      
    } catch (error) {
      this.logger.error(`Error processing ${this.sourceChainName} to ${this.destinationChainName} transfer: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Import required modules for IBC transfer
   * @returns {Promise<Array>} Array of imported modules [viem, unionlabs]
   */
  async importRequiredModules() {
    this.logger.info('Loading IBC transfer modules...');
    return await Promise.all([
      import('viem'),
      import('@unionlabs/client')
    ]);
  }
  
  /**
   * Get a user-friendly token name for display in logs
   * @param {string} chainName - Chain name
   * @returns {string} Token name
   */
  getTokenName(chainName) {
    const tokens = {
      'UNION': 'MUNO',
      'BABYLON': 'BBN',
      'STARGAZE': 'STARS',
      'STRIDE': 'STRD'
    };
    return tokens[chainName] || chainName;
  }
  
  /**
   * Get IBC channel information between source and destination chains
   * @param {Object} unionlabs - Unionlabs client module
   * @returns {Promise<Object|null>} Channel information or null if not found
   */
  async getIBCChannel(unionlabs) {
    this.logger.info('Fetching channel information...');
    try {
      const channels = await unionlabs.getRecommendedChannels();
      
      const channel = unionlabs.getChannelInfo(
        this.sourceChain.chainId, 
        this.destinationChain.chainId, 
        channels
      );
      
      if (!channel) {
        this.logger.error(`No channel found between ${this.sourceChainName} and ${this.destinationChainName}`);
        this.logger.info(`Consider using UNION as an intermediary for ${this.sourceChainName} -> UNION -> ${this.destinationChainName}`);
        throw new Error('No channel found between source and destination chains');
      }
      
      this.logger.info(`Channel details: ${this.sourceChain.chainId}:${channel.source_channel_id} -> ${this.destinationChain.chainId}:${channel.destination_channel_id}`);
      return channel;
    } catch (error) {
      this.logger.error(`Error getting IBC channel: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Prepare tokens and addresses for transfer
   * @param {string} receiverAddress - Destination address
   * @param {Object} viem - Viem module
   * @param {Object} unionlabs - Unionlabs module
   * @returns {Promise<Object>} Token and address information
   */
  async prepareTokensAndAddresses(receiverAddress, viem, unionlabs) {
    const baseToken = this.sourceChain.denom;
    const baseTokenHex = viem.toHex(baseToken);
    
    let receiverHex;
    try {
      receiverHex = receiverAddress.startsWith("0x") 
        ? receiverAddress 
        : unionlabs.bech32AddressToHex({ address: receiverAddress });
    } catch (error) {
      this.logger.error(`Failed to convert receiver address: ${error.message}`);
      throw error;
    }
    
    return { baseToken, baseTokenHex, receiverHex };
  }
  
  /**
   * Get quote token for the IBC transfer
   * @param {string} baseTokenHex - Base token in hex format
   * @param {Object} channel - Channel information
   * @param {Object} unionlabs - Unionlabs module
   * @returns {Promise<Object|null>} Quote token or null if not available
   */
  async getQuoteToken(baseTokenHex, channel, unionlabs) {
    this.logger.info('Getting quote token information...');
    try {
      const quoteToken = await unionlabs.getQuoteToken(this.sourceChain.chainId, baseTokenHex, channel);
      
      if (quoteToken.isErr()) {
        throw new Error(`Failed to get quote token: ${quoteToken.error.toString()}`);
      }
      
      if (quoteToken.value.type === "NO_QUOTE_AVAILABLE") {
        throw new Error('No quote token available for this transfer path');
      }
      
      return quoteToken.value;
    } catch (error) {
      this.logger.error(`Error getting quote token: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Create Union client for executing the transfer
   * @param {number} accountNumber - Account number
   * @param {number} sequence - Sequence number
   * @param {Object} unionlabs - Unionlabs module
   * @returns {Object} Union client
   */
  createUnionClient(accountNumber, sequence, unionlabs) {
    this.logger.info('Creating Union client...');
    return unionlabs.createUnionClient({
      chainId: this.sourceChain.chainId,
      account: this.wallet,
      gasPrice: this.sourceChain.gasPrice,
      transport: unionlabs.http(this.sourceChain.rpcEndpoint),
      accountNumber,
      sequence
    });
  }
  
  /**
   * Execute the IBC transfer
   * @param {Object} unionClient - Union client
   * @param {string} baseToken - Base token
   * @param {Object} quoteToken - Quote token
   * @param {string} receiverHex - Receiver address in hex format
   * @param {Object} channel - Channel information
   * @param {string} amount - Amount to transfer
   * @param {string} receiverAddress - Original receiver address
   * @param {Object} viem - Viem module
   * @returns {Promise<Object|null>} Transfer result or null if failed
   */
  async executeTransfer(unionClient, baseToken, quoteToken, receiverHex, channel, amount, receiverAddress, viem) {
    try {
      this.logger.info('Initiating transfer...');
      
      const rawAmount = BigInt(this.toRawAmount(amount));
      const rawAmountString = rawAmount.toString(); // Convert to string to avoid serialization issues
      
      const transferParams = {
        baseToken: baseToken,
        baseAmount: rawAmountString,
        quoteToken: quoteToken.quote_token || quoteToken.value?.quote_token, // Handle different response structures
        quoteAmount: rawAmountString,
        receiver: receiverHex,
        sourceChannelId: channel.source_channel_id,
        ucs03address: viem.fromHex(`0x${channel.source_port_id}`, "string")
      };
      
      this.logger.info(`Calling transferAsset...`);
      
      // Timeout for transfer operation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Transfer timed out after 90 seconds')), 90000);
      });
      
      // Execute transfer with timeout
      const transferPromise = unionClient.transferAsset(transferParams);
      const transfer = await Promise.race([transferPromise, timeoutPromise]);
      
      if (transfer.isErr()) {
        throw new Error(`Transfer failed: ${transfer.error.toString()}`);
      }
      
      this.logger.info(`Transfer completed successfully: ${transfer.value}`);
      
      return {
        success: true,
        hash: transfer.value,
        amount,
        sender: this.senderAddress,
        receiver: receiverAddress
      };
    } catch (error) {
      this.logger.error(`Error executing transfer: ${error.message}`);
      return null;
    }
  }
}

export default UnifiedIBCTransfer;