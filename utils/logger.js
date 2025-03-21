// utils/logger.js
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

// Increase the default max listeners for EventEmitter to avoid warnings
EventEmitter.defaultMaxListeners = 100;

// Create singleton event emitter for logger-spinner coordination
const loggerEvents = new EventEmitter();

// Global spinner reference that can be accessed by the logger
let activeSpinner = null;

// Function to set the active spinner
export function setActiveSpinner(spinner) {
  if (spinner) {
    activeSpinner = spinner;
    // Set up event listeners for the spinner
    loggerEvents.on('log', () => {
      if (activeSpinner && activeSpinner.isSpinning) {
        activeSpinner.stop();
        process.nextTick(() => {
          if (activeSpinner) {
            activeSpinner.start();
          }
        });
      }
    });
  } else {
    // Clear the spinner and remove listeners
    activeSpinner = null;
    loggerEvents.removeAllListeners('log');
  }
}

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { format, transports } = winston;
const { combine, timestamp, printf, colorize } = format;

/**
 * Custom log format with wallet index and colorization for console
 */
const logFormat = printf(({ level, message, timestamp, walletIndex, category, operation }) => {
  // Add 1 to wallet index for display (1-based instead of 0-based)
  const displayWalletIndex = walletIndex !== undefined ? walletIndex + 1 : undefined;
  const walletInfo = displayWalletIndex !== undefined ? `[Wallet ${displayWalletIndex}]` : '';
  const categoryInfo = category ? `[${category}]` : '';
  const operationInfo = operation ? `[${operation}]` : '';
  
  return `[${timestamp}] ${walletInfo}${categoryInfo}${operationInfo} ${level}: ${message}`;
});

// Create a mutex to prevent multiple threads from writing logs simultaneously
const logMutex = {
  locked: false,
  queue: [],
  
  async acquire() {
    if (!this.locked) {
      this.locked = true;
      return true;
    }
    
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  },
  
  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next(true);
    } else {
      this.locked = false;
    }
  }
};

// Create a custom console transport that handles spinners and thread safety
const spinnerAwareConsoleTransport = new transports.Console({
  format: combine(
    colorize({ all: true }),
    logFormat
  ),
  log: async (info, callback) => {
    try {
      // Acquire mutex to ensure only one thread logs at a time
      await logMutex.acquire();
      
      // Emit log event to notify spinner
      loggerEvents.emit('log');
      
      // Write the log message
      process.stdout.write(`${info[Symbol.for('message')]}\n`);
      
      // Release mutex
      logMutex.release();
      
      callback();
    } catch (error) {
      logMutex.release();
      console.error('Error in console transport:', error);
      callback(error);
    }
  }
});

/**
 * Customized logger with additional features
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format((info) => {
      info.level = info.level.toUpperCase();
      return info;
    })(),
    logFormat
  ),
  transports: [
    // Spinner-aware console transport
    spinnerAwareConsoleTransport,
    // Error log file
    new transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error' 
    }),
    // Combined log file
    new transports.File({ 
      filename: path.join(logsDir, 'combined.log') 
    })
  ]
});

// Map to keep track of wallet-specific loggers to avoid duplicates
const walletLoggers = new Map();

/**
 * Create a child logger with wallet index
 * @param {number} walletIndex - Wallet index (0-based)
 * @returns {Object} Child logger
 */
function createWalletLogger(walletIndex) {
  // If walletIndex is undefined, return the main logger
  if (walletIndex === undefined) {
    return logger;
  }
  
  // Check if we already have a logger for this wallet
  if (walletLoggers.has(walletIndex)) {
    return walletLoggers.get(walletIndex);
  }
  
  // Create wallet-specific log file path
  const walletLogFile = path.join(logsDir, `wallet-${walletIndex + 1}.log`);
  
  // Create a custom transport for this wallet
  const fileTransport = new transports.File({
    filename: walletLogFile,
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat
    )
  });
  
  // Create a wallet-specific logger
  const walletLogger = logger.child({ walletIndex });
  
  // Add the file transport to this logger instance
  walletLogger.add(fileTransport);
  
  // Store the logger reference
  walletLoggers.set(walletIndex, walletLogger);
  
  return walletLogger;
}

export default logger;
export { createWalletLogger };