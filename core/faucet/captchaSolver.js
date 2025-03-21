// core/faucet/captchaSolver.js
import https from 'https';
import { createWalletLogger } from '../../utils/logger.js';

/**
 * Service for solving Cloudflare Turnstile captchas using Capsolver
 */
class CaptchaSolver {
  /**
   * Create a new CaptchaSolver
   * @param {string} apiKey - Capsolver API key
   * @param {number} walletIndex - Optional wallet index for consistent logging
   */
  constructor(apiKey, walletIndex = null) {
    this.apiKey = apiKey;
    this.logger = createWalletLogger(walletIndex);
    
    // Validate API key immediately
    if (!this.apiKey) {
      throw new Error('Capsolver API key is required');
    }
    
    this.logger.info('CaptchaSolver initialized with API key');
  }

  /**
   * Make a request to the Capsolver API
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Promise<Object>} API response
   */
  makeRequest(endpoint, data) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      
      const options = {
        hostname: 'api.capsolver.com',
        port: 443,
        path: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': postData.length
        }
      };
      
      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            
            // Check for API errors
            if (parsedData.errorId > 0) {
              reject(new Error(`Capsolver API error: ${parsedData.errorDescription || 'Unknown error'}`));
              return;
            }
            
            resolve(parsedData);
          } catch (error) {
            reject(new Error(`Failed to parse Capsolver response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Capsolver request failed: ${error.message}`));
      });
      
      req.write(postData);
      req.end();
    });
  }

  /**
   * Get account balance
   * @returns {Promise<number>} Account balance
   */
  async getBalance() {
    this.logger.info('Checking Capsolver account balance...');
    
    const response = await this.makeRequest('/getBalance', {
      clientKey: this.apiKey
    });
    
    this.logger.info(`Capsolver account balance: ${response.balance}`);
    return response.balance;
  }

  /**
   * Solve a Cloudflare Turnstile captcha
   * @param {string} siteKey - Turnstile sitekey
   * @param {string} url - URL of the page with captcha
   * @returns {Promise<string>} Captcha token
   */
  async solveTurnstile(siteKey, url) {
    this.logger.info(`Solving Turnstile captcha for ${url} with sitekey ${siteKey}`);
    
    // Prepare the task (always proxyless)
    const taskData = {
      clientKey: this.apiKey,
      task: {
        type: "AntiTurnstileTaskProxyLess",
        websiteURL: url,
        websiteKey: siteKey
      }
    };
    
    // Create task
    this.logger.info('Creating Turnstile captcha task...');
    const createResponse = await this.makeRequest('/createTask', taskData);
    
    const taskId = createResponse.taskId;
    this.logger.info(`Turnstile captcha task created with ID: ${taskId}`);
    
    // Poll for task result
    let attempts = 0;
    const maxAttempts = 24; // Wait up to 2 minutes (24 * 5 seconds)
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between checks
      
      this.logger.info(`Checking captcha solution status (attempt ${attempts + 1}/${maxAttempts})...`);
      
      const getResponse = await this.makeRequest('/getTaskResult', {
        clientKey: this.apiKey,
        taskId: taskId
      });
      
      if (getResponse.status === 'ready') {
        this.logger.info('Turnstile captcha solved successfully');
        return getResponse.solution.token;
      }
      
      this.logger.info(`Captcha status: ${getResponse.status}. Waiting for solution...`);
      attempts++;
    }
    
    throw new Error('Captcha solving timed out after 2 minutes');
  }
}

export default CaptchaSolver;