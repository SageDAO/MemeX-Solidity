from brownie import *

import pytest
from settings import *
# from brownie import Contract

def load_accounts():
    if network.show_active() in ['mainnet', 'bsc-test', 'matic-test']:
        # replace with your keys
        accounts.load("token_art")
    # add accounts if active network is goerli
    if network.show_active() in ['goerli', 'ropsten','kovan','rinkeby','rinkeby-fork']:
        # 0xa5C9fb5D557daDb10c4B5c70943d610001B7420E 
       #Note: Only to deploy. Dont send eth to this address
        accounts.add('55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12345')
        accounts.add('55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12312')
        accounts.add('55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12315')
        accounts.add('55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12314')
        accounts.add('55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12321')
        accounts.add('55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb45345')
        accounts.add('55a24ceff28920d9fe1d9c2ac20be0424b8b1aec21912345bc6991e43eb12345')
        accounts.add('55a24ceff28920d9fe1d9c2ac20be0422b8b1aec43912345bc6991e43eb12345')
        # 0x9135C43D7bA230d372A12B354c2E2Cf58b081463

@pytest.fixture(scope='module', autouse=True)
def ERC1155_token(MemeXNFT):
    load_accounts()
    ERC1155_token = MemeXNFT.deploy("try","t",{"from": accounts[0]})
    return ERC1155_token

@pytest.fixture(scope='module', autouse=True)
def memeXToken(MemeXToken):
    _name = "MemeX"
    _symbol = "Mem"
    _initialSupply = MEME_X_TOKEN
    owner = accounts[0]

    memeXToken = MemeXToken.deploy(_name, _symbol, _initialSupply, owner, {"from": owner})
    return memeXToken

@pytest.fixture(scope='module', autouse=True)
def staking(MemeXStaking, memeXToken):
    controller = accounts[0]
    staking = MemeXStaking.deploy(controller,memeXToken, {"from": accounts[0]})
    return staking

@pytest.fixture(scope='module', autouse=True)
def lottery(Lottery, staking):
    _stakingContract = staking
    lottery = Lottery.deploy(_stakingContract,{"from":accounts[0]})
    return lottery


    