const BigNumber = require('bignumber.js');
const hre = require("hardhat");
const ethers = hre.ethers;
const deployer = ethers.getSigner().address;

const CONTRACTS = require('../contracts.js');
const createLogger = require("./logs.js");
const lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
const nftAddress = CONTRACTS[hre.network.name]["nftAddress"];
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const logger = createLogger('memex_scripts', 'create_lotteries_from_db');

async function main() {
    await hre.run('compile');

    const Lottery = await ethers.getContractFactory("MemeXLottery");
    const lottery = await Lottery.attach(lotteryAddress);

    const NFT = await hre.ethers.getContractFactory("MemeXNFT");
    const nftContract = await NFT.attach(nftAddress);

    // find drops approved but not yet created on chain
    let drops = await fetchDropsReadyForBlockchain();
    // iterate over json content
    for (const drop of drops) {

        // create new lottery and update metadata with lotteryId
        logger.info("Creating new lottery with #id: " + drop.lotteryId);
        await lottery.createNewLottery(
            drop.costPerTicketPoints,
            drop.costPerTicketCoins,
            drop.startTime / 1000,
            drop.endTime / 1000,
            nftContract.address,
            drop.maxParticipants,
            drop.CreatedBy.walletAddress,
            drop.metadataIpfsPath
        );
        // TODO: substitute for getCurrentLotteryId
        drop.lotteryId = (await lottery.getCurrentLotteryId()).toNumber() + 1;
        drop.blockchainCreatedAt = new Date();
        await prisma.drop.update({
            where: {
                id: drop.id
            },
            data: {
                lotteryId: drop.lotteryId,
                blockchainCreatedAt: drop.blockchainCreatedAt
            }
        });
    }
}

function exit(code) {
    process.exit(code);
}

main()
    .then(() => setTimeout(exit, 2000, 0))
    .catch((error) => {
        logger.error(error.stack);
        setTimeout(exit, 2000, 1);
    });

async function fetchDropsReadyForBlockchain() {
    return await prisma.drop.findMany(
        {
            where: {
                approvedAt: {
                    not: null
                },
                blockchainCreatedAt: {
                    equals: null
                }
            },
            include: {
                CreatedBy: true,
            }
        }
    );
}

