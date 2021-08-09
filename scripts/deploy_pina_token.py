from brownie import accounts
from .contracts import *

TENPOW18 = 10 ** 18


def main():
    acct = accounts.load('deployer')
    return MemeXToken.deploy("Pina", "PINA", 100000 * TENPOW18, accounts[0], {'from': accounts[0]})
