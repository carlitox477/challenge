
const { network, ethers } = require("hardhat");

/**
 * @dev Return number of seconds given a number of seconds
 * @param {number} seconds 
 * @returns {number} totalSeconds
 */
 const getSecondsTS=(seconds)=>{
    return seconds
}

/**
 * @dev Return number of seconds given a number of minutes
 * @param {number} minutes 
 * @returns {number} totalSeconds 
 */
const getMinutesTS=(minutes)=>{
    return minutes*getSecondsTS(60)
}

/**
 * @dev Return number of seconds given a number of hours
 * @param {number} hours 
 * @returns {number} totalSeconds 
 */
const getHoursTS=(hours)=>{
    return hours*getMinutesTS(60)
}

/**
 * @dev Return number of seconds given a number of days
 * @param {number} days 
 * @returns {number} totalSeconds 
 */
const getDaysTS=(days)=>{
    return days*getHoursTS(24)
}

/**
 * @dev Return number of seconds given a number of weeks
 * @param {number} weeks 
 * @returns {number} totalSeconds 
 */
const getWeeksTS=(weeks)=>{
    return weeks*getDaysTS(7)
}

/**
 * @dev Return number of seconds given a number of weeks, days, hours, minutes and seconds
 * @param {number} weeks 
 * @param {number} days 
 * @param {number} hours 
 * @param {number} minutes 
 * @param {number} seconds
 * @returns {number} totalSeconds 
 */
const calculateTimeAdditionTS=(weeks=0, days=0, hours=0, minutes=0, seconds=0)=>{
    return getWeeksTS(weeks)+getDaysTS(days)+getHoursTS(hours)+getMinutesTS(minutes)+seconds
}

const setNextBlockTimestamp=async(time)=>{
    try{
        await network.provider.send("evm_setNextBlockTimestamp", [time])
        await network.provider.send("evm_mine")
    }catch(error){
        console.log(error)
    }
}

const revertToBlock=async(blockNumberToRevert, jsonRpcUrl=undefined)=>{
    try{
        
        const currentBlockNumber= await ethers.provider.getBlockNumber()
        
        console.log(currentBlockNumber)
        if(currentBlockNumber<=blockNumberToRevert){
            
            throw "Block to revert should be less than current block number"
        }

        console.log(`Current block number: ${currentBlockNumber}`)
        console.log(`Block number to revert: ${blockNumberToRevert}`)

        

        console.log(`Reverting`)        
        await network.provider.request({
            method: "hardhat_reset",
            params: [
              {
                  forking:{
                    blockNumber: blockNumberToRevert,
                    //jsonRpcUrl: ,
                  }
                
                
              },
            ],
          });
        const newBlockNumber=await ethers.provider.getBlockNumber()
        console.log(`New block number: ${newBlockNumber}`)
        


    }catch(error){
        console.log(error)
    }
}

const revertWithSnapshot=async(snapshot)=>{
    try{    

        //console.log(`Reverting with snapshot`)        
        await network.provider.request({
            method: "evm_revert",
            params: [snapshot],
          });
    }catch(error){
        console.log(error)
    }
}

module.exports={calculateTimeAdditionTS,setNextBlockTimestamp,revertToBlock,revertWithSnapshot}