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

## Deploy contracts
Deploy the MemeX and PINA tokens with:

`brownie run scripts/deploy_memex_token.py`

`brownie run scripts/deploy_pina_token.py`

`brownie run scripts/deploy_memex.py`

`brownie run scripts/deploy_pina_token.py`
