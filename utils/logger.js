import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

// Increase the default max listeners for EventEmitter to avoid warnings
EventEmitter.defaultMaxListeners = 50;

// Global spinner reference that can be accessed by the logger
let activeSpinner = null;

// Function to set the active spinner
export function setActiveSpinner(spinner) {
  activeSpinner = spinner;
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

// Create a custom console transport that handles spinners
const spinnerAwareConsoleTransport = new transports.Console({
  format: combine(
    colorize({ all: true }),
    logFormat
  ),
  log: (info, callback) => {
    // If there's an active spinner, temporarily pause it
    const spinnerWasVisible = activeSpinner && activeSpinner.isSpinning;
    
    if (spinnerWasVisible) {
      activeSpinner.stop();
    }
    
    // Write the log message
    process.stdout.write(`${info[Symbol.for('message')]}\n`);
    
    // Restart the spinner if it was active
    if (spinnerWasVisible) {
      activeSpinner.start();
    }
    
    callback();
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

// Map to keep track of wallet-specific transports to avoid duplicates
const walletTransports = new Map();

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
  
  // Create wallet-specific log file
  const walletLogFile = path.join(logsDir, `wallet-${walletIndex + 1}.log`);
  
  // Check if we already have a transport for this wallet
  if (!walletTransports.has(walletIndex)) {
    // Create a new transport for this wallet
    const fileTransport = new transports.File({
      filename: walletLogFile,
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    });
    
    // Add the transport to the logger
    logger.add(fileTransport);
    
    // Store the transport reference
    walletTransports.set(walletIndex, fileTransport);
  }
  
  // walletIndex remains 0-based internally, will be converted for display in the format
  return logger.child({ walletIndex });
}

export default logger;
export { createWalletLogger };