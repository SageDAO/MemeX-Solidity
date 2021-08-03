from brownie import *


def deploy_meme():
    deployer = accounts[0]
    #MemeX= contract name
    
    meme_x = ERC1155Mintable.deploy(_name,_symbol, defaultOperators, initialSupply, owner,{"from":accounts[0]})


def main():

    deploy_meme()