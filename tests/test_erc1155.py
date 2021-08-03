from brownie import accounts, web3, Wei, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
# from brownie import Contract

def test_get_uri(ERC1155_token):
    _to = accounts[5]
    _id = 1
    _quantity = 2
    _data = ""
    ERC1155_token.mint(_to, _id, _quantity, _data)

    print(ERC1155_token.uri(_id))