const fetch = require("node-fetch");
require("dotenv").config();
//const hardhat = require("hardhat");

const { PrismaClient, AssetType } = require('@prisma/client');
const prisma = new PrismaClient();

const BLOCKCHAIN = {
    ETHEREUM: {
        chainId: "1",
        startingBlock: 10662598,
        assetType: AssetType.ETH_MEME,
        memeContract: "0xd5525d397898e5502075ea5e830d8914f6f0affe",
        transferTopic: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    },
    FANTOM: {
        chainId: "250",
        startingBlock: 17080587,
        assetType: AssetType.FTM_MEME,
        memeContract: "0xe3d7a068a7d99ee79d9112d989c5aff4e7594a21",
        transferTopic: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    }
}

async function runJob() {
    let transactions = await getLatestTransactionsFromAllBlockchains();
    await saveToDatabase(transactions);
}

async function saveToDatabase(transactions) {
    let numTransactions = transactions.length;
    console.log(`saveToDatabase([${numTransactions}])`);
    if (numTransactions == 0) {
        return;
    }
    const DB_BATCH_SIZE = 50;
    for (let i = 0; i < numTransactions; i += DB_BATCH_SIZE) {
        let batch = transactions.slice(i, i + DB_BATCH_SIZE);
        await prisma.memeTransactions.createMany({
            data: batch,
            skipDuplicates: true,
        });
    }
    //json = JSON.stringify(transactions);
    //console.log(json);
}

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
    console.log(`Last block on db for asset ${_assetType} is ${blockHeight}`);
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
    console.log(`Last block on chain ${chainId} is ${lastBlock}`);
    return lastBlock;
}

async function getLatestTransactionsFromAllBlockchains() {
    let allTransactions = [];
    for (var item in BLOCKCHAIN) {
        let blockchain = BLOCKCHAIN[item];
        let startingBlock = await getLastBlockHeightInDatabase(blockchain.assetType);
        if (startingBlock < blockchain.startingBlock) {
            startingBlock = blockchain.startingBlock;
        }
        let endingBlock = await getLastBlockHeightInBlockchain(blockchain.chainId);
        let chainTransactions = await getTransactionsFromBlockchain(blockchain, startingBlock, endingBlock);
        allTransactions.push(...chainTransactions);
    }
    return allTransactions;
}

/**
 * Calls the "Get Log events by contract address" Covalent API, as defined in 
 * https://www.covalenthq.com/docs/api/#get-/v1/{chain_id}/events/address/{address}/
 * 
 * @param {*} blockchain
 * @param {*} startingBlock 
 * @param {*} endingBlock 
 * @returns 
 */
async function getTransactionsFromBlockchain(blockchain, startingBlock, endingBlock) {
    let transactions = [];
    if (startingBlock == endingBlock) {
        return transactions;
    }
    let chainId = blockchain.chainId;
    let contractAddress = blockchain.memeContract;
    let transferTopic = blockchain.transferTopic;
    const CHUNK_SIZE = 100000;
    for (let iStart = startingBlock; iStart < endingBlock; iStart += CHUNK_SIZE) {
        let iEnd = iStart + CHUNK_SIZE - 1;
        if (iEnd > endingBlock) {
            iEnd = endingBlock;
        }
        console.log(`Fetching events on chain ${chainId} contract ${contractAddress} from block ${iStart} to block ${iEnd}`);
        let url = `https://api.covalenthq.com/v1/${chainId}/events/topics/${transferTopic}/?sender-address=${contractAddress}&starting-block=${iStart}&ending-block=${iEnd}&page-number=0&page-size=999999999&key=${process.env.COVALENT_KEY}`;
        let result = await fetch(url);
        let resultJson = await result.json();
        let mappedTransactions = resultJson.data.items.map(item => {
            return {
                txHash: item.tx_hash,
                assetType: blockchain.assetType,
                blockTimestamp: Date.parse(item.block_signed_at) / 1000, // Converting to unix timestamp
                blockNumber: item.block_height,
                from: item.decoded.params[0].value,
                to: item.decoded.params[1].value,
                value: Number(item.decoded.params[2].value),
            };
        });
        // store the transactions in the database
        let dbResult = await prisma.memeTransactions.createMany({
            data: mappedTransactions,
        });
        // transactions.push(...mappedTransactions);
        console.log(`${mappedTransactions.length} transactions in block range`);
    }
    return transactions;
}

async function main() {
    //await hardhat.run('compile');
    await runJob();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });