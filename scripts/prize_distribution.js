
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
const buf2hex = x => '0x' + x.toString('hex');

async function main() {
    await hre.run('compile');
    const Lottery = await ethers.getContractFactory("Lottery");
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    [owner, addr1, addr2, addr3, addr4, ...addrs] = await ethers.getSigners();
    accounts = await ethers.getSigners();
    artist = addr1;
    Rewards = await ethers.getContractFactory('Rewards');
    Nft = await ethers.getContractFactory("MemeXNFT");
    if (hre.network.name == "hardhat") {
        // if running on memory, deploy the contracts and initialize 

        Token = await ethers.getContractFactory("MemeXToken");
        token = await Token.deploy("MEMEX", "MemeX", 1, owner.address);

        rewards = await Rewards.deploy(owner.address);
        lottery = await Lottery.deploy(rewards.address);
        await rewards.addSmartContractRole(lottery.address);

        nft = await Nft.deploy("Memex", "MEMEX", owner.address);
        nft.addMinterRole(owner.address);
        await nft.setLotteryContract(lottery.address);
        MockRNG = await ethers.getContractFactory("MockRNG");
        mockRng = await MockRNG.deploy(lottery.address);
        await lottery.setRandomGenerator(mockRng.address);
        await lottery.createNewLottery(0, 0, block.timestamp, block.timestamp + 1100,
            nft.address,
            0, 0, artist.address, "ipfs://path/");
        await lottery.addPrizes(1, [1, 2], [1, 1000]);

        for (i = 0; i < 100; i++) {
            console.log(`Buying ticket with account ${i}`);
            await lottery.connect(accounts[i]).buyTickets(1, 1);
        }
        await ethers.provider.send("evm_increaseTime", [1500]); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await lottery.requestRandomNumber(1);
        await mockRng.fulfillRequest(1, 1);

    } else {
        lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
        lottery = await Lottery.attach(lotteryAddress);
        // nftAddress = CONTRACTS[hre.network.name]["nftAddress"];
        // nft = await Nft.attach(nftAddress);
        // await lottery.createNewLottery(0, 0, block.timestamp, block.timestamp + 86400 * 10,
        //     nft.address,
        //     0, 0, owner.address, "ipfs://path/");
        // process.exit(0);
    }

    console.log("Getting lottery entries...");
    entries = await lottery.getParticipantTickets(lotteryId, { gasLimit: 500000000 });
    totalEntries = entries.length;
    console.log(entries);
    console.log(`A total of ${totalEntries} entries for lotteryId ${lotteryId}`);

    lotteryInfo = await lottery.getLotteryInfo(lotteryId);
    assert(lotteryInfo.status == 4, "Lottery must be closed to distribute prizes");

    defaultPrizeId = lotteryInfo.defaultPrizeId;

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
                lotteryId: Number(lotteryId), winnerAddress: entries[randomPosition], nftId: prizes[prizeIndex].prizeId.toNumber(), proof: "", createdAt: new Date()
            };
            leaves.push(leaf);
        }
    }
    // if lottery has defaultPrize, distribute it to all participants that did not win a prize above
    if (defaultPrizeId != 0) {
        for (i = 0; i < entries.length; i++) {
            if (!winners.has(entries[i])) {
                var leaf = {
                    lotteryId: Number(lotteryId), winnerAddress: entries[i], nftId: defaultPrizeId.toNumber(), proof: "", createdAt: new Date()
                };
                winners.add(entries[i]);
                leaves.push(leaf);
            }
        }
    }
    console.log(`All prizes awarded. Building the merkle tree`);
    hashedLeaves = leaves.map(leaf => getEncodedLeaf(leaf));
    const tree = new MerkleTree(hashedLeaves, keccak256, { sortPairs: true });

    const root = tree.getHexRoot().toString('hex');
    console.log(`Storing Merkle tree root in the contract: ${root}`);
    await lottery.setPrizeMerkleRoot(lotteryId, root);

    // clean any previous results stored for this lottery
    await prisma.prizeProof.deleteMany({
        where: {
            lotteryId: Number(lotteryId)
        }
    });
    // generate proofs for each winner
    for (index in leaves) {
        leaf = leaves[index];
        leaf.proof = tree.getProof(getEncodedLeaf(leaf)).map(x => buf2hex(x.data)).toString();
        console.log(`NFT id: ${leaf.nftId} Winner: ${leaf.winnerAddress} Proof: ${leaf.proof}`)
    }
    // store proofs on the DB so it can be easily queried
    created = await prisma.prizeProof.createMany({ data: leaves });
    console.log(`${created} proofs created in the DB`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

function getEncodedLeaf(leaf) {
    console.log(`Encoding leaf: ${leaf.winnerAddress} ${leaf.nftId}`);
    return keccak256(abiCoder.encode(["uint256", "address", "uint256"],
        [lotteryId, leaf.winnerAddress, leaf.nftId]));
}

