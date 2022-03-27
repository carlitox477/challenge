const { ethers } = require("hardhat");
const {calculateTimeAdditionTS}= require("../scripts/time-utils-scripts.js")


module.exports = async ({getNamedAccounts, deployments}) => {
  const {deploy} = deployments;

  const {admin} = await getNamedAccounts();
    
  
  const lastBlock=await ethers.provider.getBlock()


  const stakeLimitDay=calculateTimeAdditionTS(0,2)+lastBlock.timestamp

  
  await deploy('ETHPool', {
    from: admin,
    args:[
      ethers.utils.parseEther("1"),
      stakeLimitDay
    ],
    log: true,
  });
 
};

module.exports.tags = ['ETHPool'];