from brownie import accounts, web3, Wei, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
# from brownie import Contract


@pytest.fixture(scope='module', autouse=True)
def ERC1155_token(MemeXNFT):
    ERC1155_token = MemeXNFT.deploy("try","t",{"from": accounts[0]})
    return ERC1155_token