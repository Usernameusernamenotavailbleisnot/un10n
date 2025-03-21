// core/faucet/proxyManager.js
import fs from 'fs';
import path from 'path';
import logger from '../../utils/logger.js';

/**
 * Service for managing proxies - optimized for IPRoyal format
 */
class ProxyManager {
  constructor() {
    this.proxies = [];
    this.currentIndex = 0;
    this.proxyFile = path.join(process.cwd(), 'proxy.txt');
  }

  /**
   * Load proxies from proxy.txt file
   * @returns {Promise<string[]>} Array of proxies
   */
  async loadProxies() {
    try {
      logger.info(`Attempting to load proxies from: ${this.proxyFile}`);
      
      // Use synchronous fs to ensure clearer errors
      if (!fs.existsSync(this.proxyFile)) {
        logger.error(`proxy.txt file not found at: ${this.proxyFile}`);
        
        // Create example file
        const template = `# Add your proxies here (one per line)
# Supported formats:
# - ip:port (example: 123.45.67.89:8080)
# - ip:port:username:password (example: 123.45.67.89:8080:user:pass)
# - username:password:ip:port (IPRoyal format)

# Add your proxy here
`;
        fs.writeFileSync(this.proxyFile, template, 'utf8');
        logger.info(`Example proxy.txt file has been created at: ${this.proxyFile}`);
        return [];
      }
      
      // Read file
      const data = fs.readFileSync(this.proxyFile, 'utf8');
      logger.info(`proxy.txt file found, size: ${data.length} bytes`);
      
      // Parse proxies
      this.proxies = data.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      
      if (this.proxies.length === 0) {
        logger.warn(`No proxies found in ${this.proxyFile}`);
        return [];
      }
      
      logger.info(`Successfully loaded ${this.proxies.length} proxies from file`);
      
      // Log some proxies for debugging
      const maxToShow = Math.min(this.proxies.length, 2);
      for (let i = 0; i < maxToShow; i++) {
        const format = this.detectProxyFormat(this.proxies[i]);
        logger.info(`[Proxy #${i+1}] (Format: ${format})`);
        
        // Test URL parsing
        this.getProxyUrl(this.proxies[i]);
      }
      
      return this.proxies;
    } catch (error) {
      logger.error(`Error reading proxy file: ${error.message}`);
      return [];
    }
  }

  /**
   * Get the next proxy in rotation
   * @returns {string|null} Next proxy or null if no proxies available
   */
  getNextProxy() {
    if (this.proxies.length === 0) {
      logger.warn("No proxies available. Make sure proxy.txt contains valid proxies.");
      return null;
    }
    
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    
    const format = this.detectProxyFormat(proxy);
    logger.info(`Using proxy (Format: ${format})`);
    
    return proxy;
  }

  /**
   * Detect the format of a proxy string
   * @param {string} proxyString - Proxy string
   * @returns {string} Format type: 'ip:port', 'ip:port:user:pass', 'user:pass:ip:port', or 'unknown'
   */
  detectProxyFormat(proxyString) {
    if (!proxyString) return 'unknown';
    
    const parts = proxyString.split(':');
    if (parts.length < 2) return 'unknown';
    
    // Check if the format is ip:port
    if (parts.length === 2) {
      return 'ip:port';
    }
    
    // Check if the format is ip:port:user:pass or user:pass:ip:port
    if (parts.length === 4) {
      // For IPRoyal, it's nearly always user:pass:ip:port format
      // Check if the first part contains "user-" or underscore which is typical for IPRoyal
      if (parts[0].includes('user-') || parts[0].includes('_')) {
        return 'user:pass:ip:port';
      }
      
      // Regular check for IP address pattern
      if (/\d+\.\d+/.test(parts[0])) {
        return 'ip:port:user:pass';
      } else {
        return 'user:pass:ip:port';
      }
    }
    
    return 'unknown';
  }

  /**
   * Get proxy URL format for HTTP client
   * @param {string} proxyString - Proxy string
   * @returns {string|null} Full proxy URL or null if invalid
   */
  getProxyUrl(proxyString) {
    if (!proxyString) return null;
    
    const format = this.detectProxyFormat(proxyString);
    const parts = proxyString.split(':');
    
    switch (format) {
      case 'ip:port':
        return `http://${parts[0]}:${parts[1]}`;
        
      case 'ip:port:user:pass':
        return `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
        
      case 'user:pass:ip:port':
        // IPRoyal format
        return `http://${parts[0]}:${parts[1]}@${parts[2]}:${parts[3]}`;
        
      default:
        logger.warn(`Unrecognized proxy format: ${proxyString}`);
        return null;
    }
  }
}

export default ProxyManager;