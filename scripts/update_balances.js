const fetch = require('node-fetch');
require("dotenv").config();
const hre = require("hardhat");
const createLogger = require("./logs.js");

const ethers = hre.ethers;
var abiCoder = ethers.utils.defaultAbiCoder;

const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONTRACTS = require('../contracts.js');

const ASSETS = {
    ETH_MEMEINU: {
        chainId: "1",
        startingBlock: 13649693,
        assetType: "ETH_MEMEINU",
        contract: "0x74b988156925937bd4e082f0ed7429da8eaea8db",
        transferTopic: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        rewardRate: 0.00000000000000000001157407407407407407,
    },
}

const logger = createLogger('memex_scripts', 'update_balances');

/**
 * @param {*} _assetType 
 * @returns max(blockNumber) for that asset, or null if none is found
 */
async function getLastBlockHeightInDatabase(_assetType) {
    const aggregations = await prisma.memeTransactions.aggregate({
        _max: {
            blockNumber: true,
        },
        where: {
            assetType: _assetType
        }
    });
    let blockHeight = aggregations._max.blockNumber || 0;
    logger.info(`Last block on db for asset ${_assetType} is ${blockHeight}`);
    return blockHeight + 1;
}

/**
 * Calls the "Get a block" Covalent API, as defined in 
 * https://www.covalenthq.com/docs/api/#get-/v1/{chain_id}/block_v2/{block_height}/
 *
 * @param {*} chainId 
 * @returns the latest block number on the blockchain
 */
async function getLastBlockHeightInBlockchain(chainId) {
    let targetBlock = "latest";
    let url = `https://api.covalenthq.com/v1/${chainId}/block_v2/${targetBlock}/?key=${process.env.COVALENT_KEY}`;
    let response = await fetch(url);
    let json = await response.json();
    let lastBlock = await json.data.items[0].height - 10; // Do not get the top blocks, in order to prevent chain reorganization
    logger.info(`Last block on chain ${chainId} is ${lastBlock}`);
    return lastBlock;
}

async function getLastBlockInspected(assetType) {
    let result = await prisma.rewardType.findUnique({
        select: {
            lastBlockInspected: true,
        },
        where: {
            type: assetType
        }
    });
    return result == null ? 0 : Number(result.lastBlockInspected);
}

async function getLatestTransactionsFromAllBlockchains() {
    let allTransactions = [];
    for (var item in ASSETS) {
        let asset = ASSETS[item];
        let startingBlock = await getLastBlockInspected(asset.assetType);
        if (startingBlock == 0) {
            startingBlock = await getLastBlockHeightInDatabase(item);
        }
        if (startingBlock < asset.startingBlock) {
            startingBlock = asset.startingBlock;
        }
        let endingBlock = await getLastBlockHeightInBlockchain(asset.chainId);
        let chainTransactions = await getTransactionsFromBlockchain(asset, startingBlock, endingBlock);
        allTransactions.push(...chainTransactions);
    }
    return allTransactions;
}

/**
 * Calls the "Get Log events by contract address" Covalent API, as defined in 
 * https://www.covalenthq.com/docs/api/#get-/v1/{chain_id}/events/address/{address}/
 * 
 * @param {*} asset
 * @param {*} startingBlock 
 * @param {*} endingBlock 
 * @returns 
 */
async function getTransactionsFromBlockchain(asset, startingBlock, endingBlock) {
    let transactions = [];
    if (startingBlock == endingBlock) {
        return transactions;
    }
    let chainId = asset.chainId;
    let contractAddress = asset.contract;
    let transferTopic = asset.transferTopic;
    const CHUNK_SIZE = 100000;
    for (let iStart = startingBlock; iStart < endingBlock; iStart += CHUNK_SIZE) {
        let iEnd = iStart + CHUNK_SIZE - 1;
        if (iEnd > endingBlock) {
            iEnd = endingBlock;
        }
        logger.info(`Fetching events on chain ${chainId} contract ${contractAddress} from block ${iStart} to block ${iEnd}`);
        let url = `https://api.covalenthq.com/v1/${chainId}/events/topics/${transferTopic}/?sender-address=${contractAddress}&starting-block=${iStart}&ending-block=${iEnd}&page-number=0&page-size=999999999&key=${process.env.COVALENT_KEY}`;
        let result = await fetch(url);
        let resultJson = await result.json();
        if (resultJson.error) {
            logger.error(`Error fetching events: ${resultJson.error_message}`);
            setTimeout(exit, 2000, 1);
        }
        let mappedTransactions = resultJson.data.items.map(item => {
            return {
                txHash: item.tx_hash,
                assetType: asset.assetType,
                blockTimestamp: Date.parse(item.block_signed_at) / 1000, // Converting to unix timestamp
                blockNumber: item.block_height,
                from: item.decoded.params[0].value,
                to: item.decoded.params[1].value,
                value: item.decoded.params[2].value
            };
        });
        // store the transactions in the database
        let dbResult = await prisma.memeTransactions.createMany({
            data: mappedTransactions,
        });
        // store the last block number inspected in the DB
        await prisma.rewardType.upsert({
            where: {
                type: asset.assetType
            },
            update: {
                lastBlockInspected: iEnd,
            },
            create: {
                type: asset.assetType,
                lastBlockInspected: iEnd,
                rewardRate: asset.rewardRate,
                chainId: parseInt(asset.chainId),
                contract: asset.contract,
                startingBlock: asset.startingBlock,
            },
        });

        // transactions.push(...mappedTransactions);
        logger.info(`${mappedTransactions.length} transactions in block range`);
    }
    return transactions;
}

