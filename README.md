# MemeX Contracts

## Overview

MemeX is currently based on five contracts:

* MemeX Token: ERC-20 compatible Token;
* MemeX NFT: ERC-1155 compatible Non Fungible Tokens;
* Lottery: Manages all the lottery logic. Defines random winners for our prizes and manages boost payments (subscription to increase the user odds). Next iteration would integrate with Superfluid stream payments;
* Stake: manages the MemeX token staking process. Awards the users with PINAs, which on this iteration are points needed to enter the lottery. A future iteration will evolve PINA into an ERC-20 token;
* RandomNumberGenerator (RNG): adopts the trusted Chainlink VRF (Verifiable Random Function) oracle as a verifiable source of randomness to draw our lottery numbers.

## Setup instructions

We are using hardhat as the development framework.
To install hardhat:
```
npm install --save-dev hardhat
```

When interacting with contracts on testnets you'll need an Alchemy API key: (Alchemy is preferred over Infura as they have archive nodes on the free tier).

We store the Alchemy API key and the deployer account private key on the `secrets.json` file:

{
    "alchemy_key": "<api_key>",
    "deployer_pk": "<pk>",
    "etherscan_key": "<etherscan_api_key>"
}

## Deploy contracts

To deploy all the contracts to the Rinkeby testnet and update their references to each other (only needs to run once):

`npx hardhat run scripts/deploy.js --network rinkeby`


The `contracts.json` file contains the addresses of the already deployed contracts. If a contract address is in this file, the scripts would interact with the deployed contract, otherwhise a new contract will be deployed.

## Creating lotteries from drops

Executing the script

`node scripts/create_lotteries_from_json.js <path_to_drops_json_file>`

will deploy a new NFT contract and create a new lottery for each new drop, updating the json with the created lotteryId.

## E2E Tests

The scripts folder contains multiple functions to interact with the deployed contracts. 

To simulate the entire lottery flow, including lottery creation, user entries, and drawing numbers (can be executed multiple times to create different lotteries):

```
export HARDHAT_NETWORK=rinkeby
node scripts/simulate_lottery_flow.js 
```

Every call to the Chainlink oracle requires the randomness contract to have some LINK tokens. During tests use this [faucet](https://rinkeby.chain.link/) to refill if necessary.

To make queries about the winners and mint their prizes please make sure to allow some blocks to be mined as we need to wait for an answer from the randomness oracle:

`node scripts/simulate_check_winners.js`
