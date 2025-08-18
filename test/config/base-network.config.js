/**
 * Base Network Configuration for Builder Score Tracker
 * Base Summer League 2024 - Builder Rewards Contest
 * 
 * Optimized configuration for maximum Builder Score tracking
 */

module.exports = {
  // Base Network Configuration
  baseNetwork: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    currency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  },

  // Builder Score Optimization Settings
  builderScore: {
    weights: {
      githubCommits: 10,
      pullRequests: 25,
      issueCreation: 15,
      codeReviews: 20,
      baseContracts: 50,
      communityEngagement: 30
    },
    
    // Minimum thresholds for scoring
    thresholds: {
      dailyCommits: 3,
      weeklyPullRequests: 2,
      monthlyContracts: 1
    },
    
    // Bonus multipliers for high-impact activities
    bonuses: {
      consecutiveDays: 1.2,
      weekendActivity: 1.1,
      majorContribution: 2.0,
      firstTimeContributor: 1.5
    }
  },

  // GitHub Integration Settings
  github: {
    apiUrl: 'https://api.github.com',
    rateLimit: 5000,
    retryAttempts: 3,
    timeout: 10000,
    
    // Repository categories for scoring
    repositoryTypes: {
      defi: ['uniswap', 'aave', 'compound', 'curve'],
      infrastructure: ['base', 'ethereum', 'layer2'],
      tools: ['hardhat', 'foundry', 'truffle'],
      nft: ['opensea', 'nft', 'erc721', 'erc1155']
    }
  },

  // Contest-specific settings
  contest: {
    startDate: '2024-08-01T00:00:00Z',
    endDate: '2025-08-31T23:59:59Z',
    timezone: 'UTC',
    
    // Final sprint optimization (last 24 hours)
    finalSprint: {
      multiplier: 1.5,
      priorityActivities: [
        'smart_contract_deployment',
        'major_pull_request',
        'documentation_update',
        'community_contribution'
      ]
    }
  },

  // Smart Contract Categories for Base
  contractTypes: {
    defi: {
      keywords: ['swap', 'liquidity', 'yield', 'farming', 'lending'],
      scoreMultiplier: 2.0
    },
    nft: {
      keywords: ['tokenURI', 'ownerOf', 'safeTransferFrom'],
      scoreMultiplier: 1.5
    },
    dao: {
      keywords: ['governance', 'vote', 'proposal', 'delegate'],
      scoreMultiplier: 1.8
    },
    infrastructure: {
      keywords: ['bridge', 'oracle', 'registry', 'factory'],
      scoreMultiplier: 2.2
    }
  },

  // API Endpoints
  endpoints: {
    builderScore: '/api/v1/builder-score',
    githubActivity: '/api/v1/github/activity',
    baseContracts: '/api/v1/base/contracts',
    leaderboard: '/api/v1/leaderboard'
  },

  // Caching Configuration
  cache: {
    ttl: 300, // 5 minutes
    maxSize: 1000,
    strategy: 'lru'
  },

  // Logging Configuration
  logging: {
    level: 'info',
    format: 'json',
    destinations: ['console', 'file'],
    maxFileSize: '10MB',
    maxFiles: 5
  },

  // Performance Optimization
  performance: {
    batchSize: 100,
    concurrency: 5,
    requestDelay: 100,
    maxRetries: 3
  },

  // Security Settings
  security: {
    rateLimiting: true,
    apiKeyRequired: false,
    corsEnabled: true,
    allowedOrigins: ['https://builderscore.xyz', 'https://base.org']
  }
};

// Export additional utility functions
module.exports.getOptimalStrategy = function(timeRemaining) {
  if (timeRemaining < 3600000) { // Less than 1 hour
    return {
      priority: 'high_impact_commits',
      activities: ['smart_contract_deployment', 'major_documentation'],
      frequency: 'every_15_minutes'
    };
  } else if (timeRemaining < 7200000) { // Less than 2 hours
    return {
      priority: 'consistent_activity',
      activities: ['code_improvements', 'test_additions', 'documentation'],
      frequency: 'every_30_minutes'
    };
  }
  
  return {
    priority: 'sustainable_growth',
    activities: ['feature_development', 'community_engagement'],
    frequency: 'hourly'
  };
};
