/**
 * @typedef {Object} DailyQuest
 * @property {number} days - Number of days required
 * @property {number} xp - Experience points awarded
 */

/**
 * @typedef {Object} TransferQuest
 * @property {string} name - Quest name
 * @property {number} count - Number of transfers required
 * @property {number} xp - Experience points awarded
 */

/**
 * @typedef {Object} CrossChainQuest
 * @property {string} name - Quest name
 * @property {string[]} path - Path of chains to transfer through
 * @property {number} xp - Experience points awarded
 */

/**
 * @type {Object} Quest configuration
 */
const quests = {
    DAILY_INTERACTION: {
      UNION: {
        CURIOUS: { days: 3, xp: 5 },
        DIAMOND_HANDS: { days: 5, xp: 10 },
        TESTNET_DEGEN: { days: 10, xp: 15 },
        UNION_MAXI: { days: 15, xp: 20 }
      },
      BABYLON: {
        BABY: { days: 3, xp: 5 },
        HANGING_GARDENS: { days: 5, xp: 10 },
        HAMMURABI: { days: 10, xp: 15 },
        NEBUCHADNEZZAR: { days: 15, xp: 20 }
      }
    },
    
    TRANSFER: {
      UNION: [
        { name: "INITIATE", count: 1, xp: 5 },
        { name: "APPRENTICE", count: 10, xp: 5 },
        { name: "JOURNEYMAN", count: 25, xp: 5 },
        { name: "CHAMPION", count: 50, xp: 5 },
        { name: "MAESTRO", count: 250, xp: 5 },
        { name: "GRAND_MASTER", count: 500, xp: 15 }
      ],
      BABYLON: [
        { name: "BEGINNER", count: 1, xp: 5 },
        { name: "DABBLER", count: 10, xp: 5 },
        { name: "EXPLORER", count: 25, xp: 5 },
        { name: "NAVIGATOR", count: 50, xp: 5 },
        { name: "GARDENS_HERO", count: 250, xp: 5 },
        { name: "TOWER", count: 500, xp: 15 }
      ]
    },
    
    CROSS_CHAIN: [
      { 
        name: "CHAIN_REACTION", 
        path: ["UNION", "BABYLON"], 
        xp: 5 
      },
      { 
        name: "TRIPLE_THREAT", 
        path: ["UNION", "BABYLON", "STARGAZE"], 
        xp: 5 
      },
      { 
        name: "SIX_CHAINS", 
        path: ["UNION", "BABYLON", "STARGAZE", "STRIDE", "BABYLON", "UNION"], 
        xp: 5 
      }
    ]
  };
  
  // Default transfer amount
  const DEFAULT_TRANSFER_AMOUNT = "0.001";
  
  /**
   * Validates quest configurations
   * @param {Object} quests - Quest configuration object
   * @throws {Error} If validation fails
   */
  function validateQuests(quests) {
    if (!quests || typeof quests !== 'object') {
      throw new Error('Quests configuration must be an object');
    }
    
    // Check for required quest types
    const requiredQuestTypes = ['DAILY_INTERACTION', 'TRANSFER', 'CROSS_CHAIN'];
    const missingQuestTypes = requiredQuestTypes.filter(type => !quests[type]);
    if (missingQuestTypes.length > 0) {
      throw new Error(`Missing required quest types: ${missingQuestTypes.join(', ')}`);
    }
    
    // Validate daily interaction quests
    for (const [chainName, dailyQuests] of Object.entries(quests.DAILY_INTERACTION)) {
      for (const [questName, questConfig] of Object.entries(dailyQuests)) {
        if (!questConfig.days || !questConfig.xp) {
          throw new Error(`Invalid daily interaction quest config for ${chainName}.${questName}`);
        }
      }
    }
    
    // Validate transfer quests
    for (const [chainName, transferQuests] of Object.entries(quests.TRANSFER)) {
      if (!Array.isArray(transferQuests)) {
        throw new Error(`Transfer quests for ${chainName} must be an array`);
      }
      
      transferQuests.forEach((quest, index) => {
        if (!quest.name || quest.count === undefined || quest.xp === undefined) {
          throw new Error(`Invalid transfer quest config at ${chainName}[${index}]`);
        }
      });
    }
    
    // Validate cross-chain quests
    if (!Array.isArray(quests.CROSS_CHAIN)) {
      throw new Error('CROSS_CHAIN quests must be an array');
    }
    
    quests.CROSS_CHAIN.forEach((quest, index) => {
      if (!quest.name || !Array.isArray(quest.path) || quest.xp === undefined) {
        throw new Error(`Invalid cross-chain quest config at CROSS_CHAIN[${index}]`);
      }
      
      if (quest.path.length < 2) {
        throw new Error(`Cross-chain quest ${quest.name} must have at least 2 chains in path`);
      }
    });
  }
  
  // Validate the quests
  validateQuests(quests);
  
  export default quests;
  export { DEFAULT_TRANSFER_AMOUNT };