from brownie import *
from .contracts import *
from .contract_addresses import *
def deploy_randomness():
    _vrfCoordinator = "0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B"
    _linkToken = "0x01BE23585060835E02B77ef475b0Cc51aA1e0709"
    _lotteryAddr = "0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9"
    _keyHash = "0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311"
    TENPOW18 = 10 ** 18
    _fee = 0.1 * TENPOW18
    random_number_consumer = RandomNumberConsumer.deploy(
        _vrfCoordinator,
        _linkToken,
        _lotteryAddr,
        _keyHash,
        _fee,
        {"from": accounts[0]})

    print("Random Number Consumer: ", random_number_consumer)
    
def getRandomness(): 
    random_number_consumer = RandomNumberConsumer.at(CONTRACTS[network.show_active()]["random_generator"])
    random_number_consumer.getRandomNumber({"from": accounts[0]})
    print(random_number_consumer.randomResult({"from": accounts[0]}))

def main():
    load_accounts()
    deploy_randomness()
    #getRandomness()
