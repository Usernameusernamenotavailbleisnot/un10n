/**
 * @typedef {Object} GasPrice
 * @property {string} amount - Gas price amount
 * @property {string} denom - Gas price denomination
 */

/**
 * @typedef {Object} ChainConfig
 * @property {string} chainId - Chain identifier
 * @property {string} rpcEndpoint - RPC endpoint URL
 * @property {string} prefix - Address prefix
 * @property {string} denom - Token denomination
 * @property {GasPrice} gasPrice - Gas price configuration
 * @property {number} decimals - Token decimals
 */

/**
 * @type {Object.<string, ChainConfig>}
 */
const chains = {
    UNION: {
      chainId: "union-testnet-9",
      rpcEndpoint: "https://union-testnet-rpc.polkachu.com/",
      prefix: "union",
      denom: "muno",
      gasPrice: { amount: "0.03", denom: "muno" },
      decimals: 6
    },
    BABYLON: {
      chainId: "bbn-test-5",
      rpcEndpoint: "https://babylon-testnet-rpc.nodes.guru",
      prefix: "bbn",
      denom: "ubbn",
      gasPrice: { amount: "0.025", denom: "ubbn" },
      decimals: 6
    },
    STARGAZE: {
      chainId: "elgafar-1",
      rpcEndpoint: "https://rpc.testcosmos.directory/stargazetestnet",
      prefix: "stars",
      denom: "ustars",
      gasPrice: { amount: "0.025", denom: "ustars" },
      decimals: 6
    },
    STRIDE: {
      chainId: "stride-internal-1",
      rpcEndpoint: "https://stride.testnet-1.stridenet.co",
      prefix: "stride",
      denom: "ustrd",
      gasPrice: { amount: "0.025", denom: "ustrd" },
      decimals: 6
    }
  };
  
  /**
   * Validates chain configurations
   * @param {Object.<string, ChainConfig>} chains - Chain configuration object
   * @throws {Error} If validation fails
   */
  function validateChains(chains) {
    if (!chains || typeof chains !== 'object') {
      throw new Error('Chains configuration must be an object');
    }
    
    if (Object.keys(chains).length === 0) {
      throw new Error('Chains configuration cannot be empty');
    }
    
    // Validate each chain configuration
    for (const [chainName, chainConfig] of Object.entries(chains)) {
      const requiredFields = [
        'chainId', 'rpcEndpoint', 'prefix', 'denom', 'gasPrice', 'decimals'
      ];
      
      // Check for missing required fields
      const missingFields = requiredFields.filter(field => !chainConfig[field]);
      if (missingFields.length > 0) {
        throw new Error(`Invalid chain configuration for ${chainName}. Missing required fields: ${missingFields.join(', ')}`);
      }
      
      // Validate gasPrice structure
      const { gasPrice } = chainConfig;
      if (!gasPrice.amount || !gasPrice.denom) {
        throw new Error(`Invalid gasPrice configuration for ${chainName}. Must include amount and denom.`);
      }
      
      // Validate decimals
      if (typeof chainConfig.decimals !== 'number' || chainConfig.decimals < 0) {
        throw new Error(`Invalid decimals configuration for ${chainName}. Must be a non-negative number.`);
      }
      
      // Validate URL format for rpcEndpoint
      try {
        new URL(chainConfig.rpcEndpoint);
      } catch (error) {
        throw new Error(`Invalid rpcEndpoint for ${chainName}: ${chainConfig.rpcEndpoint}`);
      }
    }
  }
  
  // Validate the chains
  validateChains(chains);
  
  export default chains;