const hre = require("hardhat");
const ethers = hre.ethers;
const fetch = require('node-fetch');
require("dotenv").config();

/**
 * Script to fetch NFT balances for a given tokenId
 */
async function main() {

    const topicSignature = 'TransferSingle(address,address,address,uint256,uint256)'
    response = await fetch(`https://api.covalenthq.com/v1/1/events/topics/${ethers.utils.id(topicSignature)}/?sender-address=0xa25bf81aacdb5e610eaf91a889975bba43398cf1&starting-block=13735079&ending-block=14500000&page-number=0&page-size=999999999&key=${process.env.COVALENT_KEY}`);
    json = await response.json();
    nft_transactions = json.data.items;
    holders = new Map();
    
    const tokenId = 1;
    nft_transactions.forEach(nft_transaction => {
            from = nft_transaction.decoded.params[1].value;
            to = nft_transaction.decoded.params[2].value;
            id = parseInt(nft_transaction.decoded.params[3].value);
            amount = parseInt(nft_transaction.decoded.params[4].value);
            if (id == tokenId) {
            if (holders[from] == undefined) {
                holders[from] = 0;
            }
            if (holders[to] == undefined) {
                holders[to] = 0;
            }
            holders[from] -= amount;
            holders[to] +=  amount;
        }
         
    });

    count = 1
    console.log("#,address,balance");
    for (var key in holders) {
        if (holders[key] > 0) {
        console.log(count+","+key + "," + holders[key]);
        count++;
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error.stack);
        process.exit(1);
});