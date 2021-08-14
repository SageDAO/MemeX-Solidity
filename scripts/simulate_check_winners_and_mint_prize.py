from scripts.contract_addresses import CONTRACTS
from brownie import *
from .contracts import *
from .settings import *


def isAddressWinner(lottery, account):
    return lottery.isAddressWinner(lottery, account)


def main():
    load_accounts()

    lottery_address = CONTRACTS[network.show_active()]["lottery"]
    lottery = Lottery.at(lottery_address)

    nftAddress = CONTRACTS[network.show_active()]["meme_X_nft"]
    nftContract = MemeXNFT.at(nftAddress)

    _lotteryId = lottery.getCurrentLotteryId()
    # iterate over all accounts and check if they are winners
    for account in accounts:
        (isWinner, prizeId, claimed) = lottery.isAddressWinner(_lotteryId, account)
        if isWinner:  # if they are winners, print the prizeId
            print(
                f"{account} is a winner of prize {prizeId}! Minted: {claimed}")
            print("Minting prize...")
            lottery.redeemNFT(_lotteryId, {'from': account})

    for account in accounts:
        (isWinner, prizeId, claimed) = lottery.isAddressWinner(_lotteryId, account)
        if isWinner:  # if they are winners, print the prizeId
            print(
                f"{account} is a winner of prize {prizeId}! Minted: {claimed}")
            uri = (nftContract.uri(prizeId))
            # replace the occurences of {id} inside uri with the prizeId
            uri = uri.replace("{id}", str(prizeId))
            print(f"Prize URL: {uri}")
            print(nftContract.balanceOf(account, prizeId))
