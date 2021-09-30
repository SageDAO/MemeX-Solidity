
const hre = require("hardhat");
const ethers = hre.ethers;
const deployer = ethers.getSigner().address;

const CONTRACTS = require('../contracts.js');
const rewardsAddress = CONTRACTS[hre.network.name]["rewardsAddress"];

const file_name = process.argv.slice(2)[0];

const timer = ms => new Promise(res => setTimeout(res, ms));

const erc20AbiFragment = [
    {
        name: 'balanceOf',
        type: 'function',
        inputs: [
            {
                name: '_owner',
                type: 'address',
            },
        ],
        outputs: [
            {
                name: 'balance',
                type: 'uint256',
            },
        ],
        constant: true,
        payable: false,
    },
];

async function main() {
    await hre.run('compile');

    const Rewards = await ethers.getContractFactory("Rewards");
    const rewards = await Rewards.attach(rewardsAddress);
    const memeAddress = await rewards.memeAddress();
    const liquidityAddress = await rewards.liquidityAddress();
    console.log(`MEME address: ${memeAddress}`);
    console.log(`Liquidity address: ${liquidityAddress}`);
    const memeContract = new ethers.Contract(memeAddress, erc20AbiFragment, ethers.getDefaultProvider(hre.network.name));
    const liquidityContract = new ethers.Contract(liquidityAddress, erc20AbiFragment, ethers.getDefaultProvider(hre.network.name));

    console.log("Getting user list...");
    joinedUsers = await rewards.getUserList();
    console.log(`A total of ${joinedUsers.length} users joined Memex`);
    for (const user of joinedUsers) {
        console.log(`Checking balances for user ${user}`);
        userInfo = await rewards.userInfo(user);
        const memeBalance = await memeContract.balanceOf(user);
        const liquidityBalance = await liquidityContract.balanceOf(user);
        console.log(`MEME balance stored on contract: ${memeBalance}, balance on wallet ${userInfo.memeOnWallet}`);
        console.log(`Liquidity balance stored on contract: ${liquidityBalance}, balance on wallet ${userInfo.liquidityOnWallet}`);
        if (!memeBalance.eq(userInfo.memeOnWallet) ||
            !liquidityBalance.eq(userInfo.liquidityOnWallet)) {
            console.log(`Updating balances for ${user}`);
            await rewards.updateUserBalance(user, memeBalance, liquidityBalance);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
