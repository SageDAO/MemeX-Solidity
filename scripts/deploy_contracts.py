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


def setRandomGenerator(lottery, rng):
    lottery.setRandomGenerator(rng.address,  {"from": accounts[0]})
    return lottery


def deploy_lottery(staking):
    _stakingContract = staking
    lottery_address = CONTRACTS[network.show_active()]["lottery"]
    if lottery_address == "":
        lottery = Lottery.deploy(
            _stakingContract, {"from": accounts[0]}, publish_source=publish())
    else:
        lottery = Lottery.at(lottery_address)

    return lottery


def deploy_randomness():
    rand_address = CONTRACTS[network.show_active()]["random_generator"]
    if rand_address == "":
        _vrfCoordinator = "0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B"
        _linkToken = "0x01BE23585060835E02B77ef475b0Cc51aA1e0709"
        _lotteryAddr = "0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9"
        _keyHash = "0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311"
        TENPOW18 = 10 ** 18
        _fee = 0.1 * TENPOW18
        randomness = RandomNumberConsumer.deploy(
            _vrfCoordinator,
            _linkToken,
            _lotteryAddr,
            _keyHash,
            _fee,
            {"from": accounts[0]})
    else:
        randomness = RandomNumberConsumer.at(rand_address)
    return randomness


def setLottery(lottery, memeNft, randomness):
    memeNft.setLotteryContract(lottery.address,  {"from": accounts[0]})
    randomness.setLotteryAddress(lottery.address,  {"from": accounts[0]})


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

    _staker = accounts[1]
    memeXToken.transfer(_staker, 20 * TENPOW18, {"from": accounts[0]})
    memeXToken.approve(staking, 10 * TENPOW18, {"from": _staker})
    staking.stake(_id, 2 * TENPOW18, {"from": _staker})

    _staker = accounts[2]
    memeXToken.transfer(_staker, 20 * TENPOW18, {"from": accounts[0]})
    memeXToken.approve(staking, 10 * TENPOW18, {"from": _staker})
    staking.stake(_id, 2 * TENPOW18, {"from": _staker})

    return staking


def main():
    load_accounts()

    randomness = deploy_randomness()
    memeXToken = deploy_meme_token()
    staking = deploy_staking(memeXToken)
    lottery = deploy_lottery(staking)
    memeNft = deploy_meme()

    setLottery(lottery, memeNft, randomness)
    setRandomGenerator(lottery, randomness)

    staking = create_pool(staking)

    staking = stake(staking, memeXToken)
