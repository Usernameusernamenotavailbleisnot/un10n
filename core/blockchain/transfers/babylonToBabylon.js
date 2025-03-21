// core/blockchain/transfers/babylonToBabylon.js
import { SigningStargateClient } from '@cosmjs/stargate';
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx.js";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";
import BaseTransfer from './baseTransfer.js';

/**
 * Implementation of same-chain transfers for Babylon
 */
class BabylonToBabylonTransfer extends BaseTransfer {
  /**
   * Transfer tokens from Babylon to Babylon (same chain)
   * @param {string} receiverAddress - Destination address
   * @param {string} amount - Amount to transfer
   * @returns {Promise<Object|null>} Transfer result or null if failed
   */
  async transfer(receiverAddress, amount) {
    try {
      await this.initialize('BABYLON', 'BABYLON');
      
      if (!await this.checkBalance(amount)) {
        return null;
      }

      this.logger.info(`Starting transfer of ${amount} BBN to ${receiverAddress}`);
      
      // Connect signing client
      const signingClient = await SigningStargateClient.connectWithSigner(
        this.sourceChain.rpcEndpoint, 
        this.wallet
      );
      
      const chainId = await this.client.getChainId();
      
      // Prepare transaction
      const denom = this.sourceChain.denom;
      const rawAmount = this.toRawAmount(amount);
      
      const sendMsg = {
        typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        value: MsgSend.fromPartial({
          fromAddress: this.senderAddress,
          toAddress: receiverAddress,
          amount: [{ denom, amount: rawAmount }]
        })
      };
      
      // Set fee
      const fee = {
        amount: [{ denom, amount: "7500" }],
        gas: "300000"
      };
      
      // Get account info
      const { accountNumber, sequence } = await this.getAccountInfo();
      
      // Sign transaction
      this.logger.info('Signing transaction...');
      const txRaw = await signingClient.sign(
        this.senderAddress, 
        [sendMsg], 
        fee, 
        "Babylon to Babylon Transfer", 
        { accountNumber, sequence, chainId }
      );
      
      // Broadcast transaction
      this.logger.info('Broadcasting transaction...');
      const txBytes = TxRaw.encode(txRaw).finish();
      const result = await this.client.broadcastTx(txBytes);
      
      if (result.code === 0) {
        this.logger.info(`Transfer successful: ${result.transactionHash}`);
        return {
          success: true,
          hash: result.transactionHash,
          amount,
          sender: this.senderAddress,
          receiver: receiverAddress
        };
      } else {
        throw new Error(`Transaction failed with code ${result.code}: ${result.rawLog}`);
      }
      
    } catch (error) {
      // Handle special case for tx already in mempool
      if (error.message && error.message.includes('tx already exists in cache')) {
        this.logger.info('Transaction already in mempool, considered successful');
        return {
          success: true,
          hash: 'tx-in-mempool-' + Date.now().toString(),
          inMempool: true,
          amount,
          sender: this.senderAddress,
          receiver: receiverAddress,
          message: 'Transaction already in mempool'
        };
      }
      
      this.logger.error(`Error processing Babylon to Babylon transfer: ${error.message}`);
      return null;
    }
  }
}

export default BabylonToBabylonTransfer;