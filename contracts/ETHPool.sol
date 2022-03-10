//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ETHPool is Ownable{
    struct Deposit{
        uint256 rewardId; //When it was deposited
        uint256 amount; //How much have been deposited
    }
    struct RewardsInfo{
        uint256 totalDeposits; 
        uint256 rewards;
    }

    event RewardDeposit(uint256 rewardNum, uint256 rewards);
    event Harvest(uint256 rewardNum, uint256 rewards);

    uint256 currentRewardId=0;
    uint256 currentTotalDeposits=0;
    mapping(uint256=>RewardsInfo) rewardsIdToRewardsInfo;
    mapping(address=> Deposit) deposits;

    
    
    constructor() Ownable(){
        
    }

    /**
    * @dev Funtion which allows the owner to deposit rewards whenever he wants
    * @param _rewards rewards deposited
    */
    function depositRewards(uint256 _rewards) public payable onlyOwner{
        rewardsIdToRewardsInfo[currentRewardId].rewards=_rewards; //establish when the rewards were deposited
        emit RewardDeposit(currentRewardId, _rewards); 
        currentRewardId++; //set new reward num (new stage)
    }
    
    /**
    * @dev Function which allow us to calculate the pending rewards from an address
    * @param staker account from which we will get its pending rewards
    * @return pendingRewards pending rewards from @param staker
    */
    function getPendingRewards(address staker) view public returns(uint256){
        Deposit memory deposit=deposits[staker];
        // uint256 _currentRewardId=currentRewardId; // check if it save more gas
        require(deposit.amount>0 || deposit.rewardId==currentRewardId,"No rewards pending"); //Check deposit.rewardNum has no sense, it will spend more gas.
        


        //created here to save gas before require
        uint256 pendingRewards=0;
        RewardsInfo memory rewardsInfo; //This declaration here save us gas in the foor loop too

        for(uint256 i=deposit.rewardId;i<currentRewardId;i++){
            rewardsInfo=rewardsIdToRewardsInfo[i];

            //Solidity 0.8 assure us there won't be over/underflow, otherwise we should use a library like SafeMath
            pendingRewards+=(deposit.amount/rewardsInfo.totalDeposits)*rewardsInfo.rewards;
        }
        return pendingRewards;
    }

    function withdrawAll() public{
        Deposit memory deposit=deposits[msg.sender];
        // uint256 _currentRewardId=currentRewardId; // check if it save more gas
        require(deposit.amount>0, "No funds deposited"); //Check deposit.rewardNum has no sense, it will spend more gas.
        if(deposit.rewardId == currentRewardId){
            payable(msg.sender).transfer(deposit.amount);
        }else{
            uint256 pendingRewards=getPendingRewards(msg.sender);
            payable(msg.sender).transfer(deposit.amount+pendingRewards);
        }

        deposits[msg.sender].amount=0;
        rewardsIdToRewardsInfo[currentRewardId].totalDeposits-=deposit.amount;
    }

    function harvest() public{
        Deposit memory deposit=deposits[msg.sender];
        // uint256 _currentRewardId=currentRewardId; // check if it save more gas
        require(deposit.amount>0 && deposit.rewardId < currentRewardId, "No pending rewards to harvest");
        
        uint256 pendingRewards=getPendingRewards(msg.sender);

        deposits[msg.sender].amount+=pendingRewards;
        deposits[msg.sender].rewardId=currentRewardId;
    }

    function withdrawRewards(address payable staker) internal{
        Deposit memory deposit=deposits[staker];
        // uint256 _currentRewardId=currentRewardId; // check if it save more gas
        require(deposit.amount>0 && deposit.rewardId < currentRewardId, "No pending rewards to harvest");
        
        uint256 pendingRewards=getPendingRewards(staker);
        payable(staker).transfer(pendingRewards);
        
        deposits[staker].rewardId=currentRewardId;
    }

    function hasPendingRewards(address staker) view internal returns(bool){
        Deposit memory deposit=deposits[staker];
        return deposit.amount>0 && deposit.rewardId < currentRewardId;
    }

    
    //Deposit default behavior
    receive() external payable  {
        if(hasPendingRewards(msg.sender)){
            depositAndWithdrawRewards();
        }else{
            deposits[msg.sender].rewardId=currentRewardId;
            deposits[msg.sender].amount+=msg.value;
        }
    }


    function depositAndWithdrawRewards() internal{
        withdrawRewards(payable(msg.sender));
        deposits[msg.sender].amount+=msg.value;
    }

    function depositAndHarvestRewards() public payable{
        harvest();
        deposits[msg.sender].amount+=msg.value;
    }

    
}
