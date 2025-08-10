const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("YieldFarmingStrategy", function () {
  // Fixture for deploying the contract
  async function deployYieldFarmingStrategyFixture() {
    const [owner, user1, user2, protocol1, protocol2] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("Test Token", "TEST", ethers.utils.parseEther("1000000"));

    // Deploy YieldFarmingStrategy
    const YieldFarmingStrategy = await ethers.getContractFactory("YieldFarmingStrategy");
    const strategy = await YieldFarmingStrategy.deploy(owner.address);

    // Mint tokens to users
    await token.mint(user1.address, ethers.utils.parseEther("10000"));
    await token.mint(user2.address, ethers.utils.parseEther("10000"));

    return { strategy, token, owner, user1, user2, protocol1, protocol2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { strategy, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      expect(await strategy.owner()).to.equal(owner.address);
    });

    it("Should initialize with correct default parameters", async function () {
      const { strategy } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      expect(await strategy.maxRiskScore()).to.equal(70);
      expect(await strategy.minAPY()).to.equal(500);
      expect(await strategy.rebalanceThreshold()).to.equal(1000);
    });
  });

  describe("Protocol Management", function () {
    it("Should allow owner to add protocols", async function () {
      const { strategy, protocol1, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      await expect(strategy.connect(owner).addProtocol(
        protocol1.address,
        "Test Protocol",
        50,
        ethers.utils.parseEther("100")
      )).to.not.be.reverted;

      const protocolInfo = await strategy.getProtocolInfo(protocol1.address);
      expect(protocolInfo.name).to.equal("Test Protocol");
      expect(protocolInfo.riskScore).to.equal(50);
      expect(protocolInfo.active).to.be.true;
    });

    it("Should reject protocols with invalid parameters", async function () {
      const { strategy, protocol1, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      // Test invalid risk score
      await expect(strategy.connect(owner).addProtocol(
        protocol1.address,
        "Test Protocol",
        150, // Invalid risk score > 100
        ethers.utils.parseEther("100")
      )).to.be.revertedWith("Risk score too high");

      // Test zero address
      await expect(strategy.connect(owner).addProtocol(
        ethers.constants.AddressZero,
        "Test Protocol",
        50,
        ethers.utils.parseEther("100")
      )).to.be.revertedWith("Invalid protocol");
    });

    it("Should prevent non-owners from adding protocols", async function () {
      const { strategy, protocol1, user1 } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      await expect(strategy.connect(user1).addProtocol(
        protocol1.address,
        "Test Protocol",
        50,
        ethers.utils.parseEther("100")
      )).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Position Management", function () {
    beforeEach(async function () {
      const { strategy, protocol1, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      // Add a test protocol
      await strategy.connect(owner).addProtocol(
        protocol1.address,
        "Test Protocol",
        50,
        ethers.utils.parseEther("100")
      );
    });

    it("Should allow users to open positions", async function () {
      const { strategy, token, protocol1, user1 } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      // Add protocol first
      const { owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      await strategy.connect(owner).addProtocol(
        protocol1.address,
        "Test Protocol",
        50,
        ethers.utils.parseEther("100")
      );

      const depositAmount = ethers.utils.parseEther("1000");
      
      // Approve tokens
      await token.connect(user1).approve(strategy.address, depositAmount);
      
      // Open position
      await expect(strategy.connect(user1).openPosition(
        protocol1.address,
        token.address,
        depositAmount
      )).to.emit(strategy, "PositionOpened")
        .withArgs(user1.address, protocol1.address, depositAmount);

      // Check user positions
      const positions = await strategy.getUserPositions(user1.address);
      expect(positions.length).to.equal(1);
      expect(positions[0].protocol).to.equal(protocol1.address);
      expect(positions[0].amount).to.equal(depositAmount);
      expect(positions[0].active).to.be.true;
    });

    it("Should reject positions below minimum deposit", async function () {
      const { strategy, token, protocol1, user1, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      // Add protocol with minimum deposit
      await strategy.connect(owner).addProtocol(
        protocol1.address,
        "Test Protocol",
        50,
        ethers.utils.parseEther("100")
      );

      const smallAmount = ethers.utils.parseEther("50"); // Below minimum
      
      await token.connect(user1).approve(strategy.address, smallAmount);
      
      await expect(strategy.connect(user1).openPosition(
        protocol1.address,
        token.address,
        smallAmount
      )).to.be.revertedWith("Amount too low");
    });

    it("Should reject positions in inactive protocols", async function () {
      const { strategy, token, user1 } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      const depositAmount = ethers.utils.parseEther("1000");
      
      await token.connect(user1).approve(strategy.address, depositAmount);
      
      // Try to open position in non-existent protocol
      await expect(strategy.connect(user1).openPosition(
        ethers.constants.AddressZero,
        token.address,
        depositAmount
      )).to.be.revertedWith("Protocol not active");
    });
  });

  describe("Position Closing", function () {
    it("Should allow users to close their positions", async function () {
      const { strategy, token, protocol1, user1, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      // Setup: Add protocol and open position
      await strategy.connect(owner).addProtocol(
        protocol1.address,
        "Test Protocol",
        50,
        ethers.utils.parseEther("100")
      );

      const depositAmount = ethers.utils.parseEther("1000");
      await token.connect(user1).approve(strategy.address, depositAmount);
      await strategy.connect(user1).openPosition(protocol1.address, token.address, depositAmount);

      // Close position
      await expect(strategy.connect(user1).closePosition(0))
        .to.emit(strategy, "PositionClosed")
        .withArgs(user1.address, protocol1.address, depositAmount);

      // Check position is inactive
      const positions = await strategy.getUserPositions(user1.address);
      expect(positions[0].active).to.be.false;
    });

    it("Should reject closing invalid position indices", async function () {
      const { strategy, user1 } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      await expect(strategy.connect(user1).closePosition(0))
        .to.be.revertedWith("Invalid index");
    });

    it("Should reject closing already closed positions", async function () {
      const { strategy, token, protocol1, user1, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      // Setup: Add protocol and open position
      await strategy.connect(owner).addProtocol(
        protocol1.address,
        "Test Protocol",
        50,
        ethers.utils.parseEther("100")
      );

      const depositAmount = ethers.utils.parseEther("1000");
      await token.connect(user1).approve(strategy.address, depositAmount);
      await strategy.connect(user1).openPosition(protocol1.address, token.address, depositAmount);

      // Close position once
      await strategy.connect(user1).closePosition(0);

      // Try to close again
      await expect(strategy.connect(user1).closePosition(0))
        .to.be.revertedWith("Position not active");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow users to emergency exit their positions", async function () {
      const { strategy, token, protocol1, user1, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      // Setup: Add protocol and open multiple positions
      await strategy.connect(owner).addProtocol(
        protocol1.address,
        "Test Protocol",
        50,
        ethers.utils.parseEther("100")
      );

      const depositAmount = ethers.utils.parseEther("1000");
      await token.connect(user1).approve(strategy.address, depositAmount.mul(2));
      
      await strategy.connect(user1).openPosition(protocol1.address, token.address, depositAmount);
      await strategy.connect(user1).openPosition(protocol1.address, token.address, depositAmount);

      // Emergency exit
      await expect(strategy.connect(user1).emergencyExit(user1.address))
        .to.emit(strategy, "EmergencyExit");

      // Check all positions are inactive
      const positions = await strategy.getUserPositions(user1.address);
      for (let i = 0; i < positions.length; i++) {
        expect(positions[i].active).to.be.false;
      }
    });

    it("Should allow owner to emergency exit any user", async function () {
      const { strategy, token, protocol1, user1, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      // Setup position
      await strategy.connect(owner).addProtocol(
        protocol1.address,
        "Test Protocol",
        50,
        ethers.utils.parseEther("100")
      );

      const depositAmount = ethers.utils.parseEther("1000");
      await token.connect(user1).approve(strategy.address, depositAmount);
      await strategy.connect(user1).openPosition(protocol1.address, token.address, depositAmount);

      // Owner emergency exit for user
      await expect(strategy.connect(owner).emergencyExit(user1.address))
        .to.emit(strategy, "EmergencyExit");
    });

    it("Should reject unauthorized emergency exits", async function () {
      const { strategy, user1, user2 } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      await expect(strategy.connect(user2).emergencyExit(user1.address))
        .to.be.revertedWith("Unauthorized");
    });
  });

  describe("Strategy Parameters", function () {
    it("Should allow owner to update strategy parameters", async function () {
      const { strategy, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      const newMaxRiskScore = 80;
      const newMinAPY = 600;
      
      await expect(strategy.connect(owner).updateStrategy(newMaxRiskScore, newMinAPY))
        .to.emit(strategy, "StrategyUpdated")
        .withArgs(newMaxRiskScore, newMinAPY);

      expect(await strategy.maxRiskScore()).to.equal(newMaxRiskScore);
      expect(await strategy.minAPY()).to.equal(newMinAPY);
    });

    it("Should reject invalid strategy parameters", async function () {
      const { strategy, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      await expect(strategy.connect(owner).updateStrategy(150, 600))
        .to.be.revertedWith("Risk score too high");
    });

    it("Should prevent non-owners from updating strategy", async function () {
      const { strategy, user1 } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      await expect(strategy.connect(user1).updateStrategy(80, 600))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("View Functions", function () {
    it("Should return correct user positions", async function () {
      const { strategy, token, protocol1, user1, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      // Setup
      await strategy.connect(owner).addProtocol(
        protocol1.address,
        "Test Protocol",
        50,
        ethers.utils.parseEther("100")
      );

      // Initially no positions
      let positions = await strategy.getUserPositions(user1.address);
      expect(positions.length).to.equal(0);

      // Open position
      const depositAmount = ethers.utils.parseEther("1000");
      await token.connect(user1).approve(strategy.address, depositAmount);
      await strategy.connect(user1).openPosition(protocol1.address, token.address, depositAmount);

      // Check positions
      positions = await strategy.getUserPositions(user1.address);
      expect(positions.length).to.equal(1);
      expect(positions[0].protocol).to.equal(protocol1.address);
      expect(positions[0].token).to.equal(token.address);
      expect(positions[0].amount).to.equal(depositAmount);
    });

    it("Should return active protocols", async function () {
      const { strategy, protocol1, protocol2, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      // Initially no protocols
      let protocols = await strategy.getActiveProtocols();
      expect(protocols.length).to.equal(0);

      // Add protocols
      await strategy.connect(owner).addProtocol(
        protocol1.address,
        "Protocol 1",
        50,
        ethers.utils.parseEther("100")
      );
      
      await strategy.connect(owner).addProtocol(
        protocol2.address,
        "Protocol 2",
        60,
        ethers.utils.parseEther("200")
      );

      protocols = await strategy.getActiveProtocols();
      expect(protocols.length).to.equal(2);
      expect(protocols[0]).to.equal(protocol1.address);
      expect(protocols[1]).to.equal(protocol2.address);
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should optimize gas usage for multiple operations", async function () {
      const { strategy, token, protocol1, user1, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      // Setup protocol
      await strategy.connect(owner).addProtocol(
        protocol1.address,
        "Test Protocol",
        50,
        ethers.utils.parseEther("100")
      );

      // Test gas usage for position opening
      const depositAmount = ethers.utils.parseEther("1000");
      await token.connect(user1).approve(strategy.address, depositAmount);
      
      const tx = await strategy.connect(user1).openPosition(
        protocol1.address,
        token.address,
        depositAmount
      );
      
      const receipt = await tx.wait();
      
      // Gas should be reasonable (adjust threshold as needed)
      expect(receipt.gasUsed).to.be.below(300000);
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complex multi-user scenarios", async function () {
      const { strategy, token, protocol1, protocol2, user1, user2, owner } = await loadFixture(deployYieldFarmingStrategyFixture);
      
      // Setup multiple protocols
      await strategy.connect(owner).addProtocol(
        protocol1.address,
        "Protocol 1",
        50,
        ethers.utils.parseEther("100")
      );
      
      await strategy.connect(owner).addProtocol(
        protocol2.address,
        "Protocol 2",
        60,
        ethers.utils.parseEther("200")
      );

      // Multiple users open positions
      const amount1 = ethers.utils.parseEther("1000");
      const amount2 = ethers.utils.parseEther("2000");
      
      await token.connect(user1).approve(strategy.address, amount1);
      await token.connect(user2).approve(strategy.address, amount2);
      
      await strategy.connect(user1).openPosition(protocol1.address, token.address, amount1);
      await strategy.connect(user2).openPosition(protocol2.address, token.address, amount2);

      // Verify positions
      const user1Positions = await strategy.getUserPositions(user1.address);
      const user2Positions = await strategy.getUserPositions(user2.address);
      
      expect(user1Positions.length).to.equal(1);
      expect(user2Positions.length).to.equal(1);
      expect(user1Positions[0].protocol).to.equal(protocol1.address);
      expect(user2Positions[0].protocol).to.equal(protocol2.address);
    });
  });
});
