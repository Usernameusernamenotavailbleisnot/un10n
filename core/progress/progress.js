// core/progress/progress.js
import fs from 'fs/promises';
import path from 'path';
import { createWalletLogger } from '../../utils/logger.js';

/**
 * Service for managing progress data with improved thread safety
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
    this.filePath = path.join(this.dataDir, `progress-${walletIndex}.json`);
    
    // Progress file lock tracking
    this.lockTimeout = 10000; // 10 seconds max wait time for lock
    this.lockRetryInterval = 100; // 100ms between lock attempts
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
   * Wait for file lock to be available
   * @returns {Promise<boolean>} True if lock acquired, false on timeout
   */
  async waitForLock() {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.lockTimeout) {
      try {
        // Check for existence of lock file
        const lockPath = `${this.filePath}.lock`;
        await fs.access(lockPath);
        
        // Lock file exists, wait and retry
        await new Promise(resolve => setTimeout(resolve, this.lockRetryInterval));
      } catch (error) {
        // Lock file doesn't exist, we can acquire the lock
        try {
          // Create lock file
          await fs.writeFile(`${this.filePath}.lock`, Date.now().toString(), 'utf8');
          return true;
        } catch (lockError) {
          // Failed to create lock file, another process might have created it first
          this.logger.warn(`Failed to acquire lock: ${lockError.message}`);
        }
      }
    }
    
    this.logger.error(`Timeout waiting for progress file lock`);
    return false;
  }
  
  /**
   * Release file lock
   * @returns {Promise<void>}
   */
  async releaseLock() {
    try {
      await fs.unlink(`${this.filePath}.lock`);
    } catch (error) {
      this.logger.warn(`Failed to release lock: ${error.message}`);
    }
  }
  
  /**
   * Read progress data from file with thread safety
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
      
      // If it's a JSON parse error, use default data
      if (error instanceof SyntaxError) {
        this.logger.error(`JSON parse error, using default data: ${error.message}`);
        const defaultData = this.getDefaultProgressData();
        await this.saveProgressData(defaultData);
        return defaultData;
      }
      
      this.logger.error(`Error reading progress data: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Save progress data to file with thread safety
   * @param {Object} data - Progress data to save
   * @returns {Promise<void>}
   */
  async saveProgressData(data) {
    // Acquire lock
    if (!await this.waitForLock()) {
      throw new Error('Could not acquire lock for saving progress data');
    }
    
    try {
      // Ensure the data directory exists
      await this.ensureDataDirExists();
      
      // Validate and update the data
      const validatedData = this.validateProgressData(data);
      
      // Write data directly to the file
      await fs.writeFile(this.filePath, JSON.stringify(validatedData, null, 2), 'utf8');
      
      this.logger.info(`Progress saved for wallet ${this.walletIndex + 1}`);
    } catch (error) {
      this.logger.error(`Error saving progress data: ${error.message}`);
      throw error;
    } finally {
      // Release lock
      await this.releaseLock();
    }
  }
  
  /**
   * Update specific fields in the progress data
   * @param {Function} updateFn - Function that receives current data and returns updated data
   * @returns {Promise<Object>} Updated progress data
   */
  async updateProgressData(updateFn) {
    // Acquire lock
    if (!await this.waitForLock()) {
      throw new Error('Could not acquire lock for updating progress data');
    }
    
    try {
      // Read current data
      const currentData = await this.readProgressData();
      
      // Apply the update function
      const updatedData = updateFn(currentData);
      
      // Save the updated data (without lock since we already have it)
      await fs.writeFile(this.filePath, JSON.stringify(this.validateProgressData(updatedData), null, 2), 'utf8');
      
      return updatedData;
    } catch (error) {
      this.logger.error(`Error updating progress data: ${error.message}`);
      throw error;
    } finally {
      // Release lock
      await this.releaseLock();
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