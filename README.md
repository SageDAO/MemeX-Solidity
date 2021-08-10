## Setup instructions
Install brownie
```
python3 -m pip install --user pipx
python3 -m pipx ensurepath
pipx install eth-brownie
```

Create a `deployer` account:

`brownie accounts generate deployer`

If you want to interact with this account using wallets you can export the json with:

`brownie accounts export deployer <dest_path>`

* remeber to get eth from faucets when deploying or interacting with contracts on a testnet

## Deploy contracts
Deploy the MemeX token:

`brownie run scripts/deploy_memex_token.py`

Deploy the NFT contract:

`brownie run scripts/deploy_memex.py`

Deploy randomness contract:
`brownie run scripts/deploy_randomness.py`

Deploy the Lottery contract:


## How to Mint through Lottery Contract (redeem):

Create a interface for ERC1155 Contract that has mint function in it.
Declare an interface variable in Lottery Contract.
Initialize interface variable with ERC1155 address.
Call mint on ERC1155.

Try to compile it. Test may not work right now.
