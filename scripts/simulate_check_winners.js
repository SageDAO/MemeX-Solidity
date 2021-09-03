// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.

const { ethers } = require("hardhat");
const hre = require("hardhat");
const CONTRACTS = require('../contracts.js')

getLotteryContract = async () => {
    lottery_address = CONTRACTS[hre.network.name]["lotteryAddress"]
    const Lottery = await hre.ethers.getContractFactory("Lottery");
    return await Lottery.attach(lottery_address);
}

async function main() {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    await hre.run('compile');
    const [...accounts] = await ethers.getSigners();
    lottery = await getLotteryContract()
    lotteryId = (await lottery.getCurrentLotteryId()).toNumber();
    for (account in accounts) {
        account_address = accounts[account].address;
        [isWinner, prizeId, claimed] = await lottery.isAddressWinner(lotteryId, account_address);
        if (isWinner) {
            if (!claimed) {
                console.log(`Account ${account_address} won prize #id: ${prizeId}.`);
                tx = await lottery.connect(accounts[account]).redeemNFT(lotteryId, { gasLimit: 4000000 });
                receipt = await tx.wait();
                [isWinner, prizeId, claimed] = await lottery.isAddressWinner(lotteryId, account_address);
                console.log(`Account ${account_address} claimed prize #id: ${prizeId}.`);
            } else {
                console.log(`Account ${account_address} won prize #id: ${prizeId} - ALREADY CLAIMED!`);
            }
        } else {
            console.log(`Account ${account_address} didn't win a prize.`);
        }
    }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
