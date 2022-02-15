
const { assert } = require("chai");
const hre = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256');
const createLogger = require("./logs.js");

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ethers = hre.ethers;

const CONTRACTS = require('../contracts.js');

var abiCoder = ethers.utils.defaultAbiCoder;
let logger;
let lottery;

async function main() {
    await hre.run('compile');
    logger = createLogger(`memex_scripts_${hre.network.name}`, `lottery_inspection_${hre.network.name}`);
    logger.info(`Starting the lottery inspection script on ${hre.network.name}`);

    const Lottery = await ethers.getContractFactory("MemeXLottery");
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);

    if (hre.network.name == "hardhat") {
        await hardhatTests(Lottery, block);
    } else {
        lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
        lottery = await Lottery.attach(lotteryAddress);
    }
    logger.info('Searching for lotteries that require action');
    let drops = await prisma.drop.findMany({
        where: {
            approvedAt: {
                not: null
            },
            finished: {
                equals: false,
            }
        },
        include: {
            Splitter: true,
        }
    });
    const now = Math.floor(Date.now() / 1000);
    for (const drop of drops) {
        if (drop.Splitter?.splitterAddress == null) {
            splitterAddress = await deploySplitter(drop);           
        }
        if (drop.blockchainCreatedAt == null) {
            let royaltyAddress = drop.splitterId != null ? splitterAddress : drop.CreatedBy.walletAddress; 
            await createLottery(drop, lottery, CONTRACTS[hre.network.name]["nftAddress"], royaltyAddress);
        } else {
            if (now >= drop.endTime) {
                await inspectLotteryState(drop.lotteryId, lottery, block, drop);
            }
        }
    }
    await prisma.$disconnect();
    logger.info('Lottery inspection finished successfully');
}

async function getTotalAmountOfPrizes(lotteryId, totalParticipants) {
    prizes = await lottery.getPrizes(lotteryId);
    var totalPrizes = 0;
    // iterate the prize array getting the number of prizes for each entry
    for (let i = 0; i < prizes.length; i++) {
        totalPrizes += prizes[i].maxSupply;
    }
    if (totalPrizes > totalParticipants) {
        totalPrizes = totalParticipants;
    }
    return totalPrizes;
}

async function inspectLotteryState(lotteryId, lottery, block, drop) {
    lotteryInfo = await lottery.getLotteryInfo(lotteryId);
    participants = lotteryInfo.participantsCount;
    
    if (lotteryInfo.status == 2 && lotteryInfo.closingTime < block.timestamp) {
        if (participants > 0) {
            logger.info(`Drop #${drop.id} is closed, requesting random number.`);
            await lottery.requestRandomNumber(lotteryId);
            return;
        } else {
            logger.info(`Drop #${drop.id} was canceled. Closed without participants.`);
            await lottery.cancelLottery(lotteryId);
            return;
        }
    }

    if (lotteryInfo.status == 4) {
        if (participants > 0) {
            // check if there are prizeProofs stored in the DB for that lottery
            // if there aren't any, create the proofs
            logger.info(`Drop #${drop.id} is closed but has no prizes yet`);
            entries = await lottery.getLotteryTickets(lotteryId, { gasLimit: 500000000 });
            totalEntries = entries.length;
            logger.info(`A total of ${totalEntries} entries for lotteryId ${lotteryId}`);

            defaultPrizeId = lotteryInfo.defaultPrizeId;

            randomSeed = await lottery.randomSeeds(lotteryId);
            logger.info(`Random seed stored for this lottery: ${randomSeed}`);

            logger.info(`Total participants: ${participants}`);

            logger.info(`Getting prize info`);
            let totalPrizes = await getTotalAmountOfPrizes(lotteryId, participants);

            logger.info(`Total prizes: ${totalPrizes}`);
            var prizesAwarded = 0;
            logger.info(`Drop #${drop.id} starting prize distribution`);
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
                    logger.info(`Generated random position ${randomPosition}`);
                    while (winners.has(entries[randomPosition])) {
                        logger.info(`${entries[randomPosition]} already won a prize, checking next position in array`);
                        randomPosition++;
                        randomPosition = randomPosition % totalEntries;
                    }
                    winners.add(entries[randomPosition]);
                    prizesAwarded++;
                    logger.info(`Awarded prize ${prizesAwarded} of ${totalPrizes} to winner: ${entries[randomPosition]}`);

                    var leaf = {
                        lotteryId: Number(lotteryId), winnerAddress: entries[randomPosition], nftId: prizes[prizeIndex].prizeId.toNumber(), proof: "", createdAt: new Date()
                    };
                    leaves.push(leaf);
                }
            }
            // if lottery has defaultPrize, distribute it to all participants who did not win a prize above
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
            logger.info(`All prizes awarded. Building the merkle tree`);
            hashedLeaves = leaves.map(leaf => getEncodedLeaf(lotteryId, leaf));
            const tree = new MerkleTree(hashedLeaves, keccak256, { sortPairs: true });

            const root = tree.getHexRoot().toString('hex');
            logger.info(`Storing the Merkle tree root in the contract: ${root}`);
            await lottery.setPrizeMerkleRoot(lotteryId, root);

            // generate proofs for each winner
            for (index in leaves) {
                leaf = leaves[index];
                leaf.proof = tree.getProof(getEncodedLeaf(lotteryId, leaf)).map(x => buf2hex(x.data)).toString();
                logger.info(`NFT id: ${leaf.nftId} Winner: ${leaf.winnerAddress} Proof: ${leaf.proof}`)
            }
            // store proofs on the DB so they can be easily queried
            if (hre.network.name != "hardhat") {
                created = await prisma.prizeProof.createMany({ data: leaves });
                logger.info(`${created.count} Proofs created in the DB.`);
            }
            logger.info(`Drop #${drop.id} had ${leaves.length} prizes distributed.`);
        }
    }
}