/**
 * Calculates user's points based on the transactions they made, stored on the DB
 * @param {*} address 
 * @param {*} assetType 
 * @param {*} begin 
 * @param {*} end 
 * @returns points earned based on assetType between begin and end
 */
async function getUserPointsAtTimestamp(address, assetType, begin, end) {
    let assetBalance = await getUserBalanceAtTimestamp(address, assetType, begin);
    let refTimestamp = begin;
    let pinaPoints = 0;

    let rewardRate = ASSETS[assetType].rewardRate;
    let userTransactions = await getUserTransactions(address, assetType, begin + 1, end);

    for (transaction of userTransactions) {
        if (transaction.from != transaction.to) {
            pinaPoints += assetBalance * (transaction.blockTimestamp - refTimestamp) * rewardRate;
            refTimestamp = transaction.blockTimestamp;
            if (transaction.from === address) {
                assetBalance -= ethers.BigNumber.from(transaction.value);
            } else {
                assetBalance += ethers.BigNumber.from(transaction.value);
            }
        }
    }
    pinaPoints += assetBalance * rewardRate * (end - refTimestamp);
    return ethers.BigNumber.from(pinaPoints);
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
/**
 * Reconstructs the user's balance at a given timestamp, based on transfer events stored in the DB
 * @param {*} address 
 * @param {*} assetType 
 * @param {*} timestamp 
 * @returns the user's balance at the given timestamp
 */
async function getUserBalanceAtTimestamp(address, assetType, timestamp) {
    let userTransactions = await getUserTransactions(address, assetType, 0, timestamp);
    // define a bigint variable to store the user's balance
    let balance = 0;
    for (transaction of userTransactions) {
        if (transaction.from != transaction.to) {
            if (transaction.from === address) {
                balance -= ethers.BigNumber.from(transaction.value);
            } else {
                balance += ethers.BigNumber.from(transaction.value);
            }
        }
    }
    return balance;
}

const buf2hex = x => '0x' + x.toString('hex');

async function main() {
    await hre.run('compile');
    logger.info(`Started update_balances job on ${hre.network.name}`);

    const publishResults = process.argv.slice(2)[0];
    if (publishResults) {
        logger.info('Publishing results');
    }

    let transactions = await getLatestTransactionsFromAllBlockchains();

    if (publishResults) {
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
                earnedPoints += await getUserPointsAtTimestamp(user.walletAddress, assetType, Date.parse(user.createdAt) / 1000, parseInt(Date.now() / 1000));
            }
            if (earnedPoints == 0 && hre.network.name == "rinkeby") {
                logger.info(`This is rinkeby and ${user.walletAddress} has 0 points. Adding some test points`);
                earnedPoints = 1500000000 + parseInt((Date.now() - Date.parse(user.createdAt)) / 1000 / 86400 * 500000000);
            }
            console.log(`${user.walletAddress} has ${earnedPoints} points`);
            leaves.push({
                address: user.walletAddress,
                points: BigInt(earnedPoints),
            });
        }

        logger.info(`Publishing rewards`);
        let hashedLeaves = leaves.map(leaf => getEncodedLeaf(leaf));
        const tree = new MerkleTree(hashedLeaves, keccak256, { sortPairs: true });

        const root = tree.getHexRoot().toString('hex');
        logger.info(`Storing Merkle tree root in the contract: ${root}`);
        await rewardsContract.setPointsMerkleRoot(root);

        // generate proofs for each reward
        for (index in leaves) {
            leaf = leaves[index];
            proof = tree.getProof(getEncodedLeaf(leaf)).map(x => buf2hex(x.data)).toString();
            logger.info(`Address: ${leaf.address} Points: ${leaf.points} Proof: ${proof}`)

            // store proof in the DB so it can be easily queried
            await prisma.rewardPublished.upsert({
                where: {
                    address: leaf.address
                },
                update: {
                    proof: proof,
                    totalPointsEarned: leaf.points,
                },
                create: {
                    proof: proof,
                    totalPointsEarned: leaf.points,
                    address: leaf.address,
                },
            });
        }
    }
    logger.info('Finished successfully');
}

function getEncodedLeaf(leaf) {
    console.log(leaf);
    return keccak256(abiCoder.encode(["address", "uint256"],
        [leaf.address, leaf.points]));
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
