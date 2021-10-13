
const hre = require("hardhat");
const ethers = hre.ethers;
const deployer = ethers.getSigner().address;

const CONTRACTS = require('../contracts.js');


const lotteryId = process.argv.slice(2)[0];
var lotteryAddress;

async function main() {
    await hre.run('compile');

    if (hre.network.name == "hardhat") {
        [owner, addr1, addr2, addr3, addr4, ...addrs] = await ethers.getSigners();
        artist = addr1;
        Token = await ethers.getContractFactory("MemeXToken");
        token = await Token.deploy("MEMEX", "MemeX", 1, owner.address);
        Rewards = await ethers.getContractFactory('Rewards');
        rewards = await Rewards.deploy(token.address, token.address, 1, 0);
        Lottery = await ethers.getContractFactory("Lottery");
        lottery = await Lottery.deploy(rewards.address);
        await rewards.setLotteryAddress(lottery.address);
        Nft = await ethers.getContractFactory("MemeXNFT");
        nft = await Nft.deploy("Memex", "MEMEX", owner.address);
        nft.addMinterRole(owner.address);
        // nft.create(1, 1, 1, owner.address);
        // nft.create(2, 5000, 1, owner.address);
        await nft.setLotteryContract(lottery.address);
        MockRNG = await ethers.getContractFactory("MockRNG");
        mockRng = await MockRNG.deploy(lottery.address);
        await lottery.setRandomGenerator(mockRng.address);
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        await lottery.createNewLottery(0, 0, block.timestamp,
            nft.address,
            0, 0, 0, artist.address, "ipfs://path/");
        await lottery.addPrizes(1, [1, 2], [10, 100]);
        await lottery.buyTickets(1, 2);
        await lottery.connect(addr2).buyTickets(1, 1);
        await lottery.connect(addr3).buyTickets(1, 1);
        await lottery.requestRandomNumber(1);
        await mockRng.fulfillRequest(1, 1);

    } else {
        lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
        const Lottery = await ethers.getContractFactory("Lottery");
        const lottery = await Lottery.attach(lotteryAddress);
    }

    console.log("Getting lottery entries...");
    entries = await lottery.getParticipantEntries(lotteryId);
    totalEntries = entries.length;
    console.log(entries);
    console.log(`A total of ${totalEntries} entries for lotteryId ${lotteryId}`);

    randomSeed = await lottery.randomSeeds(lotteryId);
    console.log(`Random seed: ${randomSeed}`);

    totalParticipants = await lottery.getParticipantsCount(lotteryId);
    console.log(`Total participants: ${totalParticipants}`);

    console.log(`Getting prize info`);
    prizes = await lottery.getPrizes(lotteryId);
    var totalPrizes = 0;
    // iterate the prizes array getting the number of prizes for each entry
    for (let i = 0; i < prizes.length; i++) {
        totalPrizes += prizes[i].maxSupply;
    }
    if (totalPrizes > totalParticipants) {
        totalPrizes = totalParticipants;
    }

    console.log(`Total prizes: ${totalPrizes}`);
    var prizesAwarded = 0;
    console.log(`Starting prize distribution`);
    const winners = new Set();
    for (prizeIndex in prizes) {
        for (i = 0; i < prizes[prizeIndex].maxSupply; i++) {
            if (prizesAwarded == totalPrizes) {
                break;
            }
            hashOfSeed = ethers.utils.solidityKeccak256(['uint256', 'uint256'], [randomSeed, prizesAwarded]);

            // convert hash into a number
            randomPosition = ethers.BigNumber.from(hashOfSeed).mod(totalParticipants);
            console.log(`Hash of seed: ${hashOfSeed} generated random position ${randomPosition}`);
            while (winners.has(entries[randomPosition])) {
                console.log(`${entries[randomPosition]} already won a prize, checking next position in array`);
                randomPosition++;
                randomPosition = randomPosition % totalEntries;
            }
            winners.add(entries[randomPosition]);
            prizesAwarded++;
            console.log(`Awarded prize ${prizesAwarded} of ${totalPrizes} to winner: ${entries[randomPosition]}`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