async function hardhatTests(Lottery, block) {
    // if running on the hardhat network, deploy the contracts and initialize 
    let owner = await ethers.getSigner();
    const Rewards = await ethers.getContractFactory('Rewards');
    const Nft = await ethers.getContractFactory("MemeXNFT");
    const rewards = await Rewards.deploy(owner.address);
    const lottery = await Lottery.deploy(rewards.address);
    await rewards.addSmartContractRole(lottery.address);

    nft = await Nft.deploy("Memex", "MEMEX", owner.address);
    nft.addMinterRole(owner.address);
    nft.addMinterRole(lottery.address);
    nft.addSmartContractRole(lottery.address);
    MockRNG = await ethers.getContractFactory("MockRNG");
    mockRng = await MockRNG.deploy(lottery.address);
    await lottery.setRandomGenerator(mockRng.address);
    await lottery.createNewLottery(0, 1, block.timestamp, block.timestamp + 1100,
        nft.address, 0, owner.address, "ipfs://path/");
    await lottery.addPrizes(1, [1, 2], [1, 1000]);
    accounts = await ethers.getSigners();
    for (i = 0; i < 100; i++) {
        logger.info(`Buying ticket with account ${i}`);
        await lottery.connect(accounts[i]).buyTickets(1, 1, false, { value: 1 });
    }
    await ethers.provider.send("evm_increaseTime", [1500]); // long wait, enough to be after the end of the lottery
    await ethers.provider.send("evm_mine", []);
    await lottery.requestRandomNumber(1);
    await mockRng.fulfillRequest(1, 1);
}

function exit(code) {
    process.exit(code);
}

main()
    .then(() => setTimeout(exit, 2000, 0))
    .catch((error) => {
        prisma.$disconnect();
        logger.error(error.stack);
        setTimeout(exit, 2000, 1);
    });

function getEncodedLeaf(lotteryId, leaf) {
    logger.info(`Encoding leaf: ${leaf.winnerAddress} ${leaf.nftId}`);
    return keccak256(abiCoder.encode(["uint256", "address", "uint256"],
        [lotteryId, leaf.winnerAddress, leaf.nftId]));
}

async function deploySplitter(drop) {
    logger.info(`Deploying splitter for drop #${drop.id}`);
    let owner = await ethers.getSigner();
    let royaltySplits =  await prisma.royaltySplit.findMany({
        where: {
            splitterId: drop.splitterId
        }
    });
    if (royaltySplits.length < 2) {
        logger.error(`Drop #${drop.id} contain less than 2 royalty split addresses`);
        return null;
    }
    let destinations = new Array();
    let weights = new Array();
    for (i = 0; i < royaltySplits.length; i++) {
        destinations.push(royaltySplits[i].destinationAddress);
        weights.push(parseInt(royaltySplits[i].percent * 100) );// royalty percentage using basis points. 1% = 100
    }
    const Splitter = await ethers.getContractFactory("MemeXSplitter");
    const splitter = await Splitter.deploy(owner.address, destinations, weights);
    await prisma.splitter.update({
        where: { id: drop.splitterId },
        data: { splitterAddress: splitter.address }
    });
    return splitter.address;
}

async function createLottery(drop, lottery, nftContractAddress, royaltyAddress) {
    logger.info("Creating lottery for drop #id: " + drop.id);
    // percentage in base points (200 = 2.00%)
    let royaltyPercentageBasePoints = parseInt(drop.royaltyPercentage * 100);
    const tx = await lottery.createNewLottery(
        drop.costPerTicketPoints,
        ethers.utils.parseEther(drop.costPerTicketCoins.toString()),
        drop.startTime,
        drop.endTime,
        nftContractAddress,
        drop.maxParticipants,
        royaltyAddress,
        drop.defaultPrizeId || 0,
        royaltyPercentageBasePoints,
        "https://" + drop.prizeMetadataCid + ".ipfs.dweb.link/"
    );
    const receipt = await tx.wait();
    drop.lotteryId = receipt.events[1].args[0];
    drop.blockchainCreatedAt = new Date();
    await prisma.drop.update({
        where: {
            id: drop.id
        },
        data: {
            lotteryId: drop.lotteryId.toNumber(),
            blockchainCreatedAt: drop.blockchainCreatedAt,
            isLive: true
        }
    });
    await addPrizes(drop, lottery);

    logger.info(`Lottery created with lotteryId: ${drop.lotteryId} | costPoints: ${drop.costPerTicketPoints} | costCoins: ${drop.costPerTicketCoins} | startTime: ${drop.startTime} | endTime: ${drop.endTime} | maxParticipants: ${drop.maxParticipants} | 
    CreatedBy: ${drop.CreatedBy.walletAddress} | defaultPrizeId: ${drop.defaultPrizeId} | royaltyPercentageBasePoints: ${royaltyPercentageBasePoints} | metadataIpfsPath: ${drop.metadataIpfsPath}`);
}

const buf2hex = x => '0x' + x.toString('hex');

async function addPrizes(drop, lottery) {
    let prizes = await prisma.nft.findMany({
        where: {
            dropId: drop.id
        },
        orderBy: {
            numberOfMints: "asc"
        }
    });
    let prizeIds = Array();
    let prizeAmounts = Array();
    for (prize of prizes) {
        if (prize.numberOfMints > 0 ) {
            prizeIds.push(prize.id);
            prizeAmounts.push(prize.numberOfMints);
        }
    }
    if (prizeIds.length > 0) {
        await lottery.addPrizes(drop.lotteryId.toNumber(), prizeIds, prizeAmounts);
    }
}

