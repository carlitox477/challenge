const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers,deployments, getNamedAccounts, network} = require("hardhat");
const {calculateTimeAdditionTS,setNextBlockTimestamp,revertToBlock,revertWithSnapshot}=require("../../scripts/time-utils-scripts")

describe("ETHPool local tests", function () {
  let ETHPool, blockNumberToRevert, blockchainSnapshot
  const ETHPoolConnections={admin:undefined, teamMember:undefined,staker1:undefined, staker2:undefined,staker3:undefined}
  const namedAccounts={admin:undefined, teamMember:undefined,staker1:undefined, staker2:undefined,staker3:undefined}


  before(async()=>{
    await deployments.fixture("ETHPool")
    ETHPool=await ethers.getContract(["ETHPool"])
    const {admin,teamMember,staker1,staker2,staker3}=await getNamedAccounts()
    const teamMemberCode=await ETHPool.TEAM_MEMBER()
    

    namedAccounts.admin=admin;
    namedAccounts.teamMember=teamMember;
    namedAccounts.staker1=staker1;
    namedAccounts.staker2=staker2;
    namedAccounts.staker3=staker3;

    ETHPoolConnections.admin=ETHPool.connect(await ethers.getSigner(admin))
    ETHPoolConnections.teamMember=ETHPool.connect(await ethers.getSigner(teamMember))
    ETHPoolConnections.staker1=ETHPool.connect(await ethers.getSigner(staker1))
    ETHPoolConnections.staker2=ETHPool.connect(await ethers.getSigner(staker2))
    ETHPoolConnections.staker3=ETHPool.connect(await ethers.getSigner(staker3))

    // Set the team role to account
    await ETHPoolConnections.admin.grantRole(teamMemberCode,namedAccounts.teamMember);
    expect(await ETHPool.hasRole(teamMemberCode,namedAccounts.teamMember),"Setting team member role has failed").to.be.true;
    
    blockNumberToRevert=await ethers.provider.getBlockNumber()
    if(network.name==="hardhat" ||network.name==="localhost"){
      //We take a snapshot
      blockchainSnapshot = await network.provider.send('evm_snapshot',[]);
    }

  
  })

  afterEach(async ()=> {
    const currentBlock=await ethers.provider.getBlockNumber()
    
    if(currentBlock>=blockNumberToRevert){
      if(network.name==="hardhat" ||network.name==="localhost"){
        //We revert to our initial state
        await revertWithSnapshot(blockchainSnapshot)

        //Due to error in hardhat desing we need to take the snapshot again
        blockchainSnapshot = await network.provider.send('evm_snapshot',[]);
      }else{
        //await revertToBlock(blockNumberToRevert)
        //console.log("Transcation reverted")
      }

      expect(await ethers.provider.getBlockNumber(),`Block couldn't be reverted to ${blockNumberToRevert}`).to.be.equal(blockNumberToRevert)
    }

  })

  describe("setNextRewards function", async()=>{
    it("Shouldn't allow to set next rewards for invalid parameters or role", async()=> {
      const currentStakeRewardDate= await ETHPool.getCurrentRewardDate()
      const nextRewards=ethers.utils.parseEther("10")
  
      await expect(ETHPoolConnections.teamMember.setNextRewards(nextRewards,currentStakeRewardDate.add(calculateTimeAdditionTS(0,10))),"Team member was allowed to set next rewards").to.be.reverted    
      await expect(ETHPoolConnections.admin.setNextRewards(0,currentStakeRewardDate.add(calculateTimeAdditionTS(0,2))),"Valid amount of rewards").to.be.revertedWith("rewards must be > 0")
      await expect(ETHPoolConnections.admin.setNextRewards(nextRewards,currentStakeRewardDate.add(calculateTimeAdditionTS(0,0,23,50))),"Valid date for next rewards").to.be.revertedWith("Next stake limit date should be greater/equal than 8 days after the current reward date")   
    });

    it("Should allow to set next rewards", async()=> {
      const currentReward=await ETHPool.currentRewardId()
      const stakeLimitDate= (await ETHPool.getCurrentRewardDate()).add(calculateTimeAdditionTS(0,10))
      const nextRewards=ethers.utils.parseEther("10")
  
      await ETHPoolConnections.admin.setNextRewards(nextRewards,stakeLimitDate)
      const nextRewardInfo=await ETHPool.rewardIdToRewardsInfo(BigNumber.from(1))

      expect(nextRewardInfo.rewardId.eq(currentReward.add(1)),"Incorrect reward id").to.be.true
      expect(nextRewardInfo.amount.eq(nextRewards),"Incorrect amount of rewards").to.be.true
      expect(nextRewardInfo.stakeLimitDate.eq(stakeLimitDate),"Incorrect stake limit day").to.be.true
    });

  })
  
  describe("modifyNextRewards function", async()=>{
    let nextRewards,stakeLimitDate

    before(async()=>{
      nextRewards=ethers.utils.parseEther("10")
      stakeLimitDate=(await ETHPool.getCurrentRewardDate()).add(calculateTimeAdditionTS(0,10))
    })

    //After each test it will revert the transaction thanks to the previous afterEach

    it("Shouldn't allow to modify next rewards if they haven't been set yet", async()=>{        
      await expect(ETHPoolConnections.admin.modifyNextRewards(ethers.utils.parseEther("10")),"Next rewards amount modified").to.be.revertedWith("You should use setNextRewards function")
    })

    it("Shouldn't allow to modify next rewards for incorrect parameters or role", async()=>{
      await ETHPoolConnections.admin.setNextRewards(nextRewards,stakeLimitDate)

      await expect(ETHPoolConnections.admin.modifyNextRewards(ethers.utils.parseEther("0")),"Next rewards amount modified").to.be.revertedWith("newRewards should be > 0")
      await expect(ETHPoolConnections.teamMember.modifyNextRewards(ethers.utils.parseEther("10")),"Next rewards amount modified").to.be.reverted
    })

    it("Should allow to modify next rewards", async()=>{
      const newNextRewards=ethers.utils.parseEther("100")

      await ETHPoolConnections.admin.setNextRewards(nextRewards,stakeLimitDate)
      await ETHPoolConnections.admin.modifyNextRewards(newNextRewards)
      const nextRewardInfo=await ETHPool.rewardIdToRewardsInfo(BigNumber.from(1))

      expect(nextRewardInfo.amount.eq(newNextRewards),"Next rewards couldn't be modified").to.be.true
    })
  })

  describe("modifyNextRewardsStakeLimitDate function", async()=>{

    let nextRewards, stakeLimitDate

    before(async()=>{
      nextRewards=ethers.utils.parseEther("10")
      currentRewardLimitDate=(await ETHPool.getCurrentRewardDate())
    })

    it("Shouldn't allow to set a new date if next rewards hasn't been setted yet", async()=>{
      const newStakeLimitDate=currentRewardLimitDate.add(calculateTimeAdditionTS(0,2))
      await expect(ETHPoolConnections.admin.modifyNextRewardsStakeLimitDate(newStakeLimitDate)).to.be.revertedWith("You should use setNextRewards function")
    })

    it("Shouldn't allow to set a new date lower than the current date + 1 day", async()=>{
      //set the next Rewards
      const stakeLimitDate= (await ETHPool.getCurrentRewardDate()).add(calculateTimeAdditionTS(0,10))
      const nextRewards=ethers.utils.parseEther("10")
      await ETHPoolConnections.admin.setNextRewards(nextRewards,stakeLimitDate)


      const lastBlock=await ethers.provider.getBlock();
      const nextTimestamp=lastBlock.timestamp+calculateTimeAdditionTS(0,0,1)


      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp])
      const newStakeLimitDate=nextTimestamp+ calculateTimeAdditionTS(0,0,23,59,59)
      
      await expect(ETHPoolConnections.admin.modifyNextRewardsStakeLimitDate(newStakeLimitDate)).to.be.revertedWith("Stake limit date should be at least 1 day further than now")
    })

  })

  describe("depositCurrentRewards function", async()=>{
    let rewardDate,stakeLimitDate,rewardAmount, nextRewardDate, nextPromisedRewards

    before(async()=>{
      rewardDate=await ETHPool.getCurrentRewardDate()
      stakeLimitDate=await ETHPool.getCurrentStakeLimitDate()
      rewardAmount=await ETHPool.getCurrentPromisedRewards()
      nextRewardDate=(await ETHPool.getCurrentRewardDate()).add(calculateTimeAdditionTS(0,2))
      nextPromisedRewards=ethers.utils.parseEther("2")
    })

    it("Should revert if the reward date hasn't been achivied yet",async()=>{
      await ETHPoolConnections.admin.setNextRewards(nextPromisedRewards,nextRewardDate)
      
      await expect(ETHPoolConnections.teamMember.depositCurrentRewards({value: rewardAmount})).to.be.revertedWith("Too soon to deposit rewards")   
    })

    it("Should revert if the deposit is not exactly the promised rewards",async()=>{
      const nextTimestamp=rewardDate.add(calculateTimeAdditionTS(0,0,1))
      await ETHPoolConnections.admin.setNextRewards(nextPromisedRewards,nextRewardDate)

      await (await ethers.getSigner(namedAccounts.staker1)).sendTransaction({
        to: ETHPool.address,
        value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
      });

      
      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toNumber()])

      await expect(ETHPoolConnections.teamMember.depositCurrentRewards({value: rewardAmount.add(1)}),"Deposit done").to.be.revertedWith("Incorrect amount of rewards sent")
    })

    it("Should revert if the next rewards hasn't been setted yet",async()=>{
      const nextTimestamp=rewardDate.add(calculateTimeAdditionTS(0,0,1))

      await (await ethers.getSigner(namedAccounts.staker1)).sendTransaction({
        to: ETHPool.address,
        value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
      });

      
      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toNumber()])

      await expect(ETHPoolConnections.teamMember.depositCurrentRewards({value: rewardAmount}),"Deposit done").to.be.revertedWith("You must set next rewards before depositing current rewards")
    })

    it("Should revert if the account who is making the deposit hasn't a TEAM_MEMBER role",async()=>{
      const nextTimestamp=rewardDate.add(calculateTimeAdditionTS(0,0,1))
      await ETHPoolConnections.admin.setNextRewards(nextPromisedRewards,nextRewardDate)

      await (await ethers.getSigner(namedAccounts.staker1)).sendTransaction({
        to: ETHPool.address,
        value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
      });

      
      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toNumber()])

      await expect(ETHPoolConnections.staker2.depositCurrentRewards({value: rewardAmount.add(1)}),"Deposit done").to.be.reverted
    })

    it("Should give back promised rewards if it hasn't deposits for the current promised rewards",async()=>{
      const nextTimestamp=rewardDate.add(calculateTimeAdditionTS(0,0,1))
      await ETHPoolConnections.admin.setNextRewards(nextPromisedRewards,nextRewardDate)
  
      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toNumber()])

      await ETHPoolConnections.teamMember.depositCurrentRewards({value: rewardAmount})
      expect(await ethers.provider.getBalance(ETHPool.address),"The rewards weren't given back").to.be.equal(0)


      
      expect((await ETHPool.getCurrentStakeLimitDate()).eq(nextRewardDate),"Incorrect stake limit date").to.be.true
      expect((await ETHPool.getCurrentRewardDate()).eq(nextRewardDate.add(calculateTimeAdditionTS(1))),"The rewards aren't given back").to.be.true
      expect((await ETHPool.getCurrentPromisedRewards()).eq(nextPromisedRewards),"The new promised rewards aren't given back").to.be.true
      expect(await ETHPool.currentRewardId(),"The rewards aren't given back").to.be.equal(1)
      
    })

    it("Should allow to deposit rewards if the reward date has been achivied and there was at least one deposit",async()=>{
      const nextTimestamp=rewardDate.add(calculateTimeAdditionTS(0,0,1))
      await ETHPoolConnections.admin.setNextRewards(nextPromisedRewards,nextRewardDate)

      await (await ethers.getSigner(namedAccounts.staker1)).sendTransaction({
        to: ETHPool.address,
        value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
      });
  
      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toNumber()])

      await ETHPoolConnections.teamMember.depositCurrentRewards({value: rewardAmount})

      expect((await ETHPool.getPendingRewardsToPay(namedAccounts.staker1)).eq(rewardAmount),"The rewards aren't correct").to.be.true


      expect((await ETHPool.getCurrentStakeLimitDate()).eq(nextRewardDate),"Incorrect stake limit date").to.be.true
      expect((await ETHPool.getCurrentRewardDate()).eq(nextRewardDate.add(calculateTimeAdditionTS(1))),"The rewards aren't given back").to.be.true
      expect((await ETHPool.getCurrentPromisedRewards()).eq(nextPromisedRewards),"The new promised rewards aren't given back").to.be.true
      expect(await ETHPool.currentRewardId(),"The rewards aren't given back").to.be.equal(1)
    })

  })

  describe("stake function", async()=>{
    let staker1Signer,staker2Signer,rewardDate,stakeLimitDate

    before(async()=>{
      staker1Signer=await ethers.getSigner(namedAccounts.staker1)
      staker2Signer=await ethers.getSigner(namedAccounts.staker2)
      rewardDate=await ETHPool.getCurrentRewardDate()
      stakeLimitDate=await ETHPool.getCurrentStakeLimitDate()
    })

    it("Shouldn't allow to stake again if already is a deposited which correspond to current rewards and stake limit date has passed", async()=>{
      
      const nextTimestamp=stakeLimitDate.add(calculateTimeAdditionTS(0,0,1))

      await staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value:ethers.utils.parseEther("1")
        })

      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toNumber()])

      await  expect(staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value:ethers.utils.parseEther("1")
        }),"Deposit wasn't reverted").to.be.revertedWith("It is needed to unstake first in order to claim all the pending rewards")

    })

    
    it("One deposit before stake limite date",async()=>{
      const nextTimestamp=stakeLimitDate.add(calculateTimeAdditionTS(0,0,1))
      const valueToDeposit= ethers.utils.parseEther("1")
      await staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDeposit
        })

      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toNumber()])
      await network.provider.send("evm_mine")
      
     
      const totalAmountStaked=(await ETHPool.addressToDeposits(namedAccounts.staker1)).amount;
      
      expect(totalAmountStaked.eq(valueToDeposit),"Couldn't do 2 stakes").to.be.true
    
    })

    it("Two deposits before stake limite date",async()=>{
      const nextTimestamp=stakeLimitDate.add(calculateTimeAdditionTS(0,0,1))
      const valueToDepositPerStakeCall= ethers.utils.parseEther("1")
      const totalValueToStake= valueToDepositPerStakeCall.mul(2)
      await staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDepositPerStakeCall
        })

      await staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDepositPerStakeCall
        })

      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toNumber()])
      await network.provider.send("evm_mine")
      
      
      const totalAmountStaked=(await ETHPool.addressToDeposits(namedAccounts.staker1)).amount;
      expect(totalAmountStaked.eq(totalValueToStake),"Couldn't do 2 stakes").to.be.true

    })

    it("Allow deposits after stake limite date",async()=>{
      const nextTimestamp=stakeLimitDate.add(calculateTimeAdditionTS(0,0,1))
      const valueToDepositPerStakeCall= ethers.utils.parseEther("1")
      const totalValueToStake= valueToDepositPerStakeCall.mul(2)
      await staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDepositPerStakeCall
        })

      await staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDepositPerStakeCall
        })

      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toNumber()])
      await network.provider.send("evm_mine")
      
      
      const totalAmountStaked=(await ETHPool.addressToDeposits(namedAccounts.staker1)).amount;
      expect(totalAmountStaked.eq(totalValueToStake),"Couldn't do 2 stakes").to.be.true

    })
    

  })

  describe("unstake function",async()=>{
    let staker1Signer,staker2Signer,staker3Signer,rewardDate,stakeLimitDate
    
    before(async()=>{
      staker1Signer=await ethers.getSigner(namedAccounts.staker1)
      staker2Signer=await ethers.getSigner(namedAccounts.staker2)
      staker3Signer=await ethers.getSigner(namedAccounts.staker3)
      rewardDate=await ETHPool.getCurrentRewardDate()
      stakeLimitDate=await ETHPool.getCurrentStakeLimitDate()
    })
    
    
    it("Shouldn't allow unstake after reward date if they haven't been paid",async()=>{
      const nextTimestamp=rewardDate.add(calculateTimeAdditionTS(0,0,1))
      const valueToDeposit= ethers.utils.parseEther("1")
      await staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDeposit
        })

      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toNumber()])
      
      await expect(ETHPoolConnections.staker1.unstake(), "Succesful unstake").to.be.revertedWith("Current pending rewards hasn't been paid yet, unstake won't allow you to claim them. Use emergencyUnstake function if you are willing to lose only the last rewards")
      expect((await ETHPool.addressToDeposits(namedAccounts.staker1)).amount.eq(valueToDeposit), "Succesful unstake").to.be.true
    })
    
    it("Should allow unstake before stake limit date",async()=>{
      const valueToDeposit= ethers.utils.parseEther("1")
      await staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDeposit
        })

      await ETHPoolConnections.staker1.unstake()
      
      expect((await ETHPool.addressToDeposits(namedAccounts.staker1)).amount.eq(0), "Succesful unstake").to.be.true
      expect((await ethers.provider.getBalance(ETHPool.address)).eq(0),"Unsuccessful  unstake").to.be.true
      expect((await ETHPool.currentRewardTotalDeposits()).eq(0),"Successful unstake").to.be.true
    })

    it("Should allow to unstake before current rewards date if there are not pending rewards",async()=>{
      
      const nextTimestamp=stakeLimitDate.add(calculateTimeAdditionTS(0,0,1))
      const valueToDeposit= ethers.utils.parseEther("1")
      await staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDeposit
        })

      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toNumber()])
      await ETHPoolConnections.staker1.unstake()
      
      expect((await ETHPool.addressToDeposits(namedAccounts.staker1)).amount.eq(0), "Succesful unstake").to.be.true
      expect((await ethers.provider.getBalance(ETHPool.address)).eq(0),"Successful  unstake").to.be.true
      expect((await ETHPool.currentRewardTotalDeposits()).eq(0),"Successful unstake").to.be.true
    })

    it("Should allow to unstake with rewards from 1 promised rewards",async()=>{
      const totalRewards=(await ETHPool.rewardIdToRewardsInfo(await ETHPool.currentRewardId())).amount
      const timestamp1=stakeLimitDate.add(calculateTimeAdditionTS(0,0,1))
      const timestamp2=rewardDate.add(calculateTimeAdditionTS(0,0,1))
      const valueToDepositStaker1= ethers.utils.parseEther("1")
      const valueToDepositStaker2= ethers.utils.parseEther("2")
      const valueToDepositStaker3= ethers.utils.parseEther("1")
      const totalAmountStakedForRewardsExpected=valueToDepositStaker1.add(valueToDepositStaker2)
      const rewardId=await ETHPool.currentRewardId()
      // Stake before stake limit date
      
      await staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDepositStaker1
        })

      await staker2Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDepositStaker2
        })
      
      const totalAmountStakedForRewards=await ETHPool.currentRewardTotalDeposits()
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp1.toNumber()])
      
      // Stake after stake limit date
      await staker3Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDepositStaker3
        })
      expect(totalAmountStakedForRewards.eq(await ETHPool.currentRewardTotalDeposits()))      

      //Set nex rewards
      await ETHPoolConnections.admin.setNextRewards(ethers.utils.parseEther("10"),timestamp2.add(calculateTimeAdditionTS(0,3)))

      // Deposit promised rewards     
      
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp2.toNumber()])
      await ETHPoolConnections.teamMember.depositCurrentRewards({value:ethers.utils.parseEther("1")})
      

      
      const rewardTotalDeposits=(await ETHPool.rewardIdToRewardsInfo(rewardId)).totalDeposits
      const expectedRewardsToPayToStaker1=(valueToDepositStaker1.mul(totalRewards)).div(rewardTotalDeposits)
      const expectedRewardsToPayToStaker2=(valueToDepositStaker2.mul(totalRewards)).div(rewardTotalDeposits)
      const rewardsToPayToStaker1=await ETHPool.getPendingRewardsToPay(namedAccounts.staker1)
      const rewardsToPayToStaker2=await ETHPool.getPendingRewardsToPay(namedAccounts.staker2)
      
      
      expect(expectedRewardsToPayToStaker1.eq(rewardsToPayToStaker1),"Incorrect calculation for pending rewards to pay").to.be.true
      expect(expectedRewardsToPayToStaker2.eq(rewardsToPayToStaker2),"Incorrect calculation for pending rewards to pay").to.be.true
      
      
      // Unstake all rewards
      await ETHPoolConnections.staker1.unstake()
      await ETHPoolConnections.staker2.unstake()

      expect((await ETHPool.getPendingRewardsToPay(namedAccounts.staker1)).eq(0),"Incorrect calculation for pending rewards to pay after unstake").to.be.true
      expect((await ETHPool.getPendingRewardsToPay(namedAccounts.staker2)).eq(0),"Incorrect calculation for pending rewards to pay after unstake").to.be.true
      expect((await ETHPool.getPendingRewardsToPay(namedAccounts.staker3)).eq(0),"Incorrect calculation for pending rewards").to.be.true
      
      const superiorQuote=valueToDepositStaker3.add(1)
      const inferiorQuote=valueToDepositStaker3.sub(1)
      expect((await ethers.provider.getBalance(ETHPool.address)).lte(superiorQuote),"Incorrect ETH balance for ETHPool contract").to.be.true
      expect((await ethers.provider.getBalance(ETHPool.address)).gte(inferiorQuote),"Incorrect ETH balance for ETHPool contract").to.be.true
    })

    it("Should allow to unstake with rewards from 2 or more promised rewards",async()=>{
      const firstRewards=(await ETHPool.rewardIdToRewardsInfo(await ETHPool.currentRewardId())).amount
      const secondRewards=ethers.utils.parseEther("10")
      
      const timestamp1=stakeLimitDate.add(calculateTimeAdditionTS(0,0,1))
      const timestamp2=rewardDate.add(calculateTimeAdditionTS(0,0,1))
      const timestamp3=timestamp2.add(calculateTimeAdditionTS(0,2))
      const timestamp4=timestamp3.add(calculateTimeAdditionTS(1,2))

      const valueToDepositStaker1= ethers.utils.parseEther("1")
      const valueToDepositStaker2= ethers.utils.parseEther("2")
      const valueToDepositStaker3= ethers.utils.parseEther("1")

      const totalAmountStakedForFirstRewardsExpected=valueToDepositStaker1.add(valueToDepositStaker2)
      const totalAmountStakedForSecondRewardsExpected=totalAmountStakedForFirstRewardsExpected.add(valueToDepositStaker3)
      
      const firstRewardId=await ETHPool.currentRewardId()
      const secondRewardId=firstRewardId.add(1)
      // Stake before stake limit date
      
      await staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDepositStaker1
        })

      await staker2Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDepositStaker2
        })
      
      
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp1.toNumber()])
      
      // Stake after stake limit date
      await staker3Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDepositStaker3
        })
       
      
      //Set next rewards
      await ETHPoolConnections.admin.setNextRewards(secondRewards,timestamp3)

      // Deposit promised rewards     
      
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp2.toNumber()])
      await ETHPoolConnections.teamMember.depositCurrentRewards({value:firstRewards})
      
      await ETHPoolConnections.admin.setNextRewards(secondRewards,timestamp4)
      
      await network.provider.send("evm_setNextBlockTimestamp", [timestamp3.add(calculateTimeAdditionTS(1,0,1)).toNumber()])

      await ETHPoolConnections.teamMember.depositCurrentRewards({value:secondRewards})
      
      
      
      
      const firstRewardTotalDeposits=valueToDepositStaker1.add(valueToDepositStaker2)
      const secondRewardTotalDeposits=firstRewardTotalDeposits.add(valueToDepositStaker3)
      const expectedRewardsToPayToStaker1=((valueToDepositStaker1.mul(firstRewards)).div(firstRewardTotalDeposits)).add(((valueToDepositStaker1.mul(secondRewards)).div(secondRewardTotalDeposits)))
      const expectedRewardsToPayToStaker2=((valueToDepositStaker2.mul(firstRewards)).div(firstRewardTotalDeposits)).add(((valueToDepositStaker2.mul(secondRewards)).div(secondRewardTotalDeposits)))
      const expectedRewardsToPayToStaker3=(valueToDepositStaker3.mul(secondRewards)).div(secondRewardTotalDeposits)
      const rewardsToPayToStaker1=await ETHPool.getPendingRewardsToPay(namedAccounts.staker1)
      const rewardsToPayToStaker2=await ETHPool.getPendingRewardsToPay(namedAccounts.staker2)
      const rewardsToPayToStaker3=await ETHPool.getPendingRewardsToPay(namedAccounts.staker3)
      
      
      expect(expectedRewardsToPayToStaker1.eq(rewardsToPayToStaker1),"Incorrect calculation for pending rewards to pay").to.be.true
      expect(expectedRewardsToPayToStaker2.eq(rewardsToPayToStaker2),"Incorrect calculation for pending rewards to pay").to.be.true
      expect(expectedRewardsToPayToStaker3.eq(rewardsToPayToStaker3),"Incorrect calculation for pending rewards to pay").to.be.true
      
      
      // Unstake all rewards
      await ETHPoolConnections.staker1.unstake()
      await ETHPoolConnections.staker2.unstake()
      await ETHPoolConnections.staker3.unstake()

      expect((await ETHPool.getPendingRewardsToPay(namedAccounts.staker1)).eq(0),"Incorrect calculation for pending rewards to pay after unstake").to.be.true
      expect((await ETHPool.getPendingRewardsToPay(namedAccounts.staker2)).eq(0),"Incorrect calculation for pending rewards to pay after unstake").to.be.true
      expect((await ETHPool.getPendingRewardsToPay(namedAccounts.staker3)).eq(0),"Incorrect calculation for pending rewards").to.be.true
      
      
      
      expect((await ethers.provider.getBalance(ETHPool.address)).lte(1),"Incorrect ETH balance for ETHPool contract").to.be.true
      
    })
  })

  describe("emergencyUnstake function",async()=>{
    let staker1Signer, rewardDate
    before(async()=>{
      staker1Signer=await ethers.getSigner(namedAccounts.staker1)
      rewardDate=await ETHPool.getCurrentRewardDate()
      
    })

    it("Should allow unstake after reward date if they haven't been paid",async()=>{
      const nextTimestamp=rewardDate.add(calculateTimeAdditionTS(0,0,1))
      const valueToDeposit= ethers.utils.parseEther("1")
      await staker1Signer.sendTransaction(
        { to: ETHPool.address,
          value: valueToDeposit
        })

      await network.provider.send("evm_setNextBlockTimestamp", [nextTimestamp.toNumber()])
      
      await ETHPoolConnections.staker1.emergencyUnstake()

      expect((await ethers.provider.getBalance(ETHPool.address)).eq(0),"Unsuccessful emergency unstake").to.be.true
        
    
    })
  })



})