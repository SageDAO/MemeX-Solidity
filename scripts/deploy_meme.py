from brownie import *

def load_accounts():
    if network.show_active() in ['mainnet', 'bsc-test', 'matic-test']:
        # replace with your keys
        accounts.load("token_art")
    # add accounts if active network is goerli
    if network.show_active() in ['goerli', 'ropsten','kovan','rinkeby']:
        # 0xa5C9fb5D557daDb10c4B5c70943d610001B7420E 
       #Note: Only to deploy. Dont send eth to this address
        accounts.add('55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43909e13bc6991e43eb36de6')
        # 0x9135C43D7bA230d372A12B354c2E2Cf58b081463

def deploy_meme():
    deployer = accounts[0]
    #MemeX= contract name
    _name = "Try ERC1155"
    _symbol = "TE"
    meme_x = MemeXNFT.deploy(_name,_symbol,{"from":accounts[0]})

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
    meme_x.setURI("https://gateway.pinata.cloud/ipfs/QmQqBfJZstngkr7mzCNK8WseQmwf7znShnD1c11tirjXUR/{id}.json", {"from" : accounts[0]})

def main():
    load_accounts()
    #deploy_meme()
    mint()
    #setUri()
