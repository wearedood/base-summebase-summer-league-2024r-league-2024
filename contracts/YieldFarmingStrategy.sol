// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title YieldFarmingStrategy
 * @dev Advanced DeFi yield farming strategy for Base Summer League
 * @notice Implements comprehensive yield optimization across Base ecosystem
 */
contract YieldFarmingStrategy is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // State variables
    struct Position {
        uint256 amount;
        uint256 lastRewardBlock;
        uint256 rewardDebt;
        uint256 lockEndTime;
        bool isActive;
    }

    struct PoolInfo {
        IERC20 stakingToken;
        IERC20 rewardToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accRewardPerShare;
        uint256 totalStaked;
        uint256 minLockPeriod;
        bool isEmergencyWithdrawEnabled;
    }

    // Events
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event RewardClaimed(address indexed user, uint256 indexed pid, uint256 amount);
    event PoolAdded(uint256 indexed pid, address stakingToken, address rewardToken);
    event PositionRebalanced(address indexed user, uint256 indexed pid, uint256 newAmount);

    // Storage
    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => Position)) public userPositions;
    mapping(address => bool) public authorizedRebalancers;
    
    uint256 public constant PRECISION = 1e12;
    uint256 public rewardPerBlock = 1e18; // 1 token per block
    uint256 public totalAllocPoint = 0;
    uint256 public emergencyWithdrawFee = 500; // 5%
    uint256 public constant MAX_FEE = 1000; // 10%

    constructor() {
        // Initialize with owner as authorized rebalancer
        authorizedRebalancers[msg.sender] = true;
    }

    /**
     * @dev Add a new pool for yield farming
     * @param _stakingToken Token to be staked
     * @param _rewardToken Token to be rewarded
     * @param _allocPoint Allocation points for reward distribution
     * @param _minLockPeriod Minimum lock period in seconds
     */
    function addPool(
        IERC20 _stakingToken,
        IERC20 _rewardToken,
        uint256 _allocPoint,
        uint256 _minLockPeriod
    ) external onlyOwner {
        require(address(_stakingToken) != address(0), "Invalid staking token");
        require(address(_rewardToken) != address(0), "Invalid reward token");
        
        massUpdatePools();
        
        uint256 lastRewardBlock = block.number;
        totalAllocPoint += _allocPoint;
        
        poolInfo.push(PoolInfo({
            stakingToken: _stakingToken,
            rewardToken: _rewardToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accRewardPerShare: 0,
            totalStaked: 0,
            minLockPeriod: _minLockPeriod,
            isEmergencyWithdrawEnabled: false
        }));
        
        emit PoolAdded(poolInfo.length - 1, address(_stakingToken), address(_rewardToken));
    }

    /**
     * @dev Deposit tokens to earn rewards
     * @param _pid Pool ID
     * @param _amount Amount to deposit
     */
    function deposit(uint256 _pid, uint256 _amount) external nonReentrant whenNotPaused {
        require(_pid < poolInfo.length, "Invalid pool ID");
        require(_amount > 0, "Amount must be greater than 0");
        
        PoolInfo storage pool = poolInfo[_pid];
        Position storage position = userPositions[_pid][msg.sender];
        
        updatePool(_pid);
        
        // Claim pending rewards if position exists
        if (position.amount > 0) {
            uint256 pending = (position.amount * pool.accRewardPerShare / PRECISION) - position.rewardDebt;
            if (pending > 0) {
                safeRewardTransfer(pool.rewardToken, msg.sender, pending);
                emit RewardClaimed(msg.sender, _pid, pending);
            }
        }
        
        // Transfer tokens from user
        pool.stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        
        // Update position
        position.amount += _amount;
        position.lastRewardBlock = block.number;
        position.rewardDebt = position.amount * pool.accRewardPerShare / PRECISION;
        position.lockEndTime = block.timestamp + pool.minLockPeriod;
        position.isActive = true;
        
        // Update pool
        pool.totalStaked += _amount;
        
        emit Deposit(msg.sender, _pid, _amount);
    }

    /**
     * @dev Withdraw staked tokens and claim rewards
     * @param _pid Pool ID
     * @param _amount Amount to withdraw
     */
    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant {
        require(_pid < poolInfo.length, "Invalid pool ID");
        
        PoolInfo storage pool = poolInfo[_pid];
        Position storage position = userPositions[_pid][msg.sender];
        
        require(position.amount >= _amount, "Insufficient balance");
        require(block.timestamp >= position.lockEndTime, "Position still locked");
        
        updatePool(_pid);
        
        // Calculate and transfer pending rewards
        uint256 pending = (position.amount * pool.accRewardPerShare / PRECISION) - position.rewardDebt;
        if (pending > 0) {
            safeRewardTransfer(pool.rewardToken, msg.sender, pending);
            emit RewardClaimed(msg.sender, _pid, pending);
        }
        
        // Update position
        position.amount -= _amount;
        position.rewardDebt = position.amount * pool.accRewardPerShare / PRECISION;
        
        if (position.amount == 0) {
            position.isActive = false;
        }
        
        // Update pool and transfer tokens
        pool.totalStaked -= _amount;
        pool.stakingToken.safeTransfer(msg.sender, _amount);
        
        emit Withdraw(msg.sender, _pid, _amount);
    }

    /**
     * @dev Emergency withdraw without caring about rewards (with fee)
     * @param _pid Pool ID
     */
    function emergencyWithdraw(uint256 _pid) external nonReentrant {
        require(_pid < poolInfo.length, "Invalid pool ID");
        
        PoolInfo storage pool = poolInfo[_pid];
        Position storage position = userPositions[_pid][msg.sender];
        
        require(position.amount > 0, "No position to withdraw");
        require(pool.isEmergencyWithdrawEnabled, "Emergency withdraw not enabled");
        
        uint256 amount = position.amount;
        uint256 fee = (amount * emergencyWithdrawFee) / 10000;
        uint256 amountAfterFee = amount - fee;
        
        // Reset position
        position.amount = 0;
        position.rewardDebt = 0;
        position.isActive = false;
        
        // Update pool
        pool.totalStaked -= amount;
        
        // Transfer tokens (minus fee)
        pool.stakingToken.safeTransfer(msg.sender, amountAfterFee);
        
        emit EmergencyWithdraw(msg.sender, _pid, amountAfterFee);
    }

    /**
     * @dev Automated rebalancing function for authorized addresses
     * @param _pid Pool ID
     * @param _user User address
     * @param _newAmount New optimal amount
     */
    function rebalancePosition(
        uint256 _pid,
        address _user,
        uint256 _newAmount
    ) external {
        require(authorizedRebalancers[msg.sender], "Not authorized");
        require(_pid < poolInfo.length, "Invalid pool ID");
        
        Position storage position = userPositions[_pid][_user];
        require(position.isActive, "Position not active");
        
        updatePool(_pid);
        
        // This would integrate with external optimization algorithms
        // For now, we emit an event for tracking
        emit PositionRebalanced(_user, _pid, _newAmount);
    }

    /**
     * @dev Update reward variables for all pools
     */
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    /**
     * @dev Update reward variables of the given pool
     * @param _pid Pool ID
     */
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        
        if (pool.totalStaked == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        
        uint256 multiplier = block.number - pool.lastRewardBlock;
        uint256 reward = (multiplier * rewardPerBlock * pool.allocPoint) / totalAllocPoint;
        
        pool.accRewardPerShare += (reward * PRECISION) / pool.totalStaked;
        pool.lastRewardBlock = block.number;
    }

    /**
     * @dev Safe reward transfer function
     */
    function safeRewardTransfer(IERC20 _rewardToken, address _to, uint256 _amount) internal {
        uint256 balance = _rewardToken.balanceOf(address(this));
        if (_amount > balance) {
            _rewardToken.safeTransfer(_to, balance);
        } else {
            _rewardToken.safeTransfer(_to, _amount);
        }
    }

    /**
     * @dev Get pending rewards for a user
     * @param _pid Pool ID
     * @param _user User address
     * @return Pending reward amount
     */
    function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        Position storage position = userPositions[_pid][_user];
        
        uint256 accRewardPerShare = pool.accRewardPerShare;
        
        if (block.number > pool.lastRewardBlock && pool.totalStaked != 0) {
            uint256 multiplier = block.number - pool.lastRewardBlock;
            uint256 reward = (multiplier * rewardPerBlock * pool.allocPoint) / totalAllocPoint;
            accRewardPerShare += (reward * PRECISION) / pool.totalStaked;
        }
        
        return (position.amount * accRewardPerShare / PRECISION) - position.rewardDebt;
    }

    // Admin functions
    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {
        massUpdatePools();
        rewardPerBlock = _rewardPerBlock;
    }

    function setEmergencyWithdrawFee(uint256 _fee) external onlyOwner {
        require(_fee <= MAX_FEE, "Fee too high");
        emergencyWithdrawFee = _fee;
    }

    function toggleEmergencyWithdraw(uint256 _pid, bool _enabled) external onlyOwner {
        poolInfo[_pid].isEmergencyWithdrawEnabled = _enabled;
    }

    function setAuthorizedRebalancer(address _rebalancer, bool _authorized) external onlyOwner {
        authorizedRebalancers[_rebalancer] = _authorized;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // View functions
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function getUserPosition(uint256 _pid, address _user) external view returns (Position memory) {
        return userPositions[_pid][_user];
    }
}
