
const { assert } = require("chai");
const hre = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ethers = hre.ethers;
const deployer = ethers.getSigner().address;

const CONTRACTS = require('../contracts.js');

const lotteryId = process.argv.slice(2)[0];
var abiCoder = ethers.utils.defaultAbiCoder;
var lotteryAddress;
const buf2hex = x => '0x' + x.toString('hex');

async function main() {
    await hre.run('compile');
    const Lottery = await ethers.getContractFactory("Lottery");
    var lottery;
    if (hre.network.name == "hardhat") {
        [owner, addr1, addr2, addr3, addr4, ...addrs] = await ethers.getSigners();
        artist = addr1;
        Token = await ethers.getContractFactory("MemeXToken");
        token = await Token.deploy("MEMEX", "MemeX", 1, owner.address);
        Rewards = await ethers.getContractFactory('Rewards');
        rewards = await Rewards.deploy(token.address, token.address, 1, 0);
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
        await lottery.addPrizes(1, [1, 2], [1, 10]);
        await lottery.buyTickets(1, 2);
        await lottery.connect(addr2).buyTickets(1, 1);
        await lottery.connect(addr3).buyTickets(1, 1);
        await lottery.requestRandomNumber(1);
        await mockRng.fulfillRequest(1, 1);

    } else {
        lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
        lottery = await Lottery.attach(lotteryAddress);
    }

    console.log("Getting lottery entries...");
    entries = await lottery.getParticipantEntries(lotteryId);
    totalEntries = entries.length;
    console.log(entries);
    console.log(`A total of ${totalEntries} entries for lotteryId ${lotteryId}`);

    lotteryInfo = await lottery.getLotteryInfo(lotteryId);
    assert(lotteryInfo.status == 4, "Lottery must be closed to distribute prizes");

    randomSeed = await lottery.randomSeeds(lotteryId);
    console.log(`Random seed stored for this lottery: ${randomSeed}`);

    totalParticipants = await lottery.getParticipantsCount(lotteryId);
    console.log(`Total participants: ${totalParticipants}`);

    console.log(`Getting prize info`);
    prizes = await lottery.getPrizes(lotteryId);
    var totalPrizes = 0;
    // iterate the prize array getting the number of prizes for each entry
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
    var leaves = new Array();
    for (prizeIndex in prizes) {
        for (i = 0; i < prizes[prizeIndex].maxSupply; i++) {
            if (prizesAwarded == totalPrizes) {
                break;
            }
            hashOfSeed = keccak256(abiCoder.encode(['uint256', 'uint256'], [randomSeed, prizesAwarded]));

            // convert hash into a number
            randomPosition = ethers.BigNumber.from(hashOfSeed).mod(totalEntries);
            console.log(`Generated random position ${randomPosition}`);
            while (winners.has(entries[randomPosition])) {
                console.log(`${entries[randomPosition]} already won a prize, checking next position in array`);
                randomPosition++;
                randomPosition = randomPosition % totalEntries;
            }
            winners.add(entries[randomPosition]);
            prizesAwarded++;
            console.log(`Awarded prize ${prizesAwarded} of ${totalPrizes} to winner: ${entries[randomPosition]}`);

            var leaf = {
                lottery: lotteryId, address: entries[randomPosition], prize: prizes[prizeIndex].prizeId, encoded: abiCoder.encode(["uint256", "address", "uint256"],
                    [lotteryId, entries[randomPosition], prizes[prizeIndex].prizeId]), hexProof: ""
            };
            leaves.push(leaf);
        }
    }
    console.log(`All prizes awarded. Building the merkle tree`);
    hashedLeaves = leaves.map(leaf => keccak256(leaf.encoded));
    const tree = new MerkleTree(hashedLeaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot().toString('hex');
    console.log(`Storing Merkle tree root in the contract: ${root}`);
    await lottery.setMerkleRoot(lotteryId, root);
    // clean any previous results stored for this lottery
    await prisma.proof.deleteMany({
        where: {
            lotteryId: Number(lotteryId)
        }
    });
    // generate proofs for each winner
    for (index in leaves) {
        leaf = leaves[index];
        leaf.hexProof = tree.getProof(keccak256(leaf.encoded)).map(x => buf2hex(x.data));
        console.log(`Prize id: ${leaf.prize} Winner: ${leaf.address} Proof: ${leaf.hexProof}`)

        // store proof on the DB so it can be easily queried
        await prisma.proof.create({
            data: {
                lotteryId: Number(lotteryId),
                winnerAddress: leaf.address,
                proof: leaf.hexProof.toString(),
                prizeId: leaf.prize.toNumber()
            }
        });
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
