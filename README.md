# MemeX Contracts

## Overview

MemeX is currently based on five contracts:

* MemeX Token: ERC-20 compatible Token;
* MemeX NFT: ERC-1155 compatible Non Fungible Tokens;
* Lottery: Manages all the lottery logic. Defines random winners for our prizes and manages boost payments (subscription to increase the user odds). Next iteration would integrate with Superfluid stream payments;
* Stake: manages the MemeX token staking process. Awards the users with PINAs, which on this iteration are points needed to enter the lottery. A future iteration will evolve PINA into an ERC-20 token;
* RandomNumberGenerator (RNG): adopts the trusted Chainlink VRF (Verifiable Random Function) oracle as a verifiable source of randomness to draw our lottery numbers.

## Setup instructions

We are using brownie as the development framework.
To install brownie:
```
python3 -m pip install --user pipx
python3 -m pipx ensurepath
pipx install eth-brownie
```

When interacting with contracts on testnets you'll need an Infura API key:

`export WEB3_INFURA_PROJECT_ID=<key>`

An Etherscan key is required if you wish to publish the contracts code on deployment:

`export ETHERSCAN_TOKEN=<key>`

## Deploy contracts

To deploy all the contracts to the Rinkeby testnet and update their references to each other (only needs to run once):

`brownie run scripts/deploy_contracts.py --network rinkeby`

The `contract_addresses.py` file contains the addresses of the already deployed contracts. If a contract address is in this file, the scripts would interact with the deployed contract, otherwhise a new contract will be deployed.

The scripts folder contains multiple functions to interact with the deployed contracts. 

To simulate the entire lottery flow, including lottery creation, user entries, and drawing numbers (can be executed multiple times to create different lotteries):

`brownie run scripts/simulate_lottery_flow.py --network rinkeby`

Every call to the Chainlink oracle requires the lottery contract to have some LINK tokens. During tests use this [faucet](https://rinkeby.chain.link/) to refill if necessary.

To query who were the winners make sure to allow some blocks to be mined as we need to wait for an answer from the randomness oracle:

`brownie run scripts/simulate_check_winners_and_mint_prize.py --network rinkeby`
