const fetch = require('node-fetch');
require("dotenv").config();
const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256');
const hre = require("hardhat");
const ethers = hre.ethers;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const memeAddressEth = "0xd5525d397898e5502075ea5e830d8914f6f0affe";
const memeAddressFantom = "";
const provider = new ethers.providers.JsonRpcProvider(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY_PROD}`);

const CONTRACTS = require('../contracts.js');
var abiCoder = ethers.utils.defaultAbiCoder;
const publishRewardTree = process.argv.slice(2)[0];

async function main() {
    await hre.run('compile');
    const Rewards = await ethers.getContractFactory("Rewards");
    rewardsAddress = CONTRACTS[hre.network.name]["rewardsAddress"];
    rewardsContract = await Rewards.attach(rewardsAddress);
    leaves = new Array();
    // get last block number
    const blockNumber = await provider.getBlockNumber();

    // get last block timestamp
    const lastBlockData = await provider.getBlock(blockNumber);
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
        }
    });
    // store user wallets in a set
    dbUsersSet = new Set();
    for (user of dbUsers) {
        dbUsersSet.add(user.address);
    }
    tokenHolders = new Set();
    // iterate through result from Covalent
    for (let i = 0; i < memeEthJson.data.items.length; i++) {
        // get address
        const address = memeEthJson.data.items[i].address;
        tokenHolders.add(address);

        // get balance
        const balance = memeEthJson.data.items[i].balance;

        // if user is on the Covalent list AND on our DB, update his balance 
        if (dbUsersSet.has(address)) {
            console.log(`Updating balance - user: ${address}`)
            await prisma.reward.update({
                where: {
                    address: address
                },
                data: {
                    memeETH: BigInt(balance),
                    snapshotTS: lastBlockTimestamp,
                }
            });
            earnedPoints = await prisma.$queryRawUnsafe(`SELECT earned('${address}', ${lastBlockTimestamp});`);
            console.log("earned: " + earnedPoints[0].earned);
            leaves.push({
                address: address,
                points: earnedPoints[0].earned,
            });
        }
    }
    // if a user had balance stored but now he's not on the Covalent list, update his balance to 0
    for (user of dbUsers) {
        if (user.memeETH != 0 && !tokenHolders.has(user.address)) {
            console.log(`Updating balance - user: ${user.address}`)
            await prisma.reward.update({
                where: {
                    address: user.address
                },
                data: {
                    memeETH: BigInt(0),
                    snapshotTS: lastBlockTimestamp,
                }
            });
        }
    }

    if (publishRewardTree) {
        console.log(`Publishing rewards`);
        hashedLeaves = leaves.map(leaf => getEncodedLeaf(leaf));
        const tree = new MerkleTree(hashedLeaves, keccak256, { sortPairs: true });

        const root = tree.getHexRoot().toString('hex');
        console.log(`Storing Merkle tree root in the contract: ${root}`);
        await rewardsContract.setMerkleRoot(root);

        // generate proofs for each reward
        for (index in leaves) {
            leaf = leaves[index];
            proof = tree.getProof(getEncodedLeaf(leaf)).map(x => buf2hex(x.data)).toString();
            console.log(`Address: ${leaf.address} Points: ${leaf.points} Proof: ${proof}`)

            // store proof in the DB so it can be easily queried
            await prisma.reward.update({
                where: {
                    address: user.address
                },
                data: {
                    proof: proof,
                }
            });
        }
    }
}

function getEncodedLeaf(leaf) {
    return keccak256(abiCoder.encode(["address", "uint256"],
        [leaf.address, leaf.points]));
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
