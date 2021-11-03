const fetch = require("node-fetch");
require("dotenv").config();
const hardhat = require("hardhat");

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BLOCKCHAIN = {
    ETHEREUM: "1",
    FANTOM: "250"
}

const START_BLOCK = {
    "1": 10662598,
    "250": 17080587
};

const BLOCKCHAIN_MEME_CONTRACT = {
    "1": "0xd5525d397898e5502075ea5e830d8914f6f0affe",
    "250": "0xe3d7a068a7d99ee79d9112d989c5aff4e7594a21"
}

const TOPIC_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function NEW_USER(walletAddress) {
    let transactions = getAllTransactionsFromAllBlockchains(walletAddress);
    saveToDatabase(transactions);
}

async function JOB() {
    let transactions = await getLatestTransactionsFromAllBlockchains();
    saveToDatabase(transactions);
}

function saveToDatabase(transactions) {
    console.log({ transactions });
}

/**
 * Calls the "Get a block" Covalent API, as defined in 
 * https://www.covalenthq.com/docs/api/#get-/v1/{chain_id}/block_v2/{block_height}/
 *
 * @param {*} chainId 
 * @returns the latest block number on the blockchain
 */
async function getLastBlockHeightInBlockchain(chainId) {
    console.log(`getLastBlockHeightInBlockchain(${chainId})`);
    let url = `https://api.covalenthq.com/v1/${chainId}/block_v2/latest/?key=${process.env.COVALENT_KEY}`;
    let response = await fetch(url);
    let json = await response.json();
    return await json.data.items[0].height;
}

function getLastBlockHeightInDatabase(chainId) {
    // prisma query
    let blockHeight = 0;
    console.log(`Last block on db for chain ${chainId} is ${blockHeight}`);
    return blockHeight;
}

async function getAllTransactionsFromAllBlockchains(walletAddress) {
    return await getTransactionsFromAllBlockchains(true, walletAddress);
}

async function getLatestTransactionsFromAllBlockchains() {
    return await getTransactionsFromAllBlockchains(true, null);
}

async function getTransactionsFromAllBlockchains(fromTheBeginning, walletAddress) {
    let transactions = [];
    for (var item in BLOCKCHAIN) {
        let chainId = BLOCKCHAIN[item];
        let startingBlock = fromTheBeginning ? START_BLOCK[chainId] : getLastBlockHeightInDatabase(chainId);
        let endingBlock = await getLastBlockHeightInBlockchain(chainId);
        let chainTransactions = await getTransactionsFromBlockchain(chainId, startingBlock, endingBlock, walletAddress);
        transactions.push(chainTransactions);
    }
    return transactions;
}

/**
 * Calls the "Get Log events by contract address" Covalent API, as defined in 
 * https://www.covalenthq.com/docs/api/#get-/v1/{chain_id}/events/address/{address}/
 * 
 * @param {*} chainId 
 * @param {*} startingBlock 
 * @param {*} endingBlock 
 * @param {*} walletAddress 
 * @returns 
 */
async function getTransactionsFromBlockchain(chainId, startingBlock, endingBlock, walletAddress) {
    console.log(`getTransactionsFromBlockchain(${chainId}, ${startingBlock}, ${endingBlock}, ${walletAddress})`);
    let transactions = [];
    if (startingBlock == endingBlock) {
        return transactions;
    }
    let contractAddress = BLOCKCHAIN_MEME_CONTRACT[chainId];
    const CHUNK_SIZE = 100000;
    for (var iStart = startingBlock; iStart < endingBlock; iStart += CHUNK_SIZE) {
        let iEnd = iStart + CHUNK_SIZE;
        if (iEnd > endingBlock) {
            iEnd = endingBlock;
        }
        console.log(`Fetching events on chain ${chainId} contract ${contractAddress} from block ${iStart} to block ${iEnd}`);
        let url = `https://api.covalenthq.com/v1/${chainId}/events/topics/${TOPIC_TRANSFER}/?sender-address=${contractAddress}&starting-block=${iStart}&ending-block=${iEnd}&page-number=0&page-size=999999999&key=${process.env.COVALENT_KEY}`;
        let result = await fetch(url);
        let resultJson = await result.json();
        // console.log(resultJson.data.items[0]);
        //console.log(`${resultJson.items.length} transactions fetched`);
        // console.log(resultJson.data.items[0].decoded.params);
        let mappedTransactions = resultJson.data.items.map(item => {
            return {
                block_signed_at: item.block_signed_at,
                block_height: item.block_height,
                from: item.decoded.params[0].value,
                to: item.decoded.params[1].value,
                value: item.decoded.params[2].value,
            };
        });
        console.log(mappedTransactions[0]);
        transactions.push(...mappedTransactions);
        console.log(`${transactions.length} transactions fetched`);
    }
    return transactions;
}

async function main() {
    await hardhat.run('compile');
    await JOB();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });