from brownie import *
from .settings import *
from .contracts import *
from .contract_addresses import *
import time

def verify(contract_id, container):
    contract_address = CONTRACTS[network.show_active()][contract_id]
    contract = container.at(contract_address)
    print(contract_id, ": Verification initiated..")
    try:
        container.publish_source(contract)
        # print(container.get_verification_info())
    except:
        print(contract_id, ": Already verified")

def main():

    verify("random_generator", RandomNumberConsumer)
    verify("meme_x_token", MemeXToken)
    verify("meme_X_nft", MemeXNFT)
    verify("staking", MemeXStaking)
    verify("lottery", Lottery)
    

   

