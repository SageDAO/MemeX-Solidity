from brownie import accounts, web3, Wei, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
# from brownie import Contract


@pytest.fixture(scope='module', autouse=True)
def ERC1155_token(ERC1155Mintable):
    ERC1155_token = ERC1155Mintable.deploy("try","t",{"from": accounts[0]})
    return ERC1155_token