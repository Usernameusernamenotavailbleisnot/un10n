import initializeApp from './app.js';
import { runInteractiveUI } from './ui/index.js';
import logger from './utils/logger.js';

/**
 * Main application function
 */
async function main() {
  try {
    // Initialize the application
    const { services, config } = await initializeApp();
    
    // Run the interactive UI
    await runInteractiveUI(services, config);
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`);
    if (error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(1);
  }
}

// Start the application
main();