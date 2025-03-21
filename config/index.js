import chains from './chains.js';
import quests, { DEFAULT_TRANSFER_AMOUNT } from './quests.js';
import logger from '../utils/logger.js';

// Create the configuration object
const config = {
  chains,
  quests,
  DEFAULT_TRANSFER_AMOUNT
};

// Log successful configuration
logger.info('Configuration loaded successfully');

export default config;