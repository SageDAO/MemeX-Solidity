const fetch = require('node-fetch');
require("dotenv").config();
const hre = require("hardhat");
const ethers = hre.ethers;

const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const providerEth = new ethers.providers.JsonRpcProvider(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY_PROD}`);
const providerAnkr = new ethers.providers.JsonRpcProvider(`https://apis.ankr.com/${process.env.ANKR_KEY_MAINNET}/fantom/full/main`);
const CONTRACTS = require('../contracts.js');

const ASSETS = {
    1: "ETH_MEME",
    2: "FTM_MEME",
    3: "FTM_LIQ"
}

async function getUserPointsAtTimestamp(address, assetType, begin, end) {
    let assetBalance = await getUserBalanceAtTimestamp(address, assetType, begin);
    let refTimestamp = begin;
    let pinaPoints = 0;
    let rewardRate = 0.00001157407407407407407;
    let userTransactions = await getUserTransactions(address, assetType, begin + 1, end);
    for (transaction of userTransactions) {
        if (transaction.from != transaction.to) {
            pinaPoints += assetBalance * (transaction.blockTimestamp - refTimestamp) * rewardRate;
            refTimestamp = transaction.blockTimestamp;
            if (transaction.from === address) {
                assetBalance -= Number(transaction.value);
            } else {
                assetBalance += Number(transaction.value);
            }
        }
    }
    pinaPoints += assetBalance * (end - refTimestamp) * rewardRate;
    return pinaPoints;
}

async function getUserTransactions(address, assetType, begin, end) {
    return await prisma.memeTransactions.findMany({
        select: {
            blockNumber: true,
            blockTimestamp: true,
            from: true,
            to: true,
            value: true,
        },
        where: {
            OR: [{
                from: {
                    equals: address
                }
            }, {
                to: {
                    equals: address
                }
            },],
            assetType: {
                equals: assetType
            },
            blockTimestamp: {
                gte: begin,
                lte: end
            }
        },
        orderBy: {
            blockNumber: "asc"
        }
    });
}

async function getUserBalanceAtTimestamp(address, assetType, timestamp) {
    let userTransactions = await getUserTransactions(address, assetType, 0, timestamp);
    let balance = 0;
    for (transaction of userTransactions) {
        if (transaction.from != transaction.to) {
            if (transaction.from === address) {
                balance -= Number(transaction.value);
            } else {
                balance += Number(transaction.value);
            }
        }
    }
    return balance;
}
const memeAddressEth = "0xd5525d397898e5502075ea5e830d8914f6f0affe";
const buf2hex = x => '0x' + x.toString('hex');

async function main() {
    await hre.run('compile');
    const Rewards = await ethers.getContractFactory("Rewards");
    rewardsAddress = CONTRACTS[hre.network.name]["rewardsAddress"];
    rewardsContract = await Rewards.attach(rewardsAddress);

    let leaves = new Array();

    dbUsers = await prisma.user.findMany({
        select: {
            walletAddress: true,
            createdAt: true,
        }
    });

    for (user of dbUsers) {
        let earnedPoints = 0;
        for (assetType in ASSETS) {
            earnedPoints += await getUserPointsAtTimestamp(user.walletAddress, assetType, user.createdAt, Date.now() / 1000);
        }
        if (earnedPoints > 0) {
            leaves.push({
                address: user.walletAddress,
                points: earnedPoints,
            });
        }
    }

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
        await prisma.rewardPublished.upsert({
            where: {
                address: user.address
            },
            data: {
                proof: proof,
                totalPointsEarned: leaf.points,
                address: leaf.address,
            }
        });
    }
}

async function fetchRewards(assetName) {
    return await prisma.rewardCurrent.findMany({
        select: {
            address: true,
            balance: true,
            type: true,
            blockNumber: true,
        },
        where: {
            type: {
                equals: assetName
            }
        }
    });
}

async function fetchUserTransactions(address, assetName) {
    return await prisma.memeTransactions.findMany({
        select: {
            blockNumber: true,
            blockTimestamp: true,
            from: true,
            to: true,
            value: true,
        },
        where: {
            OR: [{
                from: {
                    equals: address
                }
            }, {
                to: {
                    equals: address
                }
            },],
            type: {
                equals: assetName

            },
        },
        orderBy: {
            blockNumber: "desc"
        }
    });
}

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
    console.log(`Found ${holdersMap.size} holders`);
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
