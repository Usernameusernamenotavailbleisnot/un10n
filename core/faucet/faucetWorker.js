// core/faucet/faucetWorker.js
import { parentPort, workerData } from 'worker_threads';
import { createWalletLogger } from '../../utils/logger.js';
import CaptchaSolver from './captchaSolver.js';
import { StargateClient } from '@cosmjs/stargate';
import { sleep } from '../../utils/common.js';
import https from 'https';
import fs from 'fs';
import path from 'path';

// Create worker logger
const logger = createWalletLogger(workerData.walletIndex);

// Worker entry point
async function processFaucetRequest() {
  logger.info(`Worker ${workerData.workerId}: Starting faucet request for wallet ${workerData.walletIndex + 1}`);
  
  try {
    // Process the request
    const result = await requestFaucet();
    
    // Send the result back to the main thread
    parentPort.postMessage({
      success: true,
      result: result
    });
  } catch (error) {
    logger.error(`Worker ${workerData.workerId}: Error processing faucet request: ${error.message}`);
    
    // Send error back to the main thread
    parentPort.postMessage({
      success: false,
      error: error.message
    });
  }
}

// Process faucet request
async function requestFaucet() {
  const {
    walletIndex,
    apiKey,
    address,
    faucet,
    chainConfig,
    siteKey,
    faucetReferrer,
    faucetEndpoint,
    maxAttempts
  } = workerData;
  
  // Initialize captcha solver
  const captchaSolver = new CaptchaSolver(apiKey, walletIndex);
  
  // Load proxy
  const proxy = loadProxyFromFile();
  
  // Check initial balance
  const initialBalance = await getBalance(address, chainConfig.endpoint, chainConfig.denom);
  logger.info(`Initial ${faucet} balance: ${initialBalance}`);
  
  // Make faucet requests until successful or max attempts reached
  let success = false;
  let attempts = 0;
  let result = null;
  
  while (!success && (maxAttempts === 0 || attempts < maxAttempts)) {
    attempts++;
    logger.info(`Faucet attempt ${attempts}${maxAttempts > 0 ? `/${maxAttempts}` : ''}`);
    
    try {
      // Solve captcha WITHOUT proxy (always proxyless for captcha)
      logger.info(`Solving Turnstile captcha without proxy...`);
      const captchaToken = await captchaSolver.solveTurnstile(
        siteKey,
        faucetReferrer
      );
      
      if (!captchaToken) {
        logger.error('Failed to solve captcha, no token received');
        continue;
      }
      
      logger.info('Captcha solved successfully, submitting faucet request...');
      
      // Request faucet using proxy if available
      result = await sendFaucetRequest(
        chainConfig.chainId,
        chainConfig.denom,
        address,
        captchaToken,
        faucetEndpoint,
        proxy
      );
      
      logger.info(`Faucet response: ${JSON.stringify(result)}`);
      
      // Check if the response contains an error
      if (result?.data?.send === 'ERROR') {
        logger.warn('Faucet returned ERROR, may need to wait before trying again');
      }
      
      // Wait for transaction to be processed
      logger.info('Waiting 60 seconds for transaction to be processed...');
      await sleep(60000);
      
      // Check if balance increased
      const newBalance = await getBalance(address, chainConfig.endpoint, chainConfig.denom);
      logger.info(`New ${faucet} balance: ${newBalance}`);
      
      if (newBalance > initialBalance) {
        success = true;
        logger.info(`Successfully received ${faucet} tokens! Balance increased from ${initialBalance} to ${newBalance}`);
      } else {
        logger.warn(`Balance did not increase after faucet request`);
        
        // Wait before next attempt
        if (!success && (maxAttempts === 0 || attempts < maxAttempts)) {
          logger.info('Waiting 15 seconds before next attempt...');
          await sleep(15000);
        }
      }
    } catch (error) {
      logger.error(`Error in faucet request attempt ${attempts}: ${error.message}`);
      
      // Wait before next attempt
      if (!success && (maxAttempts === 0 || attempts < maxAttempts)) {
        logger.info('Waiting 15 seconds before next attempt due to error...');
        await sleep(15000);
      }
    }
  }
  
  if (success) {
    logger.info(`Successfully completed ${faucet} faucet request after ${attempts} attempt(s)`);
  } else {
    logger.error(`Failed to complete ${faucet} faucet request after ${attempts} attempt(s)`);
  }
  
  return {
    success,
    attempts,
    result,
    initialBalance,
    faucet
  };
}

