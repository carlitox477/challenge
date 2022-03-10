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

    uint256 currentRewardId=1;
    uint256 currentTotalDeposits=0;
    mapping(uint256=>RewardsInfo) rewardsIdToRewardsInfo;
    mapping(address=> Deposit) deposits;
    string private greeting;
    event RewardDeposit(uint256 rewardNum, uint256 rewards);

    
    
    constructor(string memory _greeting) Ownable(){
        console.log("Deploying a Greeter with greeting:", _greeting);
        greeting = _greeting;
    }

    
    /**
    * @dev Function which allow us to calculate the pending rewards from an address
    * @param staker account from which we will get its pending rewards
    * @return pendingRewards pending rewards from @param staker
    */
    function getPendingRewards(address staker) view public returns(uint256){
        Deposit memory deposit=deposits[staker];
        // uint256 _currentRewardId=currentRewardId; // check if it save more gas
        require(deposit.amount==0 || deposit.rewardId==currentRewardId,"No rewards pending"); //Check deposit.rewardNum has no sense, it will spend more gas.
        
        //created here to save gas before require
        uint256 pendingRewards;
        RewardsInfo memory rewardsInfo; //This declaration here save us gas in the foor loop too

        for(uint256 i=deposit.rewardId;i<currentRewardId;i++){
            rewardsInfo=rewardsIdToRewardsInfo[i];

            //Solidity 0.8 assure us there won't be over/underflow, otherwise we should use a library like SafeMath
            pendingRewards+=(deposit.amount/rewardsInfo.totalDeposits)*rewardsInfo.rewards;
        }
    return pendingRewards;
    }
    

    function greet() public view returns (string memory) {
        return greeting;
    }

    function setGreeting(string memory _greeting) public {
        console.log("Changing greeting from '%s' to '%s'", greeting, _greeting);
        greeting = _greeting;
    }
}
