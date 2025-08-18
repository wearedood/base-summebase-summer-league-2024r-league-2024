#!/usr/bin/env node

/**
 * Base Summer League 2024 - Builder Rewards Tracker
 * Main entry point for the Builder Score optimization tools
 */

const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

class BuilderScoreTracker {
  constructor() {
    this.baseRpcUrl = 'https://mainnet.base.org';
    this.provider = new ethers.JsonRpcProvider(this.baseRpcUrl);
    this.githubApiUrl = 'https://api.github.com';
  }

  async trackGitHubActivity(username) {
    try {
      console.log(`🔍 Tracking GitHub activity for: ${username}`);
      const response = await axios.get(`${this.githubApiUrl}/users/${username}/events`);
      const events = response.data;
      
      const today = new Date().toISOString().split('T')[0];
      const todayEvents = events.filter(event => event.created_at.startsWith(today));
      
      console.log(`📊 Today's GitHub activity: ${todayEvents.length} events`);
      return { totalEvents: events.length, todayEvents: todayEvents.length };
    } catch (error) {
      console.error('❌ Error tracking GitHub activity:', error.message);
      return null;
    }
  }

  async checkBaseNetwork() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`🔗 Base network block number: ${blockNumber}`);
      return blockNumber;
    } catch (error) {
      console.error('❌ Error connecting to Base network:', error.message);
      return null;
    }
  }

  displayOptimizationTips() {
    console.log('
🎯 Builder Score Optimization Tips:');
    console.log('1. 📝 Create meaningful commits daily');
    console.log('2. 🔄 Submit pull requests to crypto repositories');
    console.log('3. 📚 Add comprehensive documentation');
    console.log('4. 🌟 Star and fork relevant Base ecosystem projects');
  }

  async run() {
    console.log('🏆 Base Summer League 2024 - Builder Rewards Tracker');
    console.log('=' .repeat(50));
    
    await this.checkBaseNetwork();
    const username = process.env.GITHUB_USERNAME || 'wearedood';
    await this.trackGitHubActivity(username);
    this.displayOptimizationTips();
    
    console.log('
✅ Tracking complete! Keep building! 🚀');
  }

    // Enhanced Base network integration
  async checkBaseContracts(address) {
    try {
      console.log(`🔍 Checking Base contracts for address: ${address}`);
      const response = await axios.get(`${this.baseRpcUrl}/api/v1/accounts/${address}/contracts`);
      const contracts = response.data;
      
      console.log(`📊 Found ${contracts.length} deployed contracts`);
      return {
        totalContracts: contracts.length,
        recentContracts: contracts.filter(c => {
          const deployDate = new Date(c.created_at);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return deployDate > weekAgo;
        }),
        contractTypes: this.analyzeContractTypes(contracts)
      };
    } catch (error) {
      console.error('❌ Error checking Base contracts:', error.message);
      return null;
    }
  }

    analyzeContractTypes(contracts) {
    const types = {};
    contracts.forEach(contract => {
      const type = this.detectContractType(contract);
      types[type] = (types[type] || 0) + 1;
    });
    return types;
  }

  detectContractType(contract) {
    const code = contract.bytecode || '';
    if (code.includes('transfer') && code.includes('balanceOf')) return 'ERC20';
    if (code.includes('tokenURI') && code.includes('ownerOf')) return 'ERC721';
    if (code.includes('swap') && code.includes('liquidity')) return 'DeFi';
    return 'Other';
  }
}

if (require.main === module) {
  const tracker = new BuilderScoreTracker();
  tracker.run().catch(console.error);
}

module.exports = BuilderScoreTracker;
