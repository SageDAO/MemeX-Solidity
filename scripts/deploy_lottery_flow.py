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
    else:
        lottery = Lottery.at(lottery_address)

    return lottery


def create_pool(staking):
    _id = 1
    _periodStart = chain.time()
    _maxStake = 5 * TENPOW18
    _rewardRate = 11574074074000
    _controllerShare = 0

    staking.createPool(_id,
                       _periodStart,
                       _maxStake,
                       _rewardRate,
                       _controllerShare,
                       accounts[1],
                       {"from": accounts[0]})

    return staking


def stake(staking, memeXToken):
    _id = 1
    _staker = accounts[3]
    memeXToken.transfer(_staker, 20 * TENPOW18, {"from": accounts[0]})
    memeXToken.approve(staking, 10 * TENPOW18, {"from": _staker})
    staking.stake(_id, 2 * TENPOW18, {"from": _staker})

    # _staker = accounts[1]
    # memeXToken.transfer(_staker, 20 * TENPOW18,{"from":accounts[0]})
    # memeXToken.approve(staking, 10 * TENPOW18,{"from":_staker})
    # staking.stake(_id, 2 * TENPOW18, {"from": _staker})

    # _staker = accounts[2]
    # memeXToken.transfer(_staker, 20 * TENPOW18,{"from":accounts[0]})
    # memeXToken.approve(staking, 10 * TENPOW18,{"from":_staker})
    # staking.stake(_id, 2 * TENPOW18, {"from": _staker})

    return staking


def buy_tickets(_lotteryId, lottery):
    lottery.buyTicket(_lotteryId, {"from": accounts[0]})
    lottery.buyTicket(_lotteryId, {"from": accounts[1]})
    lottery.buyTicket(_lotteryId, {"from": accounts[2]})
    return lottery


def create_lottery(lottery, meme_x):
    # staking = stake(staking, memeXToken)
    _nftContract = meme_x
    # _nftContract = CONTRACTS[network.show_active()]["meme_X_nft"]
    _prizeIds = list(range(1, 3))
    _costPerTicket = 0
    _startingTime = chain.time()

    _closingTime = chain.time() + 24 * 60 * 60
    _lotteryId = lottery.createNewLottery(
        _costPerTicket, _startingTime, _closingTime, _nftContract, _prizeIds, 0, 0, "https://bafybeib4cmjiwsekisto2mqivril4du5prsetasd7izormse4rovnqxsze.ipfs.dweb.link/", {"from": accounts[0]})

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


def boost_participant(lottery, _lotteryId):
    lottery.boostParticipant(_lotteryId, accounts[0], {"from": accounts[0]})


def main():
    load_accounts()

    memeXToken = deploy_meme_token()
    staking = deploy_staking(memeXToken)
    lottery = deploy_lottery(staking)
    memeNft = deploy_meme()
   # staking = create_pool(staking)

    # setRandomGenerator(lottery)
    setLottery(memeNft)
    #staking = stake(staking, memeXToken)

    _lotteryId = create_lottery(lottery, memeNft)

    _lotteryId = 1  # starts from 1 now
    # print(lottery.getLotteryInfo(_lotteryId))
    lottery = buy_tickets(_lotteryId, lottery)
    # boost_participant(lottery, _lotteryId)
    # print(lottery.isBooster(_lotteryId, accounts[0]))
    # print("lottery ID..........",_lotteryId)
    lottery = execute_lottery(lottery, _lotteryId)

    print(lottery.isAddressWinner(_lotteryId,
          accounts[0], {"from": accounts[0]}))
    print(lottery.isAddressWinner(_lotteryId,
          accounts[1], {"from": accounts[0]}))
    print(lottery.isAddressWinner(_lotteryId,
          accounts[2], {"from": accounts[0]}))
