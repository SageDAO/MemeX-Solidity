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


def test_stake(staking, memeXToken):
    staking = create_pool(staking)
    _id = 1
    _staker = accounts[5]
    memeXToken.transfer(_staker, 20 * TENPOW18,{"from":accounts[0]})
    memeXToken.approve(staking, 10 * TENPOW18,{"from":accounts[5]})
    staking.stake(_id, 2 * TENPOW18, {"from": _staker})

