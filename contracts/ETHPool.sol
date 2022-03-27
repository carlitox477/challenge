//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ETHPool is AccessControl,ReentrancyGuard{
    bytes32 public constant OWNER = keccak256("OWNER");
    bytes32 public constant TEAM_MEMBER = keccak256("TEAM_MEMBER");

    struct RewardsInfo{
        uint256 rewardId;
        uint256 stakeLimitDate;
        uint256 totalDeposits;
        uint256 amount;
    }

    struct Deposit{
        uint256 firstRewardId;
        uint256 depositDate;
        uint256 amount; //How much have been deposited
    }

    uint256 constant STAKE_TIME= 1 weeks;
    uint256 public currentRewardId;
    uint256 public currentRewardTotalDeposits;
    uint256 public totalDeposits;

    mapping(uint256=>RewardsInfo) public rewardIdToRewardsInfo;
    mapping(address=>Deposit) public addressToDeposits;

    constructor(uint256 rewards, uint256 stakeLimitDate) AccessControl(){
        
        require(rewards>0,"rewards must be > 0");
        require(stakeLimitDate>block.timestamp + 1 days,"Stake limit date should be at least 1 day furhter than now");

        _setRoleAdmin(OWNER, OWNER);
        _setRoleAdmin(TEAM_MEMBER, OWNER);
        _grantRole(OWNER, msg.sender);
        _grantRole(TEAM_MEMBER, msg.sender);

        //We need to set the first rewards
        rewardIdToRewardsInfo[0].stakeLimitDate=stakeLimitDate;
        rewardIdToRewardsInfo[0].amount=rewards;
    }

    function setNextRewards(uint256 rewards, uint256 stakeLimitDate) external onlyRole(OWNER) {
        require(rewards>0,"rewards must be > 0");
        require(stakeLimitDate>block.timestamp + 1 days,"Stake limit date should be at least 1 day further than now");

        uint256 _currentRewardId= currentRewardId; //gas saving
        uint256 nextRewardId=_currentRewardId+1;

        //We check that the next stake limit date is greater than the current reward date
        require((rewardIdToRewardsInfo[_currentRewardId].stakeLimitDate+8 days)<=stakeLimitDate,"Next stake limit date should be greater/equal than 8 days after the current reward date");
        
        //We check that the next reward hasn't been setted yet
        uint256 nextRewardAmount=rewardIdToRewardsInfo[nextRewardId].amount;
        require(nextRewardAmount==0,"Reward already setted");

        //We set the next reward info.
        RewardsInfo storage nextRewardInfo=rewardIdToRewardsInfo[nextRewardId];        
        nextRewardInfo.rewardId=nextRewardId;
        nextRewardInfo.amount=rewards;
        nextRewardInfo.stakeLimitDate=stakeLimitDate;
    }

    function modifyNextRewards(uint256 newRewards) external onlyRole(OWNER){
        uint256 nextRewardId=currentRewardId+1;
        require(rewardIdToRewardsInfo[nextRewardId].amount>0, "You should use setNextRewards function");
        require(newRewards>0, "newRewards should be > 0");
        rewardIdToRewardsInfo[nextRewardId].amount=newRewards;
    }

    function modifyNextRewardsStakeLimitDate(uint256 newDate) external onlyRole(OWNER){
        //Check if it the new date has at least 1 day of delay
        require(newDate>block.timestamp + 1 days,"Stake limit date should be at least 1 day further than now");

        //Check if the next rewards has already been setted
        uint256 nextRewardId=currentRewardId+1;
        RewardsInfo memory nextRewardInfo=rewardIdToRewardsInfo[nextRewardId];
        require(nextRewardInfo.amount>0, "You should use setNextRewards function");

        rewardIdToRewardsInfo[nextRewardId].stakeLimitDate=newDate;
    }

    function depositCurrentRewards() external payable onlyRole(TEAM_MEMBER) nonReentrant{
        uint256 _currentRewardId= currentRewardId;
        uint256 _currentRewardTotalDeposits=currentRewardTotalDeposits;

        //Check if the correct rewards were sent
        RewardsInfo memory currentRewardInfo=rewardIdToRewardsInfo[_currentRewardId];
        if(_currentRewardTotalDeposits!=0){
            require(msg.value==currentRewardInfo.amount,"Incorrect amount of rewards sent");
        }else{
            payable(msg.sender).transfer(msg.value);
        }
        
        
        //Check if the finish dates has already passed
        uint256 stakeFinishDate=currentRewardInfo.stakeLimitDate + 7 days;
        require(block.timestamp>=stakeFinishDate,"Too soon to deposit rewards");

        //Next rewards must be set before depositing current rewards
        uint256 nextRewardId=_currentRewardId+1;
        require(rewardIdToRewardsInfo[nextRewardId].amount>0,"You must set next rewards before depositing current rewards");

        //Save total deposits to calculate rewards later
        rewardIdToRewardsInfo[_currentRewardId].totalDeposits=_currentRewardTotalDeposits;

        //Change current reward id to the next one
        currentRewardId = nextRewardId;
        currentRewardTotalDeposits=totalDeposits;

    }

    function calculateDepositPendingRewards(Deposit memory deposit) internal view returns(uint256){
        uint256 totalRewards;
        
        uint256 _currentRewardId=currentRewardId; //Gas saving
        uint256 depositAmount=deposit.amount;

        if(depositAmount==0 || _currentRewardId==deposit.firstRewardId){
            return 0;
        }
        
        RewardsInfo memory rewardInfo;
        //if the deposit was done when the current reward was 0, we should percive rewards 
        //corresponding to rewardId 1 only when the current reward is equal/greater than 2 
        for(uint256 i=deposit.firstRewardId;i<_currentRewardId;i++){
            rewardInfo=rewardIdToRewardsInfo[i];
            totalRewards+= (depositAmount*rewardInfo.amount)/rewardInfo.totalDeposits; //This can be done like this due to solidity 0.8, for previous version we should use sth like safe math library
        }

        return totalRewards;
    }

    function stake() internal{  
        uint256 _currentRewardId=currentRewardId;
        RewardsInfo memory currentRewardInfo=rewardIdToRewardsInfo[_currentRewardId];
        uint256 currentRewardLimitStakeDate=currentRewardInfo.stakeLimitDate;

        

        uint256 firstRewardId=_currentRewardId;
        address payable sender= payable(_msgSender());
        Deposit memory deposit = addressToDeposits[sender];
        
        bool invalidCurrentRewardsStake=block.timestamp>currentRewardLimitStakeDate;
        
        
        if(invalidCurrentRewardsStake){
            firstRewardId+=1;
        }

        uint256 newDeposit=msg.value;
        //There weren't other deposits        
        if(deposit.amount==0){
            addressToDeposits[sender].firstRewardId=firstRewardId;
            addressToDeposits[sender].amount=newDeposit;
        }else{
            require(deposit.firstRewardId==firstRewardId,"It is needed to unstake first in order to claim all the pending rewards");
            addressToDeposits[sender].amount+=newDeposit;
        }

        if(!invalidCurrentRewardsStake){
            currentRewardTotalDeposits+=newDeposit;
        }
        totalDeposits+=newDeposit; 

    }

    //Deposit default behavior
    receive() external payable  {
        stake();
    }


    function _unstake() internal nonReentrant{
        Deposit memory deposit=addressToDeposits[_msgSender()];
        uint256 _currentRewardTotalDeposits=currentRewardTotalDeposits;

        //If the current rewards hasn't been deposited the transaction will be reverted,
        //user will need yo use the panicUnstake function
        uint256 pendingRewards=calculateDepositPendingRewards(deposit);
        
        payable(_msgSender()).transfer(deposit.amount+pendingRewards);
        
        _currentRewardTotalDeposits-=deposit.amount;
        currentRewardTotalDeposits=_currentRewardTotalDeposits;
        
        
        //rewardIdToRewardsInfo[currentRewardId].totalDeposits=_currentRewardTotalDeposits;
        
         

        addressToDeposits[_msgSender()].amount=0;
        totalDeposits-=deposit.amount;
        deposit.amount=0;
    }

    function unstake() external{
        uint256 currentRewardStakeEndDate=rewardIdToRewardsInfo[currentRewardId].stakeLimitDate+ 7 days;
        require(currentRewardStakeEndDate>block.timestamp,"Current pending rewards hasn't been paid yet, unstake won't allow you to claim them. Use emergencyUnstake function if you are willing to lose only the last rewards");
        _unstake();
    }

    function emergencyUnstake() external{
        _unstake();
    }

    
    function getCurrentStakeLimitDate() public view returns(uint256){
        return rewardIdToRewardsInfo[currentRewardId].stakeLimitDate;
    }

    function getCurrentRewardDate() public view returns(uint256){
        return rewardIdToRewardsInfo[currentRewardId].stakeLimitDate + 7 days;
    }

    function getCurrentPromisedRewards()public view returns(uint256){
        return rewardIdToRewardsInfo[currentRewardId].amount;
    }

    function getPendingRewardsToPay(address account)public view returns(uint256){
        Deposit memory deposit=addressToDeposits[account];
        if(deposit.amount==0){
            return 0;
        }
        return calculateDepositPendingRewards(deposit);
    }




}