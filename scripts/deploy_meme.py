from brownie import *
from .contracts import *


def deploy_meme():
    deployer = accounts[0]
    # MemeX= contract name
    _name = "Try ERC1155"
    _symbol = "TE"
    meme_x = MemeXNFT.deploy(_name, _symbol, {"from": accounts[0]})


def mint():
    _id = 1
    _quantity = 2
    _data = ""
    meme_x = MemeXNFT.at("0xd745029a352Dc8d23C643AE9962d1c0D349154a8")
    meme_x.mint(accounts[0], _id, _quantity, _data, {"from": accounts[0]})


def setUri():
    _id = 1
    _quantity = 2
    _data = ""
    meme_x = MemeXNFT.at("0xd745029a352Dc8d23C643AE9962d1c0D349154a8")
    meme_x.setURI(
        "https://gateway.pinata.cloud/ipfs/QmQqBfJZstngkr7mzCNK8WseQmwf7znShnD1c11tirjXUR/{id}.json", {"from": accounts[0]})


def main():
    load_accounts()
    deploy_meme()
    # mint()
    # setUri()
