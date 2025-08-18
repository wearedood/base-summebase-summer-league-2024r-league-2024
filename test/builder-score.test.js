/**
 * Test suite for Builder Score Tracker
 * Base Summer League 2024 - Builder Rewards Contest
 * 
 * Comprehensive tests for GitHub activity tracking and Base network integration
 */

const { expect } = require('chai');
const sinon = require('sinon');
const axios = require('axios');
const BuilderScoreTracker = require('../index');

describe('BuilderScoreTracker', () => {
  let tracker;
  let axiosStub;

  beforeEach(() => {
    tracker = new BuilderScoreTracker();
    axiosStub = sinon.stub(axios, 'get');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('GitHub Activity Tracking', () => {
    it('should track GitHub activity for valid username', async () => {
      const mockResponse = {
        data: [
          { type: 'PushEvent', created_at: new Date().toISOString() },
          { type: 'PullRequestEvent', created_at: new Date().toISOString() }
        ]
      };
      
      axiosStub.resolves(mockResponse);
      
      const result = await tracker.trackGitHubActivity('testuser');
      
      expect(result).to.have.property('totalEvents');
      expect(result).to.have.property('todayEvents');
      expect(result.todayEvents).to.be.an('array');
    });

    it('should handle GitHub API errors gracefully', async () => {
      axiosStub.rejects(new Error('API Error'));
      
      const result = await tracker.trackGitHubActivity('invaliduser');
      
      expect(result).to.be.null;
    });
  });

  describe('Base Network Integration', () => {
    it('should check Base network connectivity', async () => {
      const mockResponse = { data: { result: '0x12345' } };
      axiosStub.resolves(mockResponse);
      
      const result = await tracker.checkBaseNetwork();
      
      expect(result).to.be.a('string');
      expect(result).to.match(/^0x/);
    });

    it('should analyze contract types correctly', () => {
      const mockContracts = [
        { bytecode: 'transfer balanceOf approve' },
        { bytecode: 'tokenURI ownerOf safeTransferFrom' },
        { bytecode: 'swap liquidity addLiquidity' }
      ];
      
      const result = tracker.analyzeContractTypes(mockContracts);
      
      expect(result).to.have.property('ERC20', 1);
      expect(result).to.have.property('ERC721', 1);
      expect(result).to.have.property('DeFi', 1);
    });
  });

  describe('Builder Score Calculation', () => {
    it('should calculate comprehensive builder score', async () => {
      // Mock GitHub activity
      const githubStub = sinon.stub(tracker, 'trackGitHubActivity').resolves({
        totalEvents: 10,
        todayEvents: [
          { type: 'PushEvent' },
          { type: 'PullRequestEvent' },
          { type: 'IssuesEvent' }
        ]
      });
      
      // Mock Base network check
      const baseStub = sinon.stub(tracker, 'checkBaseNetwork').resolves('0x12345');
      
      const result = await tracker.calculateBuilderScore('testuser');
      
      expect(result).to.have.property('totalScore');
      expect(result).to.have.property('breakdown');
      expect(result.totalScore).to.be.a('number');
      expect(result.totalScore).to.be.greaterThan(0);
    });

    it('should weight different activities correctly', async () => {
      const githubStub = sinon.stub(tracker, 'trackGitHubActivity').resolves({
        totalEvents: 5,
        todayEvents: [
          { type: 'PullRequestEvent' }, // 25 points
          { type: 'PushEvent' }, // 10 points
          { type: 'IssuesEvent' } // 15 points
        ]
      });
      
      const baseStub = sinon.stub(tracker, 'checkBaseNetwork').resolves('0x12345');
      
      const result = await tracker.calculateBuilderScore('testuser');
      
      expect(result.breakdown.github.pullRequests).to.equal(25);
      expect(result.breakdown.github.commits).to.equal(30); // 3 events * 10
      expect(result.breakdown.base.networkActivity).to.equal(20);
    });
  });

  describe('Contract Analysis', () => {
    it('should detect ERC20 contracts', () => {
      const contract = { bytecode: 'function transfer(address to, uint256 amount) function balanceOf(address account)' };
      
      const result = tracker.detectContractType(contract);
      
      expect(result).to.equal('ERC20');
    });

    it('should detect ERC721 contracts', () => {
      const contract = { bytecode: 'function tokenURI(uint256 tokenId) function ownerOf(uint256 tokenId)' };
      
      const result = tracker.detectContractType(contract);
      
      expect(result).to.equal('ERC721');
    });

    it('should detect DeFi contracts', () => {
      const contract = { bytecode: 'function swap(uint256 amount) function liquidity() function addLiquidity()' };
      
      const result = tracker.detectContractType(contract);
      
      expect(result).to.equal('DeFi');
    });

    it('should default to Other for unknown contracts', () => {
      const contract = { bytecode: 'function unknownFunction()' };
      
      const result = tracker.detectContractType(contract);
      
      expect(result).to.equal('Other');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle empty GitHub activity', async () => {
      axiosStub.resolves({ data: [] });
      
      const result = await tracker.trackGitHubActivity('emptyuser');
      
      expect(result.todayEvents).to.have.length(0);
      expect(result.totalEvents).to.equal(0);
    });

    it('should handle network timeouts gracefully', async () => {
      axiosStub.rejects(new Error('ETIMEDOUT'));
      
      const result = await tracker.checkBaseNetwork();
      
      expect(result).to.be.null;
    });

    it('should validate input parameters', async () => {
      const result = await tracker.trackGitHubActivity('');
      
      expect(result).to.be.null;
    });
  });
});

// Integration tests for real Base network (optional, for development)
describe('Integration Tests (Base Network)', () => {
  let tracker;

  before(() => {
    tracker = new BuilderScoreTracker();
  });

  it('should connect to actual Base network', async function() {
    this.timeout(10000); // Increase timeout for network calls
    
    const result = await tracker.checkBaseNetwork();
    
    // Only run if network is available
    if (result) {
      expect(result).to.be.a('string');
      expect(result).to.match(/^0x[0-9a-fA-F]+$/);
    }
  });
});
