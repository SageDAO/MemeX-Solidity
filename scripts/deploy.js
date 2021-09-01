// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const hre = require("hardhat");
const deployer = "0x58a26F4048CdFd3785aD2139AeD336595af22fF5";
async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  //await hre.run('compile');


  const MemeToken = await hre.ethers.getContractFactory("MemeXToken");
  const token = await MemeToken.deploy("MEMEX", "MemeX", 1000000, deployer);
  await token.deployed();
  console.log("Token deployed to:", token.address);

  const Staking = await hre.ethers.getContractFactory("MemeXStaking");
  const stake = await Staking.deploy(token.address, deployer);
  await stake.deployed();
  console.log("Staking deployed to:", stake.address);


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
