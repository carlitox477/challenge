const { expect } = require("chai");
const { ethers,deployments, getNamedAccounts} = require("hardhat");

describe("ETHPool", function () {
  let ETHPool
  const ETHPoolConnections={admin:undefined, teamMember:undefined}
  const namedAccounts={admin:undefined, teamMember:undefined}

  before(async()=>{
    await deployments.fixture("ETHPool")
    ETHPool=await ethers.getContract(["ETHPool"])
    const {admin,teamMember}=await getNamedAccounts()
    

    namedAccounts.admin=admin;
    namedAccounts.teamMember=teamMember;

    ETHPoolConnections.admin=ETHPool.connect(await ethers.getSigner(admin))
    ETHPoolConnections.teamMember=ETHPool.connect(await ethers.getSigner(teamMember))
  })

  it("Should have the correct initial attributes", async()=>{
    const ownerCode=await ETHPool.OWNER()
    const teamMemberCode=await ETHPool.TEAM_MEMBER()
    const initialRewards = ethers.utils.parseEther("1");
    
    expect(await ETHPool.getRoleAdmin(teamMemberCode), "Incorrect expected admin role setted").to.be.equal(ownerCode)
    expect(await ETHPool.hasRole(ownerCode,namedAccounts.admin), "Incorrect expected owner").to.be.true
    expect(await ETHPool.getCurrentPromisedRewards(), "Incorrect expected admin role setted").to.be.equal(initialRewards)
  })

  it("Should allow the owner to asign team member role", async()=> {
    const teamMemberCode=await ETHPool.TEAM_MEMBER()
    
    await ETHPoolConnections.admin.grantRole(teamMemberCode,namedAccounts.teamMember);
    expect(await ETHPool.hasRole(teamMemberCode,namedAccounts.teamMember),"Setting team member role has failed").to.be.true;
  });


  










});
