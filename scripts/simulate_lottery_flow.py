from scripts.contract_addresses import CONTRACTS
from brownie import *
from .contracts import *
from .settings import *


def publish():
    if network.show_active() == "development":
        return False
    else:
        return False


def deploy_meme():
    deployer = accounts[0]
    # MemeX= contract name
    _name = "MemeX NFTs"
    _symbol = "MMXNFT"
    meme_x_nft_address = CONTRACTS[network.show_active()]["meme_X_nft"]

    if meme_x_nft_address == "":
        meme_x = MemeXNFT.deploy(
            _name, _symbol, {"from": accounts[0]}, publish_source=publish())
    else:
        meme_x = MemeXNFT.at(meme_x_nft_address)

    return meme_x


def deploy_meme_token():
    _name = "MemeX"
    _symbol = "MemeX"
    _initialSupply = MEME_X_TOKEN
    owner = accounts[0]
    meme_x_token_address = CONTRACTS[network.show_active()]["meme_x_token"]
    if meme_x_token_address == "":
        memeXToken = MemeXToken.deploy(_name, _symbol, _initialSupply, owner, {
                                       "from": owner}, publish_source=publish())

    else:
        memeXToken = MemeXToken.at(meme_x_token_address)

    return memeXToken


def deploy_staking(memeXToken):
    controller = accounts[0]
    staking_address = CONTRACTS[network.show_active()]["staking"]
    if staking_address == "":
        staking = MemeXStaking.deploy(controller, memeXToken, {
                                      "from": accounts[0]}, publish_source=publish())
    else:
        staking = MemeXStaking.at(staking_address)

    return staking


def deploy_lottery(staking):
    _stakingContract = staking
    lottery_address = CONTRACTS[network.show_active()]["lottery"]
    if lottery_address == "":
        lottery = Lottery.deploy(
            _stakingContract, {"from": accounts[0]}, publish_source=publish())
        setRandomGenerator(lottery)
    else:
        lottery = Lottery.at(lottery_address)

    return lottery


def buy_tickets(_lotteryId, lottery):
    lottery.buyTicket(_lotteryId, {"from": accounts[0]})
    lottery.buyTicket(_lotteryId, {"from": accounts[1]})
    lottery.buyTicket(_lotteryId, {"from": accounts[2]})
    return lottery


def create_lottery(lottery, meme_x):
    # staking = stake(staking, memeXToken)
    _nftContract = meme_x
    # _nftContract = CONTRACTS[network.show_active()]["meme_X_nft"]
    _prizeIds = list(range(0, 2))
    _costPerTicket = 0
    _startingTime = chain.time()

    _closingTime = chain.time() + 24 * 60 * 60
    _lotteryId = lottery.createNewLottery(
        _costPerTicket, _startingTime, _closingTime, _nftContract, _prizeIds, 0, 0, "https://bafybeib4cmjiwsekisto2mqivril4du5prsetasd7izormse4rovnqxsze.ipfs.dweb.link/{id}.json", {"from": accounts[0]})

    return _lotteryId


def random_number_consumer():
    random_number_address = CONTRACTS[network.show_active(
    )]["random_generator"]
    random_number_generator = RandomNumberConsumer.at(random_number_address)
    return random_number_generator
    _


def execute_lottery(lottery, _lotteryId):
    lottery.drawWinningNumbers(_lotteryId, 0, {"from": accounts[0]})
    return lottery


def isAddressWinner(lottery, account):
    return lottery.isAddressWinner(lottery, account)


def setRandomGenerator(lottery):
    random_number_address = CONTRACTS[network.show_active(
    )]["random_generator"]
    lottery.setRandomGenerator(random_number_address,  {"from": accounts[0]})
    return lottery


def setLottery(memeNft):
    lottery_address = CONTRACTS[network.show_active(
    )]["lottery"]
    memeNft.setLotteryContract(lottery_address,  {"from": accounts[0]})


def setLotteryHelper(memeNft, lottery):

    memeNft.setLotteryContract(lottery.address,  {"from": accounts[0]})


def boost_participant(lottery, _lotteryId):
    lottery.boostParticipant(_lotteryId, accounts[0], {"from": accounts[0]})


def setLotteryAddressInGenerator(lottery):
    random_number_address = CONTRACTS[network.show_active(
    )]["random_generator"]

    random_number_generator = RandomNumberConsumer.at(random_number_address)
    random_number_generator.setLotteryAddress(
        lottery.address, {"from": accounts[0]})


def main():
    load_accounts()

    memeXToken = deploy_meme_token()
    staking = deploy_staking(memeXToken)
    lottery = deploy_lottery(staking)
    memeNft = deploy_meme()

    _lotteryId = create_lottery(lottery, memeNft)

    _lotteryId = lottery.getCurrentLotteryId()

    info = lottery.getLotteryInfo(_lotteryId)
    print(
        f"\nSuccessfuly created lottery with id #{_lotteryId}. Lottery is open for entries!\n")

    lottery = buy_tickets(_lotteryId, lottery)

    print(
        f"\nLottery #{_lotteryId} has {lottery.getNumberOfParticipants(_lotteryId)} participants!\n")

    boost_participant(lottery, _lotteryId)
    if (lottery.isBooster(_lotteryId, accounts[0])):
        print(
            f"\nAccount {accounts[0]} is boosting his odds on this lottery!\n")

    lottery = execute_lottery(lottery, _lotteryId)

    print("\nA verifiable random number request was made to the Chainlink VRF (Verifiable Random Function) oracle.\n Please allow some blocks to be mined before checking results.")
