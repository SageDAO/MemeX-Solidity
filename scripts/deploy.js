// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const { ethers } = require("hardhat");
const hre = require("hardhat");
const { factory } = require("typescript");
const CONTRACTS = require('../contracts.js')
//TODO: CHECK HOW TO INITIALIZE Token Supply

const timer = ms => new Promise(res => setTimeout(res, ms));

const TEN_POW_18 = "1000000000000000000";

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

deployMemeXFactory = async (owner) => {
  memeXFactory_address = CONTRACTS[hre.network.name]["memeXFactoryAddress"]
  const MemeXFactory = await hre.ethers.getContractFactory("MemeXFactory")
  if (memeXFactoryAddress == "") {
    memeXFactory = await MemeXFactory.deploy(owner.address)
    await memeXFactory.deployed()
    console.log("MemeXFactory deployed to: ", memeXFactory.address)
    await timer(60000);
    await hre.run("verify:verify", {
      address: memeXFactory.address,
      contract: "contracts/Factory/MemeXFactory.sol:MemeXFactory",
      constructorArguments: [memeXFactory.address]
    });
  } else {
    memeXFactory = await MemeXFactory.attach(memeXFactory_address)
  }

  return memeXFactory
}

deployPinaToken = async (deployer, rewards) => {
  pina_address = CONTRACTS[hre.network.name]["pinaAddress"]
  const PinaToken = await hre.ethers.getContractFactory("PinaToken");
  if (pina_address == "") {
    console.log("deploying pina token")
    pinaToken = await PinaToken.deploy("PINA", "Pina", 0,
      deployer.address, rewards.address);
    await pinaToken.deployed();
    console.log("Pina token deployed to:", pinaToken.address);
    await timer(30000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: pinaToken.address,
      constructorArguments: ["PINA", "Pina", 0,
        deployer.address, rewards.address],
    });
  } else {
    pinaToken = await PinaToken.attach(pina_address);
  }
  return pinaToken
}

deployRewards = async (deployer, token) => {
  rewards_address = CONTRACTS[hre.network.name]["rewardsAddress"]
  const Rewards = await hre.ethers.getContractFactory("Rewards");
  if (rewards_address == "") {
    rewards = await Rewards.deploy(token.address, token.address, 11574074074000, 115740740740000); // TODO: change to MEME and liquidity address
    await rewards.deployed();
    console.log("Rewards contract deployed to:", rewards.address);
    await timer(40000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: rewards.address,
      constructorArguments: [token.address, token.address, 11574074074000, 115740740740000],
    });
  } else {
    rewards = await Rewards.attach(rewards_address);
  }
  return rewards
}

deployNFT = async (lottery) => {
  nft_address = CONTRACTS[hre.network.name]["nftAddress"]
  const Nft = await hre.ethers.getContractFactory("MemeXNFTBasic");
  if (nft_address == "") {
    console.log("deploying NFT token")
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


deployNFTByFactory = async (MemeXFactory, name, symbol, admin, lottery) => {
  nft_address = CONTRACTS[hre.network.name]["nftAddress"]
  const NFT = await hre.ethers.getContractFactory("MemeXNFTBasic")

  if (nft_address == "") {

    tx = await MemeXFactory.connect(admin).deployMemeXNFT(name, symbol)
    const res = await tx.wait()
    nft_address = res.events[1].args[1]
    deployedNFT = await NFT.attach(nft_address)
    deployedNFT.setLotteryContract(_lotteryAddress)
    await timer(60000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: deployedNFT.address,
      constructorArguments: [name, symbol],
    });
  } else {
    deployedNFT = await NFT.attach(nft_address)
  }
  return nft
}
deployLottery = async (rewards) => {
  lottery_address = CONTRACTS[hre.network.name]["lotteryAddress"]
  const Lottery = await hre.ethers.getContractFactory("Lottery");
  if (lottery_address == "") {
    lottery = await Lottery.deploy(rewards.address);
    await lottery.deployed();
    console.log("Lottery deployed to:", lottery.address);
    await timer(60000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: lottery.address,
      constructorArguments: [rewards.address],
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
    _fee = ethers.utils.parseEther("0.1"); // 0.1 LINK
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

setLottery = async (lottery, randomness, pina, nft, rewards) => {
  console.log(`Setting lottery ${lottery.address} on randomness ${randomness.address}`)
  await randomness.setLotteryAddress(lottery.address, { gasLimit: 4000000 })
  await pina.setLotteryContract(lottery.address, { gasLimit: 4000000 })
  await nft.setLotteryContract(lottery.address, { gasLimit: 4000000 })
  await rewards.setLotteryAddress(lottery.address, { gasLimit: 4000000 })
}

setRewards = async (pina, rewards) => {
  console.log(`Setting rewards contract ${rewards.address} on pina ${pina.address}`);
  await pina.setRewardsContract(rewards.address, { gasLimit: 4000000 });
}

setRandomGenerator = async (lottery, rng) => {
  console.log(`Setting RNG ${rng} on lottery ${lottery.address}`);
  await lottery.setRandomGenerator(rng, { gasLimit: 4000000 });
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
  rewards = await deployRewards(deployer, token);
  pina = await deployPinaToken(deployer, rewards);
  lottery = await deployLottery(rewards);



  nft = await deployNFT(lottery.address);
  randomness = await deployRandomness();
  await setLottery(lottery, randomness, pina, nft, rewards);
  await setRewards(pina, rewards);
  await setRandomGenerator(lottery, randomness.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
