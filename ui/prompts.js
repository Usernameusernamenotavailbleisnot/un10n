// ui/prompts.js
import inquirer from 'inquirer';

/**
 * Prompt for selecting a command
 * @returns {Promise<Object>} User's choice
 */
async function promptForCommand() {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'command',
      message: 'Select a command:',
      choices: [
        { name: 'Run daily interactions', value: 'daily' },
        { name: 'Run transfer quests', value: 'transfer' },
        { name: 'Run cross-chain quests', value: 'cross-chain' },
        { name: 'Request from faucet', value: 'faucet' }, // New option
        { name: 'Run full automation (all quests)', value: 'full' },
        { name: 'View progress', value: 'progress' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);
}

/**
 * Prompt for selecting a wallet
 * @param {number} walletCount - Number of available wallets
 * @param {boolean} allowAll - Whether to allow selecting all wallets
 * @returns {Promise<Object>} User's choice
 */
async function promptForWallet(walletCount, allowAll = true) {
  const choices = Array.from({ length: walletCount }, (_, i) => ({ 
    name: `Wallet ${i + 1}`, 
    value: i 
  }));
  
  if (allowAll && walletCount > 1) {
    choices.unshift({ name: 'All wallets', value: 'all' });
  }
  
  return inquirer.prompt([
    {
      type: 'list',
      name: 'walletIndex',
      message: 'Select a wallet:',
      choices
    }
  ]);
}

/**
 * Prompt for selecting a chain
 * @param {string[]} chains - Array of available chains
 * @param {boolean} allowAll - Whether to allow selecting all chains
 * @returns {Promise<Object>} User's choice
 */
async function promptForChain(chains, allowAll = true) {
  const choices = chains.map(chain => ({ name: chain, value: chain }));
  
  if (allowAll && chains.length > 1) {
    choices.unshift({ name: 'All chains', value: 'all' });
  }
  
  return inquirer.prompt([
    {
      type: 'list',
      name: 'chain',
      message: 'Select a chain:',
      choices
    }
  ]);
}

/**
 * Prompt for transfer count
 * @returns {Promise<Object>} User's choice
 */
async function promptForTransferCount() {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'countOption',
      message: 'How many transfers would you like to perform?',
      choices: [
        { name: '1 transfer', value: 1 },
        { name: 'Complete next quest', value: 'next' },
        { name: 'Custom count', value: 'custom' }
      ]
    },
    {
      type: 'input',
      name: 'customCount',
      message: 'Enter number of transfers:',
      when: (answers) => answers.countOption === 'custom',
      validate: (value) => {
        const parsed = parseInt(value);
        const valid = !isNaN(parsed) && parsed > 0;
        return valid || 'Please enter a valid number greater than 0';
      },
      filter: (value) => parseInt(value)
    }
  ]);
}

/**
 * Prompt for selecting a cross-chain quest
 * @param {Object[]} quests - Array of available quests
 * @param {boolean} allowAll - Whether to allow selecting all quests
 * @returns {Promise<Object>} User's choice
 */
async function promptForCrossChainQuest(quests, allowAll = true) {
  const choices = quests.map(quest => ({ 
    name: `${quest.name} (${quest.path.join(' → ')})`, 
    value: quest.name 
  }));
  
  if (allowAll && quests.length > 1) {
    choices.unshift({ name: 'All quests', value: 'all' });
  }
  
  return inquirer.prompt([
    {
      type: 'list',
      name: 'quest',
      message: 'Select a cross-chain quest:',
      choices
    }
  ]);
}

/**
 * Prompt for transfer amount
 * @param {string} defaultAmount - Default transfer amount
 * @returns {Promise<Object>} User's choice
 */
async function promptForAmount(defaultAmount) {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'amountOption',
      message: 'Select transfer amount:',
      choices: [
        { name: `Default (${defaultAmount})`, value: 'default' },
        { name: 'Custom amount', value: 'custom' }
      ]
    },
    {
      type: 'input',
      name: 'customAmount',
      message: 'Enter transfer amount:',
      when: (answers) => answers.amountOption === 'custom',
      validate: (value) => {
        const valid = !isNaN(parseFloat(value)) && parseFloat(value) > 0;
        return valid || 'Please enter a valid number greater than 0';
      }
    }
  ]);
}

/**
 * Prompt for confirmation
 * @param {string} message - Confirmation message
 * @returns {Promise<Object>} User's choice
 */
async function promptForConfirmation(message) {
  return inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: message,
      default: true
    }
  ]);
}

/**
 * Prompt for selecting a faucet
 * @returns {Promise<Object>} User's choice
 */
async function promptForFaucet() {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'faucet',
      message: 'Select a faucet:',
      choices: [
        { name: 'Union (MUNO)', value: 'UNION' },
        { name: 'Stargaze (STARS)', value: 'STARGAZE' }
      ]
    }
  ]);
}

/**
 * Prompt for maximum faucet attempts
 * @returns {Promise<Object>} User's choice
 */
async function promptForFaucetAttempts() {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'maxAttemptsOption',
      message: 'How many attempts should be made?',
      choices: [
        { name: 'Try until successful (unlimited)', value: 'unlimited' },
        { name: 'Custom number of attempts', value: 'custom' }
      ]
    },
    {
      type: 'input',
      name: 'maxAttempts',
      message: 'Enter maximum number of attempts:',
      when: (answers) => answers.maxAttemptsOption === 'custom',
      validate: (value) => {
        const parsed = parseInt(value);
        const valid = !isNaN(parsed) && parsed > 0;
        return valid || 'Please enter a valid number greater than 0';
      },
      filter: (value) => parseInt(value)
    }
  ]);
}

/**
 * Prompt for Capsolver API key
 * @returns {Promise<Object>} User's choice
 */
async function promptForCapsolverApiKey() {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'apiKey',
      message: 'Enter your Capsolver API key:',
      validate: (value) => {
        return value.trim().length > 0 || 'API key is required';
      }
    }
  ]);
}

/**
 * Prompt for thread count for parallel processing
 * @returns {Promise<Object>} User's choice
 */
async function promptForThreadCount() {
  return inquirer.prompt([
    {
      type: 'list',
      name: 'threads',
      message: 'How many threads to use for parallel processing?',
      choices: [
        { name: '1 thread (sequential)', value: 1 },
        { name: '2 threads', value: 2 },
        { name: '3 threads', value: 3 },
        { name: '5 threads', value: 5 },
        { name: 'Custom', value: 'custom' }
      ]
    },
    {
      type: 'input',
      name: 'customThreads',
      message: 'Enter number of threads:',
      when: (answers) => answers.threads === 'custom',
      validate: (value) => {
        const parsed = parseInt(value);
        return (!isNaN(parsed) && parsed > 0 && parsed <= 100) || 
               'Please enter a valid number between 1 and 10';
      },
      filter: (value) => parseInt(value)
    }
  ]);
}

export {
  promptForCommand,
  promptForWallet,
  promptForChain,
  promptForTransferCount,
  promptForCrossChainQuest,
  promptForAmount,
  promptForConfirmation,
  promptForFaucet,
  promptForFaucetAttempts,
  promptForCapsolverApiKey,
  promptForThreadCount
};