import chalk from 'chalk';
import figlet from 'figlet';
import clear from 'clear';
import boxen from 'boxen';
import ora from 'ora';
import { setActiveSpinner } from '../utils/logger.js';

/**
 * Display the application banner
 */
function displayBanner() {
  clear();
  console.log(
    chalk.blue(
      figlet.textSync('Union Quest Bot', { horizontalLayout: 'full' })
    )
  );
  console.log(chalk.cyan('Interactive Terminal UI'));
  console.log();
}

/**
 * Display a message box
 * @param {string} message - Message to display
 * @param {string} type - Type of message (info, success, error)
 */
function displayMessage(message, type = 'info') {
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow
  };

  console.log(
    boxen(colors[type](message), {
      padding: 1,
      borderColor: type === 'error' ? 'red' : type === 'success' ? 'green' : 'blue',
      borderStyle: 'round'
    })
  );
}

/**
 * Display progress information
 * @param {Object} progressData - Progress data object
 */
function displayProgress(progressData) {
  console.log(chalk.cyan.bold('\nCurrent Progress:'));
  
  // Display daily interaction progress
  console.log(chalk.cyan('\nDaily Interactions:'));
  console.log(chalk.white(`UNION: ${progressData.dailyInteractions.UNION.count} days`));
  console.log(chalk.white(`BABYLON: ${progressData.dailyInteractions.BABYLON.count} days`));
  
  // Display transfer progress
  console.log(chalk.cyan('\nTransfers:'));
  console.log(chalk.white(`TO UNION: ${progressData.transfers.UNION.count} transfers`));
  console.log(chalk.white(`TO BABYLON: ${progressData.transfers.BABYLON.count} transfers`));
  
  // Display cross-chain quest progress
  console.log(chalk.cyan('\nCross-Chain Quests:'));
  Object.entries(progressData.crossChain).forEach(([quest, { completed }]) => {
    console.log(chalk.white(`${quest}: ${completed ? chalk.green('Completed') : chalk.yellow('Pending')}`));
  });
  
  console.log(); // Empty line for spacing
}

/**
 * Create and return a spinner
 * @param {string} text - Initial spinner text
 * @returns {Object} Ora spinner instance
 */
function createSpinner(text) {
  const spinner = ora({
    text,
    color: 'cyan',
    discardStdin: false
  }).start();
  
  // Register the spinner with the logger
  setActiveSpinner(spinner);
  
  return spinner;
}

/**
 * Display a section header
 * @param {string} title - Section title
 */
function displaySectionHeader(title) {
  console.log(chalk.cyan.bold(`\n=== ${title} ===`));
}

/**
 * Display addresses for all chains
 * @param {Object} addresses - Address object mapping chain names to addresses
 */
function displayAddresses(addresses) {
  displaySectionHeader('Wallet Addresses');
  
  Object.entries(addresses).forEach(([chain, address]) => {
    if (address) {
      console.log(chalk.white(`${chain}: ${address}`));
    }
  });
}

export {
  displayBanner,
  displayMessage,
  displayProgress,
  createSpinner,
  displaySectionHeader,
  displayAddresses
};