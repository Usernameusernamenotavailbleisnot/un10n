import fs from 'fs/promises';
import path from 'path';
import { createWalletLogger } from '../../utils/logger.js';

/**
 * Service for managing progress data with enhanced reliability
 */
class ProgressService {
  /**
   * Create a new ProgressService instance
   * @param {number} walletIndex - Wallet index
   */
  constructor(walletIndex) {
    this.walletIndex = walletIndex;
    this.logger = createWalletLogger(walletIndex);
    this.dataDir = path.join(process.cwd(), 'data');
    this.filename = `progress-${walletIndex}.json`;
    this.filePath = path.join(this.dataDir, this.filename);
    this.tempFilePath = path.join(this.dataDir, `progress-${walletIndex}.tmp.json`);
    this.backupFilePath = path.join(this.dataDir, `progress-${walletIndex}.backup.json`);
  }
  
  /**
   * Get default progress data structure
   * @returns {Object} Default progress data
   */
  getDefaultProgressData() {
    return {
      version: 1, // Schema version for future migrations
      lastUpdated: new Date().toISOString(),
      addresses: {
        UNION: null,
        BABYLON: null,
        STARGAZE: null,
        STRIDE: null
      },
      dailyInteractions: {
        UNION: { lastInteraction: null, count: 0 },
        BABYLON: { lastInteraction: null, count: 0 }
      },
      transfers: {
        UNION: { count: 0 },
        BABYLON: { count: 0 }
      },
      crossChain: {
        CHAIN_REACTION: { completed: false },
        TRIPLE_THREAT: { completed: false },
        SIX_CHAINS: { completed: false }
      }
    };
  }
  
  /**
   * Validate progress data structure
   * @param {Object} data - Progress data to validate
   * @returns {Object} Validated and fixed progress data
   */
  validateProgressData(data) {
    // Ensure we have a valid object
    if (!data || typeof data !== 'object') {
      this.logger.warn('Invalid progress data, using defaults');
      return this.getDefaultProgressData();
    }
    
    // Check for missing sections and add them if needed
    const defaultData = this.getDefaultProgressData();
    const fixedData = { ...defaultData, ...data };
    
    // Ensure all required sections exist
    for (const section of ['addresses', 'dailyInteractions', 'transfers', 'crossChain']) {
      if (!fixedData[section]) {
        this.logger.warn(`Missing ${section} section in progress data, using defaults`);
        fixedData[section] = defaultData[section];
      }
    }
    
    // Set version and lastUpdated if missing
    if (!fixedData.version) {
      fixedData.version = 1;
    }
    
    fixedData.lastUpdated = new Date().toISOString();
    
    return fixedData;
  }
  
