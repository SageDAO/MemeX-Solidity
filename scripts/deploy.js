// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const { ethers } = require("hardhat");
const hre = require("hardhat");
const CONTRACTS = require('../contracts.js')
//TODO: CHECK HOW TO INITIALIZE Token Supply

deploy_MemeXToken = async (deployer) => {
  
  const MemeToken = await hre.ethers.getContractFactory("MemeXToken");
  const token = await MemeToken.deploy("MEMEX", "MemeX", 1000000, deployer.address);
  await token.deployed();
  console.log("Token deployed to:", token.address);
  return token
}

deploy_Staking = async (deployer,token) => {
  const Staking = await hre.ethers.getContractFactory("MemeXStaking");
  const stake = await Staking.deploy(token.address, deployer.address);
  await stake.deployed();
  console.log("Staking deployed to:", stake.address);
  return stake
}

deploy_Lottery = async (deployer) => {
  const Lottery = await hre.ethers.getContractFactory("Lottery");
  const lottery = await Lottery.deploy(stake.address);
  await lottery.deployed();
  console.log("Lottery deployed to:", lottery.address);
  return lottery
}

set_RandomGenerator = async (lottery,rng) => {
  const Lottery = await ethers.getContractFactory("Lottery");
  lottery = await Lottery.attach(lottery);
  try{
    lottery.setRandomGenerator(CONTRACTS[hre.network]["randomnessAddress"], {gasLimit: 4000000})
  }catch (err) {
    console.log(err);
    return;
  }
  return lottery
}

deploy_Randomness = async () => {
  
  rand_address = CONTRACTS[hre.network.name]["randomnessAddress"]
  const Randomness = await hre.ethers.getContractFactory("RandomNumberConsumer");
  if (rand_address == ""){
        _vrfCoordinator = "0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B"
        _linkToken = "0x01BE23585060835E02B77ef475b0Cc51aA1e0709"
        _lotteryAddr = "0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9"
        _keyHash = "0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311"
        _fee = 1
         randomness = await Randomness.deploy(_vrfCoordinator,
          _linkToken,
          _lotteryAddr,
          _keyHash,
          _fee)
    }
  else {
     randomness =await Randomness.attach(rand_address)
  }

  return randomness
}

setLottery = async (lottery, memeNft, randomness) => {
  await memeNft.setLotteryContract(lottery)
  await randomness.setLotteryAddress(lottery)
} 

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  //await hre.run('compile');
  
  const deployer = await ethers.getSigner();
  token = await deploy_MemeXToken(deployer)
  stake = await deploy_Staking(deployer,token)
  lottery = await deploy_Lottery(deployer)
  randomness = await deploy_Randomness()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
