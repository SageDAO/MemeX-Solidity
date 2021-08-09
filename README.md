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


