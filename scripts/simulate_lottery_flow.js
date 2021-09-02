// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const { ethers } = require("hardhat");
const hre = require("hardhat");
const CONTRACTS = require('../contracts.js')
//TODO: CHECK HOW TO INITIALIZE Token Supply

deploy_MemeXNFT = async(deployer,lottery) => {
    _name = "MemeX NFTs"
    _symbol = "MMXNFT"
    const MemeToken = await hre.ethers.getContractFactory("MemeXNFT");
    console.log("deploying NFT ____________-",lottery.address)
    const NFT = await MemeToken.deploy(_name, _symbol,lottery.address)
    await NFT.deployed()
    return NFT
}

deploy_MemeXToken = async (deployer) => {
  
  const MemeToken = await hre.ethers.getContractFactory("MemeXToken");
  const token = await MemeToken.deploy("MEMEX", "MemeX", 1000000, deployer);
  await token.deployed();
  console.log("Token deployed to:", token.address);
  return token
}

deploy_Staking = async (deployer,token) => {
  const Staking = await hre.ethers.getContractFactory("MemeXStaking");
  const stake = await Staking.deploy(token.address, deployer);
  await stake.deployed();
  console.log("Staking deployed to:", stake.address);
  return stake
}

deploy_Lottery = async (deployer,stake) => {
  const Lottery = await hre.ethers.getContractFactory("Lottery");
  const lottery = await Lottery.deploy(stake.address);
  await lottery.deployed();
  
  console.log("Lottery deployed to:", lottery.address);
  return lottery
}

buy_tickets = async (_lotteryId, lottery) => {
    const [...accounts] = await ethers.getSigners();
    
    await lottery.connect(accounts[1]).buyTicket(_lotteryId)
    await lottery.connect(accounts[2]).buyTicket(_lotteryId)
}

create_Lottery = async (lottery, memeX) => {
    const [...accounts]  = await ethers.getSigners();
    deployer = accounts[0]
    _nftContract = memeX.address
    _prizeIds = [1,2]
    _costPerTicket = 0
    

    //Research How to get current Time and Block in Hardhat
    var timestamp = Number(new Date()); 
    _startingTime = timestamp
    _closingTime = timestamp + 24 * 60 * 60
    lotteryId = lottery.createNewLottery(
        _costPerTicket, 
        _startingTime, 
        _closingTime, 
        _nftContract, 
        _prizeIds, 
        0, 0, 
        "https://bafybeib4cmjiwsekisto2mqivril4du5prsetasd7izormse4rovnqxsze.ipfs.dweb.link/{id}.json", 
        2, 
        {
            gasLimit: 4000000
        })
    
    return lotteryId

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
  console.log("lottery complete")
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
  const [...accounts]  = await ethers.getSigners();
  deployer = accounts[0].address
  console.log("deploying memex token")
  console.log(deployer)
  token = await deploy_MemeXToken(deployer)

  console.log("deploying memex token2")
  
  stake = await deploy_Staking(deployer,token)
  console.log("deploying staking")
  lottery = await deploy_Lottery(deployer,stake)
  console.log("deploying nft")
  nft = await deploy_MemeXNFT(deployer,lottery)
  
  
  console.log("deploying randomness")
  randomness = await deploy_Randomness()
  console.log("deploying randomness Complete")
  lotteryId = await create_Lottery(lottery, nft)
  //TODO HOW TO GET LOTTERY ID?
  lottery = await buy_tickets(1, lottery)

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
