import { bytes } from '@scure/base';

/**
 * Convert hex string to byte array
 * @param {string} hexString - Hex string with or without 0x prefix
 * @returns {Uint8Array} Byte array
 */
function hexToBytes(hexString) {
  return bytes("hex", hexString.indexOf("0x") === 0 ? hexString.slice(2) : hexString);
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert human-readable amount to blockchain raw amount
 * @param {string|number} amount - Amount with decimals (e.g. "0.001")
 * @param {number} decimals - Number of decimals for the token
 * @returns {string} Raw amount as string
 */
function toRawAmount(amount, decimals) {
  // Ensure we return a string to avoid BigInt serialization issues
  return Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString();
}

/**
 * Convert blockchain raw amount to human-readable amount
 * @param {string} rawAmount - Raw amount from blockchain
 * @param {number} decimals - Number of decimals for the token
 * @returns {string} Human-readable amount
 */
function fromRawAmount(rawAmount, decimals) {
  return (parseInt(rawAmount) / Math.pow(10, decimals)).toFixed(decimals);
}

/**
 * Generate a unique ID for transactions or operations
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} Unique ID
 */
function generateUniqueId(prefix = '') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `${prefix}${timestamp}-${random}`;
}

/**
 * Format a date as a human-readable string
 * @param {Date|string} date - Date object or ISO string
 * @param {boolean} includeTime - Whether to include time
 * @returns {string} Formatted date string
 */
function formatDate(date, includeTime = false) {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) {
    return 'Invalid date';
  }
  
  const dateStr = d.toLocaleDateString();
  
  if (includeTime) {
    return `${dateStr} ${d.toLocaleTimeString()}`;
  }
  
  return dateStr;
}

export {
  hexToBytes,
  sleep,
  toRawAmount,
  fromRawAmount,
  generateUniqueId,
  formatDate
};