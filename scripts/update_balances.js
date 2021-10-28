const fetch = require('node-fetch');
require("dotenv").config();
const hre = require("hardhat");
const ethers = hre.ethers;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const memeAddressEth = "0xd5525d397898e5502075ea5e830d8914f6f0affe";
const memeAddressFantom = "0xe3d7a068a7d99ee79d9112d989c5aff4e7594a21";
const providerEth = new ethers.providers.JsonRpcProvider(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY_PROD}`);
const providerAnkr = new ethers.providers.JsonRpcProvider(`https://apis.ankr.com/${process.env.ANKR_KEY_MAINNET}/fantom/full/main`);
const CONTRACTS = require('../contracts.js');

async function main() {
    await hre.run('compile');
    const Rewards = await ethers.getContractFactory("Rewards");
    rewardsAddress = CONTRACTS[hre.network.name]["rewardsAddress"];
    rewardsContract = await Rewards.attach(rewardsAddress);

    const covalentResultEth = await covalentFetchHolders(providerEth, 1, memeAddressEth);
    const covalentResultFantom = await covalentFetchHolders(providerAnkr, 250, memeAddressFantom);

    // fetch all DB Users - only users in our DB will receive points
    dbUsers = await prisma.reward.findMany({
        select: {
            address: true,
            meme: true,
        }
    });

    ethHolders = createMemeHoldersMap(covalentResultEth);
    fantomHolders = createMemeHoldersMap(covalentResultFantom);

    addresses = [];
    balances = [];
    liquidity = [];

    for (user of dbUsers) {
        memeUpdatedBalance = ethHolders.has(user.address) ? ethHolders.get(user.address) : 0;
        memeUpdatedBalance += fantomHolders.has(user.address) ? fantomHolders.get(user.address) : 0;
        if (user.meme != memeUpdatedBalance) {
            console.log(`Updating balance - user: ${user.address}`);
            addresses.push(user.address);
            balances.push(memeUpdatedBalance);
            liquidity.push(0);
            await prisma.reward.update({
                where: {
                    address: user.address
                },
                data: {
                    meme: Number(memeUpdatedBalance),
                }
            });
        }
    }
    await rewardsContract.updateBalanceBatch(addresses, balances, liquidity);
    console.log(`Updated balances for ${addresses.length} users`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

function createMemeHoldersMap(covalentResult) {
    holdersMap = new Map();
    // iterate through result from Covalent
    for (let i = 0; i < covalentResult.data.items.length; i++) {
        // get address
        const address = covalentResult.data.items[i].address;
        // get balance
        const balance = covalentResult.data.items[i].balance;

        holdersMap.set(address, balance);
    }
    return holdersMap;
}

async function covalentFetchHolders(provider, chainId, memeAddress) {
    const blockNumber = await provider.getBlockNumber();

    console.log(`Fetching MEME holders on chainId ${chainId} block ${blockNumber}`);
    const convalentURL = `https://api.covalenthq.com/v1/${chainId}/tokens/${memeAddress}/token_holders/?block-height=${blockNumber}&page-number=0&page-size=999999999&key=${process.env.COVALENT_KEY} -H "Accept: application/json`;
    // query Covalent for all MEME holders and return the result
    const result = await fetch(convalentURL);
    const resultJson = await result.json();
    return resultJson;
}

