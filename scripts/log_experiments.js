const hre = require("hardhat");
const ethers = hre.ethers;
const CONTRACTS = require('../contracts.js');

const lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
const nftAddress = CONTRACTS[hre.network.name]["nftAddress"];
const auctionAddress = CONTRACTS[hre.network.name]["auctionAddress"];


const timeoutPromise = (time) => {
    return new Promise((resolve, reject) => { setTimeout(() =>
        resolve(), time); });
}

async function main() {
    await hre.run('compile');
    const owner = await ethers.getSigner();
    const id = process.argv.slice(2)[0];
    const Lottery = await ethers.getContractFactory("MemeXLottery");
    const lottery = await Lottery.attach(lotteryAddress);
    const coder = new ethers.utils.AbiCoder();
    const Auction = await hre.ethers.getContractFactory("MemeXAuction");
    auction = Auction.attach(auctionAddress);


      logs = await ethers.provider.getLogs({
        address: auctionAddress,
        fromBlock: 1,
        topics:[ethers.utils.id('BidPlaced(uint256,address,uint256,uint256)'), coder.encode(['uint'], [id])]
      })
    
      logs.forEach(log => {
        parsed = auction.interface.parseLog(log);
        
        console.log(parsed);
    });
    console.log(logs.length)

    // lottery.on(filter, (id, number, addressIdx, address, withPoints) => {
    //     console.log(`NewEntry: ${id}, ${number}, ${addressIdx}, ${address}, ${withPoints}`);
    // });


    // lottery.on('NewEntry', (id, number, addressIdx, address, withPoints) => {
    //     console.log(`NewEntry: ${id}, ${number}, ${addressIdx}, ${address}, ${withPoints}`);
    // });

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.stack);
        process.exit(1);
});