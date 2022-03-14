//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RewardETHPool is Ownable{
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
    uint256 currentRewardId;
    uint256 currentRewardTotalDeposits;
    uint256 totalDeposits;

    mapping(uint256=>RewardsInfo) rewardIdToRewardsInfo;
    mapping(address=>Deposit) addressToDeposits;

    constructor() Ownable(){}

    function setNextRewards(uint256 rewards, uint256 stakeLimitDate) external onlyOwner {
        require(rewards>0,"rewards must be > 0 ");
        require(stakeLimitDate>block.timestamp + 1 days,"Stake limit date should be at least 1 day furhter than now");

        uint256 _currentRewardId= currentRewardId; //gas saving
        uint256 nextRewardId=_currentRewardId+1;

        //We check that the next stake limit date is greater than the current reward date
        RewardsInfo memory currentRewardInfo=rewardIdToRewardsInfo[_currentRewardId];
        require(currentRewardInfo.stakeLimitDate+1 weeks>=stakeLimitDate,"Next stake limit date should be greater than the current reward date");
        
        //We check that the next reward hasn't been setted yet
        uint256 nextRewardAmount=rewardIdToRewardsInfo[nextRewardId].amount;
        require(nextRewardAmount==0,"Reward already setted");

        //We set the next reward info.
        RewardsInfo storage nextRewardInfo=rewardIdToRewardsInfo[nextRewardId];        
        nextRewardInfo.rewardId=nextRewardId;
        nextRewardInfo.amount=rewards;
        nextRewardInfo.stakeLimitDate=stakeLimitDate;
    }

    function modifyNextRewards(uint256 newRewards) external onlyOwner{
        uint256 nextRewardId=currentRewardId+1;
        require(rewardIdToRewardsInfo[nextRewardId].amount>0, "You should use setNextRewards function");
        rewardIdToRewardsInfo[nextRewardId].amount=newRewards;
    }

    function modifyNextRewardsStakeLimitDate(uint256 newDate) external onlyOwner{
        //Check if it the new date has at least 1 day of delay
        require(newDate>block.timestamp + 1 days,"Stake limit date should be at least 1 day furhter than now");

        //Check if the next rewards has already been setted
        uint256 nextRewardId=currentRewardId+1;
        RewardsInfo memory nextRewardInfo=rewardIdToRewardsInfo[nextRewardId];
        require(nextRewardInfo.amount>0, "You should use setNextRewards function");
        
        
        //Check if the current next stake limit date is greater than now
        require(nextRewardInfo.stakeLimitDate<block.timestamp, "You should use setNextRewards function");
        rewardIdToRewardsInfo[nextRewardId].stakeLimitDate=newDate;
    }

    function depositCurrentRewards() external payable onlyOwner{
        uint256 _currentRewardId= currentRewardId;

        //Check if the correct rewards were sent
        RewardsInfo memory currentRewardInfo=rewardIdToRewardsInfo[_currentRewardId];
        require(msg.value==currentRewardInfo.amount,"Incorrect amount of rewards sent");
        
        //Check if the finish dates has already passed
        uint256 stakeFinishDate=currentRewardInfo.stakeLimitDate + 7 days;
        require(block.timestamp>=stakeFinishDate,"Too soon to deposit rewards");

        //Next rewards must be set before depositing current rewards
        uint256 nextRewardId=_currentRewardId+1;
        require(rewardIdToRewardsInfo[nextRewardId].amount>0,"You must set next rewards before depositing current rewards");

        //Save total deposits to calculate rewards later
        rewardIdToRewardsInfo[_currentRewardId].totalDeposits=currentRewardTotalDeposits;

        //Change current reward id to the next one
        currentRewardId = nextRewardId;
        currentRewardTotalDeposits=totalDeposits;
    }

    /*
        deposit A done time 0 with crID=1
        previous rewards deposited, now crID=2
        limit time for R pass
        deposit B done in time 1 crID=2
        rewardsDeposited on time 2, crID=3
        limit time for R2 pass
        rewardsDeposited on time 3, crID=4
        
    */

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
            totalRewards+= (depositAmount/rewardInfo.totalDeposits)*(rewardInfo.amount); //This can bbe done like this due to solidity 0.8, for previous version we should use sth like safe math library
        }

        return totalRewards;
    }

    function _unstake() internal{
        Deposit memory deposit=addressToDeposits[_msgSender()];

        //If the current rewards hasn't been deposited the transaction will be reverted,
        //user will need yo use the panicUnstake function
        uint256 pendingRewards=calculateDepositPendingRewards(deposit);
        
        payable(_msgSender()).transfer(deposit.amount+pendingRewards);
        
        if(deposit.firstRewardId<=currentRewardId){
            currentRewardTotalDeposits-=deposit.amount;
        }
        
        totalDeposits-=deposit.amount;
        deposit.amount=0;
    }

    function unstake() external{
        uint256 currentRewardStakeEndDate=rewardIdToRewardsInfo[currentRewardId].stakeLimitDate+ 7 days;
        require(currentRewardStakeEndDate>block.timestamp,"Current pending rewards hasn't been paid yet, unstake won't allow you to claim them. Use emergencyUnstake fubction if you are willing to lose only the last rewards");
        _unstake();
    }

    function emergencyUnstake() external{
        _unstake();
    }

    function stake() internal{
        
        
        uint256 _currentRewardId=currentRewardId;
        RewardsInfo memory currentRewardInfo=rewardIdToRewardsInfo[_currentRewardId];
        uint256 currentRewardLimitStakeDate=currentRewardInfo.stakeLimitDate;

        //We shouldn't allow new deposits until current rewards are paid if they mush have already paid
        require(block.timestamp<currentRewardLimitStakeDate+1 weeks,"Wait until current rewards are already paid before staking");

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
        //The las deposit was done with the same firstRewardId value
        }else{
            //There were a previous deposit and it hasn't been unstaked yet.
            //It must be first unstaken in order to claim all the pending rewards
            require(deposit.firstRewardId==firstRewardId,"It is needed to unstake first in order to claim all the pending rewards");
        }

        if(!invalidCurrentRewardsStake){
            currentRewardTotalDeposits+=newDeposit;
        }
        totalDeposits+=newDeposit; 

        addressToDeposits[sender].amount=newDeposit;
    }

    //Deposit default behavior
    receive() external payable  {
        stake();
    }

    






}