from brownie import accounts, web3, Wei, chain
from brownie.network.transaction import TransactionReceipt
from brownie.convert import to_address
import pytest
from settings import *

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
    memeXToken.transfer(_staker, 20 * TENPOW18,{"from":accounts[0]})
    memeXToken.approve(staking, 10 * TENPOW18,{"from":_staker})
    staking.stake(_id, 2 * TENPOW18, {"from": _staker})
    

   # _staker = accounts[1]
    #memeXToken.transfer(_staker, 20 * TENPOW18,{"from":accounts[0]})
    #memeXToken.approve(staking, 10 * TENPOW18,{"from":_staker})
    #staking.stake(_id, 2 * TENPOW18, {"from": _staker})
    

    #_staker = accounts[2]
    #memeXToken.transfer(_staker, 20 * TENPOW18,{"from":accounts[0]})
    #memeXToken.approve(staking, 10 * TENPOW18,{"from":_staker})
    #staking.stake(_id, 2 * TENPOW18, {"from": _staker})


    return staking


""" def test_lottery_create_new_lottery(staking, memeXToken, lottery):
    staking = create_pool(staking)
    
    staking = stake(staking, memeXToken)

    _lotSize = 100
    _costPerTicket = 1
    _startingTime = chain.time()
    _closingTime = chain.time() + 1 * 24 * 60 * 60
    print(lottery.createNewLottery(_lotSize, _costPerTicket, _startingTime, _closingTime, {"from": accounts[0]}).return_value)
    """

# def test_lottery_draw_number(staking, memeXToken, lottery):
#     staking = create_pool(staking)
#     #staking = stake(staking, memeXToken)

#     _lotSize = 100
#     _costPerTicket = 1
#     _startingTime = chain.time()
#     _closingTime = chain.time() + 1
    
#     lottery.createNewLottery(_lotSize, _costPerTicket, _startingTime, _closingTime, {"from": accounts[0]})
#     _lotteryId = 1

#     lottery.setRandomGenerator(RANDOM_GENERATOR, {"from": accounts[0]})
#     lottery.drawWinningNumbers(_lotteryId, 0, {"from": accounts[0]})


@pytest.fixture(scope='module', autouse=True)
def meme_x(MemeXNFT):
    deployer = accounts[0]
    # MemeX= contract name
    _name = "MemeX NFTs"
    _symbol = "MMXNFT"

    meme_x = MemeXNFT.deploy(
    _name, _symbol, {"from": accounts[0]})
    
    return meme_x

# def deploy_meme(MemeXNFT):
#     deployer = accounts[0]
#     # MemeX= contract name
#     _name = "MemeX NFTs"
#     _symbol = "MMXNFT"

#     meme_x = MemeXNFT.deploy(
#     _name, _symbol, {"from": accounts[0]}, publish_source=publish())
    
#     return meme_x

def test_lottery(lottery, meme_x):
    _nftContract = meme_x
    # _nftContract = CONTRACTS[network.show_active()]["meme_X_nft"]
    _prizeIds = list(range(1, 3))
    _costPerTicket = 0
    _startingTime = chain.time()

    _closingTime = chain.time() + 24 * 60 * 60
    _lotteryId = lottery.createNewLottery(
        _costPerTicket, _startingTime, _closingTime, _nftContract, _prizeIds, 0, 0, "https://bafybeib4cmjiwsekisto2mqivril4du5prsetasd7izormse4rovnqxsze.ipfs.dweb.link/{id}.json", {"from": accounts[0]})
    _lotteryId = print(lottery.getCurrentLotteryId())
    _lotteryId = lottery.getCurrentLotteryId()
    _nftContract.mint(accounts[0],1,1,"",_lotteryId, {"from":accounts[0]})
    print(_nftContract.address)
    
    print(lottery.redeemNFT(_lotteryId, {"from":accounts[0]}).return_value)