/**
 * Get wallet balance
 */
async function getBalance(address, endpoint, denom) {
  try {
    const client = await StargateClient.connect(endpoint);
    const balances = await client.getAllBalances(address);
    
    const balance = balances.find(b => b.denom === denom);
    return balance ? parseInt(balance.amount) : 0;
  } catch (error) {
    logger.error(`Error checking balance: ${error.message}`);
    throw error;
  }
}

/**
 * Load proxy from proxy.txt file
 */
function loadProxyFromFile() {
  try {
    const proxyFile = path.join(process.cwd(), 'proxy.txt');
    logger.info(`Looking for proxy file at: ${proxyFile}`);
    
    if (!fs.existsSync(proxyFile)) {
      logger.error(`proxy.txt file not found at: ${proxyFile}`);
      return null;
    }
    
    const data = fs.readFileSync(proxyFile, 'utf8');
    logger.info(`proxy.txt file found, size: ${data.length} bytes`);
    
    if (data.length === 0) {
      logger.warn('proxy.txt file is empty');
      return null;
    }
    
    // Parse proxies
    const proxies = data.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    
    if (proxies.length === 0) {
      logger.warn('No valid proxy lines found in proxy.txt');
      return null;
    }
    
    // Get a random proxy from the list
    const randomIndex = Math.floor(Math.random() * proxies.length);
    return proxies[randomIndex];
  } catch (error) {
    logger.error(`Error loading proxy from file: ${error.message}`);
    return null;
  }
}

/**
 * Request tokens from the faucet
 */
async function sendFaucetRequest(chainId, denom, address, captchaToken, faucetEndpoint, proxyString = null) {
  logger.info(`Requesting faucet for ${chainId} (${denom}) to address ${address}`);
  
  const payload = {
    query: "mutation UnoFaucetMutation($chainId: String!, $denom: String!, $address: String!, $captchaToken: String!) {\n  send(\n    chainId: $chainId\n    denom: $denom\n    address: $address\n    captchaToken: $captchaToken\n  )\n}",
    variables: {
      chainId,
      denom,
      address,
      captchaToken
    },
    operationName: "UnoFaucetMutation"
  };
  
  // Import dynamically to support ES modules
  const { default: fetch } = await import('node-fetch');
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/graphql-response+json, application/json',
      'Origin': 'https://app.union.build',
      'Referer': 'https://app.union.build/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
    },
    body: JSON.stringify(payload),
    timeout: 120000 // 2 minute timeout
  };
  
  // Set up agent for proxy if available
  if (proxyString) {
    logger.info(`Setting up proxy for request`);
    
    try {
      // Parse the proxy string
      const parts = proxyString.split(':');
      
      if (parts.length !== 4) {
        logger.warn(`Invalid proxy format: expected 4 parts but got ${parts.length}`);
      } else {
        // Dynamic import for ESM compatibility
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        
        // For IPRoyal format (username:password:host:port)
        const proxyUrl = `http://${parts[0]}:${parts[1]}@${parts[2]}:${parts[3]}`;
        
        // Create the agent and add to options
        const agent = new HttpsProxyAgent(proxyUrl);
        options.agent = agent;
        
        logger.info('Proxy agent set up successfully');
      }
    } catch (error) {
      logger.error(`Error setting up proxy: ${error.message}`);
      if (error.stack) {
        logger.error(`Stack: ${error.stack}`);
      }
    }
  } else {
    logger.warn('No proxy available, proceeding without proxy');
  }
  
  // Make the request with fetch
  try {
    logger.info('Sending request to faucet API...');
    const response = await fetch(faucetEndpoint, options);
    
    logger.info(`Response status: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    logger.error(`Faucet API request failed: ${error.message}`);
    if (error.stack) {
      logger.error(`Stack: ${error.stack}`);
    }
    throw error;
  }
}

// Start processing
processFaucetRequest().catch(error => {
  logger.error(`Worker encountered an unhandled error: ${error.message}`);
  if (error.stack) {
    logger.error(`Stack trace: ${error.stack}`);
  }
  
  // Send error back to the main thread
  parentPort.postMessage({
    success: false,
    error: error.message
  });
});