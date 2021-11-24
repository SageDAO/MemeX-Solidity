const hre = require("hardhat");
const ethers = hre.ethers;
const CONTRACTS = require('../contracts.js');

const lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
const nftAddress = CONTRACTS[hre.network.name]["nftAddress"];

async function main() {
    await hre.run('compile');
    const owner = await ethers.getSigner();

    const Lottery = await ethers.getContractFactory("Lottery");
    const lottery = await Lottery.attach(lotteryAddress);
    result = await lottery.createNewLottery(
        100000000, // cost in PINA
        0, // cost in FTM
        Date.now() / 1000, //start 
        Date.now() / 1000 + 86400 * 30, // end
        nftAddress, // nft contract
        0, // boost cost in FTM
        0, // max participants
        owner.address, // artist address
        'ipfs://bafybeib4cmjiwsekisto2mqivril4du5prsetasd7izormse4rovnqxsze/');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.stack);
        process.exit(1);
    });