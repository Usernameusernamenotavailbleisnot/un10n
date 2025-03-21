import config from './config/index.js';
import logger from './utils/logger.js';
import { setupWallets } from './core/blockchain/wallet.js';
import DailyInteractionService from './core/quests/dailyInteraction.js';
import TransferQuestService from './core/quests/transferQuest.js';
import CrossChainQuestService from './core/quests/crossChainQuest.js';
import FaucetService from './core/faucet/faucetService.js';
import { runInteractiveUI } from './ui/index.js';

/**
 * Initialize the application
 * @returns {Promise<Object>} Services and config
 */
async function initializeApp() {
  logger.info('Initializing Union Quest Bot');
  
  try {
    // Setup wallets
    await setupWallets(config);
    
    // Initialize services
    const services = {
      daily: new DailyInteractionService(config),
      transfer: new TransferQuestService(config),
      crossChain: new CrossChainQuestService(config),
      faucet: new FaucetService(config)
    };
    
    return { services, config };
  } catch (error) {
    logger.error(`Initialization error: ${error.message}`);
    throw error;
  }
}

export default initializeApp;