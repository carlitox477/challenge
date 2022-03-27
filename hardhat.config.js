require('hardhat-deploy');
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("hardhat-deploy-ethers");

require('dotenv').config({path:__dirname+'/.env'});

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
  defaultNetwork: "hardhat",
  networks:{
    kovan:{
      url: `https://speedy-nodes-nyc.moralis.io/${process.env.PROJECT_ID}/eth/kovan`,
      accounts: [process.env.PRIVATE_KEY]
    },
  },
  etherscan:{
    apiKey: process.env.ETHERSCAN_API_KEY
  },
  namedAccounts:{
    admin:0,
    staker1: 1,
    staker2: 2,
    staker3: 3,
    teamMember:4,
  }
};
