const fetch = require('node-fetch');
require("dotenv").config();
const hre = require("hardhat");
const ethers = hre.ethers;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const memeAddressEth = "0xd5525d397898e5502075ea5e830d8914f6f0affe";
const memeAddressFantom = "";
const providerEth = new ethers.providers.JsonRpcProvider(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY_PROD}`);

const CONTRACTS = require('../contracts.js');

async function main() {
    await hre.run('compile');
    const Rewards = await ethers.getContractFactory("Rewards");
    rewardsAddress = CONTRACTS[hre.network.name]["rewardsAddress"];
    rewardsContract = await Rewards.attach(rewardsAddress);

    // get last block number
    const blockNumber = await providerEth.getBlockNumber();

    // get last block timestamp
    const lastBlockData = await providerEth.getBlock(blockNumber);
    const lastBlockTimestamp = lastBlockData.timestamp;

    const buf2hex = x => '0x' + x.toString('hex');

    console.log(`Fetching MEME holders on the Ethereum network block ${blockNumber}`);
    const memeEthURL = `https://api.covalenthq.com/v1/1/tokens/${memeAddressEth}/token_holders/?block-height=${blockNumber}&page-number=0&page-size=999999999&key=${process.env.COVALENT_KEY} -H "Accept: application/json`

    // query Covalent for all MEME holders and store json result
    const memeEthResult = await fetch(memeEthURL);
    const memeEthJson = await memeEthResult.json();

    // fetch all DB Users - only users in our DB will receive points
    dbUsers = await prisma.reward.findMany({
        select: {
            address: true,
            memeETH: true,
            memeFTM: true,
        }
    });

    memeEthHolders = new Map();
    // iterate through result from Covalent
    for (let i = 0; i < memeEthJson.data.items.length; i++) {
        // get address
        const address = memeEthJson.data.items[i].address;
        // get balance
        const balance = memeEthJson.data.items[i].balance;

        memeEthHolders.set(address, balance);
    }

    addresses = [];
    balances = [];
    liquidity = [];

    for (user of dbUsers) {
        memeEthUpdatedBalance = memeEthHolders.has(user.address) ? memeEthHolders.get(user.address) : 0;
        if (user.memeETH != memeEthUpdatedBalance) {
            console.log(`Updating balance - user: ${user.address}`);
            addresses.push(user.address);
            balances.push(memeEthUpdatedBalance);
            liquidity.push(0);
            await prisma.reward.update({
                where: {
                    address: user.address
                },
                data: {
                    memeETH: Number(memeEthUpdatedBalance),
                }
            });
        }
    }
    await rewardsContract.updateBalanceBatch(addresses, balances, liquidity);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
