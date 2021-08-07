from brownie import accounts, web3, Wei, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
from settings import *
# from brownie import Contract


@pytest.fixture(scope='module', autouse=True)
def ERC1155_token(MemeXNFT):
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

    