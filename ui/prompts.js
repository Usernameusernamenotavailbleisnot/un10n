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

export {
  promptForCommand,
  promptForWallet,
  promptForChain,
  promptForTransferCount,
  promptForCrossChainQuest,
  promptForAmount,
  promptForConfirmation
};