  /**
   * Ensure data directory exists
   * @returns {Promise<void>}
   */
  async ensureDataDirExists() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Error creating data directory: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Read progress data from file
   * @returns {Promise<Object>} Progress data
   */
  async readProgressData() {
    try {
      // Ensure the data directory exists
      await this.ensureDataDirExists();
      
      // Try to read the file
      const data = await fs.readFile(this.filePath, 'utf8');
      const progressData = JSON.parse(data);
      
      // Validate and fix the data
      return this.validateProgressData(progressData);
    } catch (error) {
      // If file doesn't exist, create a new one with default values
      if (error.code === 'ENOENT') {
        this.logger.info(`Creating new progress file for wallet ${this.walletIndex + 1}`);
        const defaultData = this.getDefaultProgressData();
        await this.saveProgressData(defaultData);
        return defaultData;
      }
      
      // If it's a JSON parse error, try to recover from backup
      if (error instanceof SyntaxError) {
        this.logger.error(`JSON parse error, attempting to recover from backup: ${error.message}`);
        return this.recoverFromBackup();
      }
      
      this.logger.error(`Error reading progress data: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Save progress data to file with atomic write
   * @param {Object} data - Progress data to save
   * @returns {Promise<void>}
   */
  async saveProgressData(data) {
    try {
      // Ensure the data directory exists
      await this.ensureDataDirExists();
      
      // Validate and update the data
      const validatedData = this.validateProgressData(data);
      
      // Create a backup of the current file if it exists
      try {
        const currentData = await fs.readFile(this.filePath, 'utf8');
        await fs.writeFile(this.backupFilePath, currentData, 'utf8');
      } catch (backupError) {
        // If the file doesn't exist, no need to backup
        if (backupError.code !== 'ENOENT') {
          this.logger.warn(`Could not create backup: ${backupError.message}`);
        }
      }
      
      // Write to a temporary file first
      await fs.writeFile(this.tempFilePath, JSON.stringify(validatedData, null, 2), 'utf8');
      
      // Atomically rename the temporary file to the actual file
      await fs.rename(this.tempFilePath, this.filePath);
      
      this.logger.info(`Progress saved for wallet ${this.walletIndex + 1}`);
    } catch (error) {
      this.logger.error(`Error saving progress data: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Update specific fields in the progress data
   * @param {Function} updateFn - Function that receives current data and returns updated data
   * @returns {Promise<Object>} Updated progress data
   */
  async updateProgressData(updateFn) {
    // Read current data
    const currentData = await this.readProgressData();
    
    // Apply the update function
    const updatedData = updateFn(currentData);
    
    // Save the updated data
    await this.saveProgressData(updatedData);
    
    return updatedData;
  }
  
  /**
   * Attempt to recover progress data from backup
   * @returns {Promise<Object>} Recovered progress data or default data if recovery fails
   */
  async recoverFromBackup() {
    try {
      // Try to read from backup file
      const backupData = await fs.readFile(this.backupFilePath, 'utf8');
      const recoveredData = JSON.parse(backupData);
      
      this.logger.info(`Successfully recovered progress data from backup for wallet ${this.walletIndex + 1}`);
      
      // Save the recovered data to the main file
      await fs.writeFile(this.filePath, backupData, 'utf8');
      
      return this.validateProgressData(recoveredData);
    } catch (error) {
      this.logger.error(`Could not recover from backup: ${error.message}`);
      
      // If recovery fails, return default data
      const defaultData = this.getDefaultProgressData();
      
      // Save the default data
      await this.saveProgressData(defaultData);
      
      return defaultData;
    }
  }
  
  /**
   * Update address for a specific chain
   * @param {string} chain - Chain name
   * @param {string} address - Chain address
   * @returns {Promise<Object>} Updated progress data
   */
  async updateAddress(chain, address) {
    return this.updateProgressData(data => {
      return {
        ...data,
        addresses: {
          ...data.addresses,
          [chain]: address
        }
      };
    });
  }
  
  /**
   * Update daily interaction for a specific chain
   * @param {string} chain - Chain name
   * @param {string} date - Interaction date (ISO format)
   * @returns {Promise<Object>} Updated progress data
   */
  async updateDailyInteraction(chain, date) {
    return this.updateProgressData(data => {
      const currentCount = data.dailyInteractions[chain]?.count || 0;
      
      return {
        ...data,
        dailyInteractions: {
          ...data.dailyInteractions,
          [chain]: {
            lastInteraction: date,
            count: currentCount + 1
          }
        }
      };
    });
  }
  
  /**
   * Update transfer count for a specific chain
   * @param {string} chain - Chain name
   * @param {number} increment - Amount to increment (default: 1)
   * @returns {Promise<Object>} Updated progress data
   */
  async updateTransferCount(chain, increment = 1) {
    return this.updateProgressData(data => {
      const currentCount = data.transfers[chain]?.count || 0;
      
      return {
        ...data,
        transfers: {
          ...data.transfers,
          [chain]: {
            count: currentCount + increment
          }
        }
      };
    });
  }
  
  /**
   * Update cross-chain quest completion status
   * @param {string} questName - Name of the quest
   * @param {boolean} completed - Completion status
   * @returns {Promise<Object>} Updated progress data
   */
  async updateCrossChainQuest(questName, completed = true) {
    return this.updateProgressData(data => {
      return {
        ...data,
        crossChain: {
          ...data.crossChain,
          [questName]: {
            ...data.crossChain[questName],
            completed
          }
        }
      };
    });
  }
}

export default ProgressService;