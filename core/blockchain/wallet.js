import fs from 'fs/promises';
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import logger from '../../utils/logger.js';
import { hexToBytes } from '../../utils/common.js';
import ProgressService from '../progress/progress.js';

/**
 * Read private keys from pk.txt file
 * @returns {Promise<string[]>} Array of private keys
 */
async function readPrivateKeys() {
  try {
    const data = await fs.readFile('./pk.txt', 'utf8');
    return data.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Create pk.txt if it doesn't exist
      await fs.writeFile('./pk.txt', '# Add your private keys here (one per line)\n', 'utf8');
      return [];
    }
    throw new Error(`Could not read private keys file (pk.txt): ${error.message}`);
  }
}

/**
 * Create a wallet for a specific chain from a private key
 * @param {string} privateKey - The private key in hex format
 * @param {string} prefix - The chain-specific address prefix
 * @param {number} walletIndex - Wallet index for logging
 * @returns {Promise<DirectSecp256k1Wallet>} The wallet instance
 */
async function createWallet(privateKey, prefix, walletIndex) {
  try {
    return await DirectSecp256k1Wallet.fromKey(
      Uint8Array.from(hexToBytes(privateKey)),
      prefix
    );
  } catch (error) {
    throw new Error(`Failed to create wallet for prefix ${prefix}: ${error.message}`);
  }
}

/**
 * Get address for a specific chain from a private key
 * @param {string} privateKey - The private key in hex format
 * @param {string} chainPrefix - The chain-specific address prefix
 * @param {number} walletIndex - Index of the wallet for logging
 * @returns {Promise<string>} The derived address
 */
async function getAddressForChain(privateKey, chainPrefix, walletIndex) {
  try {
    const wallet = await createWallet(privateKey, chainPrefix, walletIndex);
    const [account] = await wallet.getAccounts();
    return account.address;
  } catch (error) {
    throw new Error(`Failed to get address for chain ${chainPrefix}: ${error.message}`);
  }
}

/**
 * Setup wallets and derive addresses for all chains
 * @param {Object} config - Configuration object
 * @returns {Promise<string[]>} Array of private keys
 */
async function setupWallets(config) {
  try {
    const privateKeys = await readPrivateKeys();
    logger.info(`Found ${privateKeys.length} private keys in pk.txt`);
    
    for (let i = 0; i < privateKeys.length; i++) {
      const privateKey = privateKeys[i];
      const walletIndex = i; // 0-based index for internal use
      const progressService = new ProgressService(walletIndex);
      
      // Get progress data
      const progressData = await progressService.readProgressData();
      
      // Derive addresses for all chains if not already stored
      for (const chain of Object.keys(config.chains)) {
        if (!progressData.addresses[chain]) {
          logger.info(`Deriving ${chain} address for wallet ${walletIndex + 1}`);
          
          try {
            const address = await getAddressForChain(
              privateKey, 
              config.chains[chain].prefix, 
              walletIndex
            );
            
            // Update address in progress data
            await progressService.updateAddress(chain, address);
            logger.info(`Wallet ${walletIndex + 1} ${chain} address: ${address}`);
          } catch (error) {
            logger.error(`Failed to derive ${chain} address for wallet ${walletIndex + 1}: ${error.message}`);
            // Continue anyway, don't let this stop the entire process
          }
        }
      }
    }
    
    return privateKeys;
  } catch (error) {
    logger.error(`Error setting up wallets: ${error.message}`);
    return [];
  }
}

export {
  readPrivateKeys,
  createWallet,
  getAddressForChain,
  setupWallets
};