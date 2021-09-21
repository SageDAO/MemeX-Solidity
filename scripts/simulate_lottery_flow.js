// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const { ethers } = require("hardhat");
const hre = require("hardhat");
const CONTRACTS = require('../contracts.js')

buyTickets = async (_lotteryId, lottery) => {
  const [...accounts] = await ethers.getSigners();
  tx = await lottery.connect(accounts[0]).buyTickets(_lotteryId, 2, { gasLimit: 4000000 });
  //await lottery.connect(accounts[1]).buyTicket(_lotteryId)
  //tx = await lottery.connect(accounts[2]).buyTicket(_lotteryId)
  receipt = await tx.wait();
}

joinMemex = async (staking) => {
  const [...accounts] = await ethers.getSigners();
  tx = await staking.connect(accounts[0]).join({ gasLimit: 4000000 });
}

createLottery = async (lottery, memeX) => {
  const [...accounts] = await ethers.getSigners();
  deployer = accounts[0]
  _nftContract = memeX.address
  _prizeIds = 2
  _costPerTicket = ethers.BigNumber.from("1000000000000000000");


  const latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
  timestamp = latestBlock.timestamp;
  _startingTime = timestamp
  _closingTime = timestamp + 24 * 60 * 60
  lotteryId = lottery.createNewLottery(
    _costPerTicket,
    0,
    _startingTime,
    _closingTime,
    _nftContract,
    _prizeIds,
    0, 0,
    {
      gasLimit: 4000000
    })

  return lotteryId

}

getStakingContract = async () => {
  stake_address = CONTRACTS[hre.network.name]["softStakeAddress"]
  const Staking = await hre.ethers.getContractFactory("SoftStaking");
  return await Staking.attach(stake_address);
}

getLotteryContract = async () => {
  lottery_address = CONTRACTS[hre.network.name]["lotteryAddress"]
  const Lottery = await hre.ethers.getContractFactory("Lottery");
  return await Lottery.attach(lottery_address);
}

getNFTContract = async () => {
  nft_address = CONTRACTS[hre.network.name]["nftAddress"]
  const NFT = await hre.ethers.getContractFactory("MemeXNFT");
  return await NFT.attach(nft_address);
}

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  await hre.run('compile');
  const [...accounts] = await ethers.getSigners();
  deployer = accounts[0].address
  stake = await getStakingContract()
  lottery = await getLotteryContract()
  nft = await getNFTContract();

  // console.log("Creating new lottery");
  // tx = await createLottery(lottery, nft)
  // const receipt = await tx.wait();
  lotteryId = (await lottery.getCurrentLotteryId()).toNumber();

  // console.log("Joining memex")
  // await joinMemex(stake)
  console.log("buying tickets");
  await buyTickets(lotteryId, lottery);

  tx = await lottery.boostParticipant(lotteryId, accounts[0].address, { gasLimit: 4000000 });
  await tx.wait();

  console.log("Requesting random seed from oracle")
  tx = await lottery.drawWinningNumbers(lotteryId, { gasLimit: 4000000 });
  await tx.wait()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
