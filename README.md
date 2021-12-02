# MemeX Contracts

## Overview

MemeX is currently based on five contracts:

* MemeX Token: ERC-20 compatible Token (only used during tests to have control over the supply);
* MemeX NFT: ERC-1155 compatible Non Fungible Tokens;
* Lottery: Manages all the lottery logic. Allows users to buy tickets and lets users claim their prizes.
* Rewards: manages the MemeX rewards process. Awards users holding MEME or providing liquidity with PINAs, which on this iteration are points needed to enter lottery games. A future iteration will evolve PINA into an ERC-20 token. As we're not requesting users to stake their funds, there is an external job to monitor users balances and update the rewards contract accordingly;
* RandomNumberGenerator (RNG): adopts the trusted Chainlink VRF (Verifiable Random Function) oracle as a verifiable source of randomness to draw our lottery numbers.

## Setup instructions

We are using hardhat as the development framework.
To install all dependencias, run:
```
npm install
```

When interacting with contracts on testnets you'll need Alchemy and Etherscan API keys for the Ethereum network and ANKR, FTMScan keys for the Fantom network.

We store all used secrets in the `.env` file. This file structure can be found in the `.env.sample` file:

## Deploy contracts

During tests, contracts are deployed to the Rinkeby testnet or Fantom testnet and update their references to each other (only needs to run once):

`npx hardhat run scripts/deploy.js --network rinkeby`

or 

`npx hardhat run scripts/deploy.js --network fantomtestnet`


The `contracts.json` file contains the addresses of the already deployed contracts. If a contract address is in this file, the scripts would interact with the deployed contract, otherwhise a new contract will be deployed.

## Creating lotteries from drops

Executing the script

`node scripts/create_lotteries_from_json.js <path_to_drops_json_file>`

will create a new lottery for each new drop, updating the json with the created lotteryId.

## Creating Merkle Trees with lottery results

The script to run prize distributions can be called with the following command:

`node scripts/prize_distribution.js`

It will find prize winners, create the merkle tree and update the lottery contract with the root hash. It also saves proofs on our database. After that lottery results can be queried from the database fetching the proofs required when claiming a prize.

## Rewards

Rewards are based on users holding the Meme Inu token on their wallet (either on Ethereum or Fantom). We don't require users to stake those tokens, instead, there is a script to check and update all balances on a certain interval:

`export HARDHAT_NETWORK=rinkeby; node scripts/update_balances.js`


## Unit tests

To run unit tests:

`npx hardhat test`
