const fetch = require('node-fetch');
require("dotenv").config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

memeAddressEth = "0xd5525d397898e5502075ea5e830d8914f6f0affe";
memeAddressFantom = "";
provider = new ethers.providers.JsonRpcProvider(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY_PROD}`);

async function main() {
    // get last block number
    const blockNumber = await provider.getBlockNumber();

    // get last block timestamp
    const lastBlockData = await provider.getBlock(blockNumber);
    const lastBlockTimestamp = lastBlockData.timestamp;

    console.log(`Fetching MEME holders on the Ethereum network block ${blockNumber}`);
    const memeEthURL = `https://api.covalenthq.com/v1/1/tokens/${memeAddressEth}/token_holders/?block-height=${blockNumber}&page-number=0&page-size=999999999&key=${process.env.COVALENT_KEY} -H "Accept: application/json`

    // fetch url and store json result
    const memeEthResult = await fetch(memeEthURL);
    const memeEthJson = await memeEthResult.json();

    // fetch all Users - only users on the DB will receive points
    dbUsers = await prisma.user.findMany({
        select: {
            walletAddress: true,
        }
    });
    // store user wallets on a set
    usersSet = new Set();
    for (user of dbUsers) {
        usersSet.add(user.walletAddress);
    }

    // iterate through result from Covalent
    for (let i = 0; i < memeEthJson.data.items.length; i++) {
        // get address
        const address = memeEthJson.data.items[i].address;
        // get balance
        const balance = memeEthJson.data.items[i].balance;
        // if user is on the Covalent list and our Users set, update his balance on the reward table
        if (usersSet.has(address)) {
            console.log(`Updating balance - user: ${address}`)
            await prisma.reward.upsert({
                where: {
                    address: address
                },
                create: {
                    address: address,
                    memeETH: BigInt(balance),
                    snapshotTS: lastBlockTimestamp,
                },
                update: {
                    memeETH: BigInt(balance),
                    snapshotTS: lastBlockTimestamp,
                }
            });
        }
    }
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
