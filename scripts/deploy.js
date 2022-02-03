// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const { ethers, upgrades } = require("hardhat");
const hre = require("hardhat");
const CONTRACTS = require("../contracts.js");

const timer = (ms) => new Promise((res) => setTimeout(res, ms));

deployRewards = async (deployer) => {
  rewards_address = CONTRACTS[hre.network.name]["rewardsAddress"];
  const Rewards = await hre.ethers.getContractFactory("Rewards");
  if (rewards_address == "") {
    rewards = await Rewards.deploy(deployer.address);
    await rewards.deployed();
    console.log("Rewards contract deployed to:", rewards.address);
    await timer(40000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: rewards.address,
      constructorArguments: [deployer.address],
    });
    return [rewards, true];
  } else {
    rewards = Rewards.attach(rewards_address);
  }
  return [rewards, false];
};

deployNFT = async (deployer, lottery) => {
  nft_address = CONTRACTS[hre.network.name]["nftAddress"];
  const Nft = await hre.ethers.getContractFactory("MemeXNFT");
  if (nft_address == "") {
    console.log("deploying NFT contract");
    nft = await Nft.deploy("MemeX NFTs", "MemeXNFT", deployer.address);
    await nft.deployed();
    console.log("NFT deployed to:", nft.address);
    // await timer(40000); // wait so the etherscan index can be updated, then verify the contract code
    // await hre.run("verify:verify", {
    //   address: nft.address,
    //   constructorArguments: ["MemeX NFTs", "MemeXNFT", deployer.address],
    // });
    return [nft, true];
  } else {
    nft = Nft.attach(nft_address);
  }
  return [nft, false];
};

deployLottery = async (rewards, randomness, deployer) => {
  lottery_address = CONTRACTS[hre.network.name]["lotteryAddress"];
  const Lottery = await hre.ethers.getContractFactory("MemeXLottery");
  if (lottery_address == "") {
    // lottery = await Lottery.deploy(rewards.address, deployer.address);
    const lottery = await upgrades.deployProxy(Lottery, [rewards.address, deployer.address]);
    await lottery.deployed();
    console.log("Lottery deployed to:", lottery.address);
    await timer(60000); // wait so the etherscan index can be updated, then verify the contract code
    // await hre.run("verify:verify", {
    //   address: lottery.address,
    //   constructorArguments: [rewards.address, deployer.address],
    // });
    return [lottery, true];
  } else {
    lottery = Lottery.attach(lottery_address);
  }
  return [lottery, false];
};

deployRandomness = async () => {
  rand_address = CONTRACTS[hre.network.name]["randomnessAddress"];
  const Randomness = await hre.ethers.getContractFactory("RandomNumberConsumer");
  if (rand_address == "") {
    _vrfCoordinator = "0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B";
    _linkToken = "0x01BE23585060835E02B77ef475b0Cc51aA1e0709";
    _lotteryAddr = CONTRACTS[hre.network.name]["lotteryAddress"];
    _keyHash = "0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311";
    _fee = ethers.utils.parseEther("0.1"); // 0.1 LINK
    randomness = await Randomness.deploy(_vrfCoordinator, _linkToken, _lotteryAddr, _keyHash, _fee);
    console.log("Randomness deployed to:", randomness.address);
    await timer(60000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: randomness.address,
      constructorArguments: [_vrfCoordinator, _linkToken, _lotteryAddr, _keyHash, _fee],
    });
    return [randomness, true];
  } else {
    randomness = await Randomness.attach(rand_address);
  }

  return [randomness, false];
};

deployAuction = async (deployer) => {
  auction_address = CONTRACTS[hre.network.name]["auctionAddress"];
  const Auction = await hre.ethers.getContractFactory("MemeXAuction");
  if (auction_address == "") {
    const auction = await Auction.deploy(deployer.address);
    await auction.deployed();
    console.log("Auction deployed to:", auction.address);
    // await timer(60000); // wait so the etherscan index can be updated, then verify the contract code
    // await hre.run("verify:verify", {
    //   address: auction.address,
    //   constructorArguments: [deployer.address],
    // });
    return [auction, true];
  } else {
    auction = Auction.attach(auction_address);

  }
  return [auction, false];
}

deployRNGTemp = async () => {
  rand_address = CONTRACTS[hre.network.name]["randomnessAddress"];
  const Randomness = await hre.ethers.getContractFactory("RNGTemp");
  if (rand_address == "") {
    _lotteryAddr = CONTRACTS[hre.network.name]["lotteryAddress"];
    randomness = await Randomness.deploy(_lotteryAddr);
    console.log("Randomness deployed to:", randomness.address);
    await timer(60000); // wait so the etherscan index can be updated, then verify the contract code
    await hre.run("verify:verify", {
      address: randomness.address,
      constructorArguments: [_lotteryAddr],
    });
    return [randomness, true];
  } else {
    randomness = await Randomness.attach(rand_address);
  }

  return [randomness, false];
};

setRandomGenerator = async (lottery, rng) => {
  console.log(`Setting RNG ${rng} on lottery ${lottery.address}`);
  await lottery.setRandomGenerator(rng, { gasLimit: 4000000 });
};

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  //await hre.run('compile');

  const deployer = await ethers.getSigner();

  result = await deployRewards(deployer);
  rewards = result[0];
  newRewards = result[1];
  values = await deployRNGTemp();
  randomness = values[0];
  newRandomness = values[1];

  result = await deployLottery(rewards, randomness, deployer);
  lottery = result[0];
  newLottery = result[1];

  result = await deployNFT(deployer, lottery);
  nft = result[0];
  newNft = result[1];

  result = await deployAuction(deployer);
  auction = result[0];
  newAuction = result[1];

  // if launching from scratch, update all contract references and roles just once
  if (newRandomness && newNft && newLottery && newRewards) {
    await randomness.setLotteryAddress(lottery.address);
    await lottery.setRandomGenerator(randomness.address);
    await lottery.setRewardsContract(rewards.address);
    await nft.addSmartContractRole(lottery.address);
    await rewards.addSmartContractRole(lottery.address);
  } else { // else, update only the new contract references
    
    if (newRandomness) {
      if (lottery && lottery.address != "") {
        await randomness.setLotteryAddress(lottery.address);
        await lottery.setRandomGenerator(randomness.address);
      }
    }
  
    if (newNft) {
      if (lottery && lottery.address != "") {
        await nft.addSmartContractRole(lottery.address);
      }
    }
  
    if (newLottery) {
      await lottery.setRandomGenerator(randomness.address);
      await lottery.setRewardsContract(rewards.address);
      await nft.addSmartContractRole(lottery.address);
      await rewards.addSmartContractRole(lottery.address);
      await randomness.setLotteryAddress(lottery.address);
    }
    if (newRewards) {
      if (lottery && lottery.address != "") {
        await rewards.addSmartContractRole(lottery.address);
        await lottery.setRewardsContract(rewards.address);
      }
    }

    if (newAuction) {
      await nft.addSmartContractRole(auction.address);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
