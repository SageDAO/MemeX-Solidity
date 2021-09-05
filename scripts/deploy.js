// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const { ethers } = require("hardhat");
const hre = require("hardhat");
const CONTRACTS = require('../contracts.js')
//TODO: CHECK HOW TO INITIALIZE Token Supply

const timer = ms => new Promise(res => setTimeout(res, ms));

deployMemeXToken = async (deployer) => {
  token_address = CONTRACTS[hre.network.name]["tokenAddress"]
  const MemeToken = await hre.ethers.getContractFactory("MemeXToken");
  if (token_address == "") {
    token = await MemeToken.deploy("MEMEX", "MemeX", 1000000, deployer.address);
    await token.deployed();
    console.log("Token deployed to:", token.address);
    await timer(60000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: token.address,
      contract: "contracts/Token/TokenMemeX.sol:MemeXToken",
      constructorArguments: ["MEMEX", "MemeX", 1000000, deployer.address],
    });
  } else {
    token = await MemeToken.attach(token_address);
  }
  return token
}

deployPinaToken = async (deployer, lottery, stake) => {
  pina_address = CONTRACTS[hre.network.name]["pinaAddress"]
  const PinaToken = await hre.ethers.getContractFactory("PinaToken");
  if (pina_address == "") {
    pinaToken = await PinaToken.deploy("PINA", "Pina", 0,
      deployer.address, stake.address, lottery.address);
    await pinaToken.deployed();
    console.log("Pina token deployed to:", pinaToken.address);
    await timer(30000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: pinaToken.address,
      constructorArguments: ["PINA", "Pina", 0,
        deployer.address, stake.address, lottery.address],
    });
  } else {
    pinaToken = await PinaToken.attach(pina_address);
  }
  return pinaToken
}

deployStaking = async (deployer, token) => {
  staking_address = CONTRACTS[hre.network.name]["stakingAddress"]
  const Staking = await hre.ethers.getContractFactory("MemeXStaking");
  if (staking_address == "") {
    stake = await Staking.deploy(deployer.address, token.address);
    await stake.deployed();
    console.log("Staking deployed to:", stake.address);
    await timer(60000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: stake.address,
      constructorArguments: [token.address, deployer.address],
    });
  } else {
    stake = await Staking.attach(staking_address);
  }
  return stake
}

deployNFT = async (lottery) => {
  nft_address = CONTRACTS[hre.network.name]["nftAddress"]
  const Nft = await hre.ethers.getContractFactory("MemeXNFT");
  if (nft_address == "") {
    nft = await Nft.deploy("MMXNFT", "MMXNFT", lottery);
    await nft.deployed();
    console.log("NFT deployed to:", nft.address);
    await timer(60000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: nft.address,
      constructorArguments: ["MMXNFT", "MMXNFT", lottery],
    });
  } else {
    nft = await Nft.attach(nft_address);
  }
  return nft
}

deployLottery = async () => {
  lottery_address = CONTRACTS[hre.network.name]["lotteryAddress"]
  const Lottery = await hre.ethers.getContractFactory("Lottery");
  if (lottery_address == "") {
    lottery = await Lottery.deploy(stake.address);
    await lottery.deployed();
    console.log("Lottery deployed to:", lottery.address);
    await timer(60000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: lottery.address,
      constructorArguments: [stake.address],
    });
  } else {
    lottery = await Lottery.attach(lottery_address);
  }
  return lottery
}

deployRandomness = async () => {

  rand_address = CONTRACTS[hre.network.name]["randomnessAddress"]
  const Randomness = await hre.ethers.getContractFactory("RandomNumberConsumer");
  if (rand_address == "") {
    _vrfCoordinator = "0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B"
    _linkToken = "0x01BE23585060835E02B77ef475b0Cc51aA1e0709"
    _lotteryAddr = CONTRACTS[hre.network.name]["lotteryAddress"]
    _keyHash = "0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311"
    _fee = hre.ethers.BigNumber.from("100000000000000000") // 0.1 LINK
    randomness = await Randomness.deploy(_vrfCoordinator,
      _linkToken,
      _lotteryAddr,
      _keyHash,
      _fee)
    console.log("Randomness deployed to:", randomness.address);
    await timer(60000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: randomness.address,
      constructorArguments: [_vrfCoordinator,
        _linkToken,
        _lotteryAddr,
        _keyHash,
        _fee],
    });
  }
  else {
    randomness = await Randomness.attach(rand_address)
  }

  return randomness
}

setLottery = async (lottery, randomness) => {
  console.log(`Setting ${lottery.address} on randomness ${randomness.address}`)
  await randomness.setLotteryAddress(lottery.address, { gasLimit: 4000000 })
}

setRandomGenerator = async (lottery, rng) => {
  console.log(`Setting ${rng} on lottery ${lottery.address}`);
  await lottery.setRandomGenerator(rng, { gasLimit: 4000000 });
}

stakeFunds = async (accounts, stake, token) => {
  await token.transfer(accounts[1].address, ethers.BigNumber.from("10000000000000000000"), { gasLimit: 4000000 });
  await token.connect(accounts[1]).approve(stake.address, ethers.BigNumber.from("10000000000000000000"), { gasLimit: 4000000 });
  await token.approve(stake.address, ethers.BigNumber.from("10000000000000000000"), { gasLimit: 4000000 });
  await stake.stake(3, ethers.BigNumber.from("5000000000000000000"), { gasLimit: 4000000 });
}

createPool = async (stake, pinaToken, deployer) => {
  const latestBlock = await ethers.provider.getBlock(await ethers.provider.getBlockNumber());
  ts = latestBlock.timestamp;
  await stake.createPool(
    3,
    ts,
    ethers.BigNumber.from("5000000000000000000"),
    11574074074000, // reward rate
    pinaToken.address,
    0,
    deployer.address);
}

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  //await hre.run('compile');

  const deployer = await ethers.getSigner();
  const accounts = await ethers.getSigners();
  token = await deployMemeXToken(deployer);
  stake = await deployStaking(deployer, token);
  lottery = await deployLottery();
  pina = await deployPinaToken(deployer, lottery, stake);
  nft = await deployNFT(lottery.address);
  randomness = await deployRandomness();
  //await setLottery(lottery, randomness);
  //await setRandomGenerator(lottery, randomness.address);
  await createPool(stake, pina, deployer);
  await stakeFunds(accounts, stake, token);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
