from tests.conftest import memeXToken
from scripts.contract_addresses import CONTRACTS
from brownie import *
from .contracts import *
from settings import *
def deploy_meme():
    deployer = accounts[0]
    #MemeX= contract name
    _name = "Try ERC1155"
    _symbol = "TE"
    meme_x_nft_address = CONTRACTS[network.show_active()]["meme_X_nft"]
    
    if meme_x_nft_address == "":
        meme_x = MemeXNFT.deploy(_name,_symbol,{"from":accounts[0]})
    else:
        meme_X = MemeXNFT.at(meme_x_nft_address)

    return meme_x

def deploy_meme_token():
    _name = "MemeX"
    _symbol = "Mem"
    _initialSupply = MEME_X_TOKEN
    owner = accounts[0]
    meme_x_token_address = CONTRACTS[network.show_active()]["meme_x_token"]
    if meme_x_token_address == "":
        memeXToken = MemeXToken.deploy(_name, _symbol, _initialSupply, owner, {"from": owner})
    else:
        memeXToken = MemeXToken.at(meme_x_token_address)
    
    return memeXToken

def deploy_staking(memeXToken):
    controller = accounts[0]
    staking_address = CONTRACTS[network.show_active()]["staking"]
    if staking_address == "":
        staking = MemeXStaking.deploy(controller,memeXToken, {"from": accounts[0]})
    else: 
        staking = MemeXStaking.at(staking_address)
    
    return staking

def deploy_lottery(staking):
    _stakingContract = staking
    lottery_address = CONTRACTS[network.show_active()]["lottery"]
    if lottery_address == "":
        lottery = Lottery.deploy(_stakingContract,{"from":accounts[0]})
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


def buy_tickets(_lotteryId, lottery):
    lottery.buyOneTicket(_lotteryId, {"from": accounts[0]})
    lottery.buyOneTicket(_lotteryId, {"from": accounts[1]}) 
    lottery.buyOneTicket(_lotteryId, {"from": accounts[2]})   
    return lottery

def create_lottery(staking, lottery):
    staking = create_pool(staking)
    #staking = stake(staking, memeXToken)

    _lotSize = 100
    _costPerTicket = 1
    _startingTime = chain.time()
    _closingTime = chain.time() + 1
    
    _lotteryId = lottery.createNewLottery(_lotSize, _costPerTicket, _startingTime, _closingTime, {"from": accounts[0]})
    
    return lottery,_lotteryId
    
def execute_lottery(lottery):
    _lotteryId = 1
    lottery.setRandomGenerator(RANDOM_GENERATOR, {"from": accounts[0]})
    lottery.drawWinningNumbers(_lotteryId, 0, {"from": accounts[0]})