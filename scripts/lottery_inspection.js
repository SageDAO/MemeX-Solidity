
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
let lotteryContract;

async function main() {
    await hre.run('compile');
    logger = createLogger(`memex_scripts_${hre.network.name}`, `lottery_inspection_${hre.network.name}`);
    logger.info(`Starting the lottery inspection script on ${hre.network.name}`);

    const Lottery = await ethers.getContractFactory("MemeXLottery");

    if (hre.network.name == "hardhat") {
        await hardhatTests(Lottery);
    } else {
        lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
        lotteryContract = await Lottery.attach(lotteryAddress);


    }
    logger.info('Searching for lotteries that require action');
    let lotteries = await fetchApprovedDrops();

    const now = Math.floor(Date.now() / 1000);
    for (const lottery of lotteries) {
        if (lottery.finished) {
            continue;
        }
        let primarySplitterAddress = lottery.Drop.PrimarySplitter?.splitterAddress;
        if (lottery.Drop.primarySplitterId != null && primarySplitterAddress == null) {
            lottery.Drop.PrimarySplitter.splitterAddress = await deploySplitter(lottery.dropId, lottery.Drop.primarySplitterId);
        }

        let secondarySplitterAddress = lottery.Drop.SecondarySplitter?.splitterAddress;
        if (lottery.Drop.secondarySplitterId != null && secondarySplitterAddress == null) {
            lottery.SecondarySplitter.splitterAddress = await deploySplitter(lottery.dropId, lottery.Drop.secondarySplitterId);
        }

        if (lottery.Drop.blockchainCreatedAt == null) {
            await createLottery(lottery, CONTRACTS[hre.network.name]["nftAddress"]);
        } else {
            // if we're past endTime, inspect the lottery and take the required actions
            if (now >= lottery.endTime) {
                await inspectLotteryState(lottery);
            }
        }
    }
    await prisma.$disconnect();
    logger.info('Lottery inspection finished successfully');
}

async function fetchApprovedDrops() {
    return await prisma.lottery.findMany({
        where: {
            approvedAt: {
                not: null
            },
        },
        include: {
            Drop: {
                include: {
                    PrimarySplitter: true,
                    SecondarySplitter: true,
                    Artist: true,
                },
            },
        }
    });
}

async function getTotalAmountOfPrizes(dropId, numberOfTicketsSold) {
    prizes = await lotteryContract.getPrizes(dropId);
    var totalPrizes = 0;
    // iterate the prize array getting the number of prizes for each entry
    for (let i = 0; i < prizes.length; i++) {
        totalPrizes += prizes[i].numberOfEditions;
    }
    if (totalPrizes > numberOfTicketsSold) {
        totalPrizes = numberOfTicketsSold;
    }
    return totalPrizes;
}

async function inspectLotteryState(lottery) {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    lotteryInfo = await lotteryContract.getLotteryInfo(lottery.dropId);
    numberOfTicketsSold = lotteryInfo.numberOfTicketsSold;

    // if the lottery has finished but still has the status of "open"
    if (lotteryInfo.status == 0 && lotteryInfo.closeTime < block.timestamp) {
        if (numberOfTicketsSold > 0) {
            logger.info(`Drop #${lottery.dropId} is closed, requesting random number.`);
            await lotteryContract.requestRandomNumber(collectionId);
        } else { // there were no tickets sold
            logger.info(`Drop #${lottery.dropId} was canceled. Closed without participants.`);
            await lotteryContract.cancelLottery(lottery.dropId);
        }
        return;
    }

    // if the lottery is completed
    if (lotteryInfo.status == 3) {
        if (numberOfTicketsSold > 0) {
            // check if there are prizeProofs stored in the DB for that lottery
            // if there aren't any, create the proofs
            logger.info(`Drop #${lottery.dropId} is closed but has no prizes yet`);

            var ticketArray = await lotteryContract.getLotteryTickets(lottery.dropId, 0, numberOfTicketsSold - 1, { gasLimit: 500000000 });
            // map the ticket struct array to an array with only the ticket owner addresses
            var tickets = ticketArray.map(x => x.owner);

            logger.info(`A total of ${numberOfTicketsSold} tickets for dropId ${lottery.dropId}`);

            defaultPrizeId = lotteryInfo.defaultPrizeId;

            randomSeed = await lotteryContract.randomSeeds(lottery.dropId);
            logger.info(`Random seed stored for this lottery: ${randomSeed}`);

            logger.info(`Getting prize info`);
            let totalPrizes = await getTotalAmountOfPrizes(lottery.dropId, numberOfTicketsSold);

            logger.info(`Total prizes: ${totalPrizes}`);
            var prizesAwarded = 0;

            logger.info(`Drop #${lottery.dropId} starting prize distribution`);
            const winnerTicketNumbers = new Set();
            var leaves = new Array();

            for (prizeIndex in prizes) {
                for (i = 0; i < prizes[prizeIndex].numberOfEditions; i++) {
                    if (prizesAwarded == totalPrizes) {
                        break;
                    }
                    hashOfSeed = keccak256(abiCoder.encode(['uint256', 'uint256'], [randomSeed, prizesAwarded]));

                    // convert hash into a number
                    randomPosition = ethers.BigNumber.from(hashOfSeed).mod(numberOfTicketsSold);
                    logger.info(`Generated random position ${randomPosition}`);
                    while (winnerTicketNumbers.has(randomPosition)) {
                        logger.info(`${randomPosition} already won a prize, checking next position in array`);
                        randomPosition++;
                        randomPosition = randomPosition % numberOfTicketsSold;
                    }
                    winnerTicketNumbers.add(randomPosition);
                    prizesAwarded++;
                    logger.info(`Awarded prize ${prizesAwarded} of ${totalPrizes} to winner: ${tickets[randomPosition]}`);

                    var leaf = {
                        lotteryId: Number(lottery.id), winnerAddress: tickets[randomPosition], nftId: prizes[prizeIndex].prizeId.toNumber(), ticketNumber: randomPosition, proof: "", createdAt: new Date()
                    };
                    leaves.push(leaf);
                }
            }

            // if lottery has defaultPrize, distribute it to all participants who did not win a prize above
            if (defaultPrizeId != 0) {
                for (i = 0; i < tickets.length; i++) {
                    if (!winnerTicketNumbers.has(i)) {
                        var leaf = {
                            lotteryId: Number(lottery.id), winnerAddress: tickets[i], nftId: defaultPrizeId.toNumber(), ticketNumber: i, proof: "", createdAt: new Date()
                        };
                        winnerTicketNumbers.add(i);
                        leaves.push(leaf);
                    }
                }
            }
            logger.info(`All prizes awarded. Building the merkle tree`);
            hashedLeaves = leaves.map(leaf => getEncodedLeaf(lottery.dropId, leaf));
            const tree = new MerkleTree(hashedLeaves, keccak256, { sortPairs: true });

            const root = tree.getHexRoot().toString('hex');
            logger.info(`Storing the Merkle tree root in the contract: ${root}`);
            await lotteryContract.setPrizeMerkleRoot(lottery.dropId, root);

            // generate and store proofs for each winner
            await generateAndStoreProofs(leaves, tree, lottery.dropId);

            await prisma.lottery.update({
                where: {
                    id: lottery.id
                },
                data: {
                    finished: true,
                }
            });

            logger.info(`Drop #${lottery.dropId} had ${leaves.length} prizes distributed.`);
        }
    }
}

async function generateAndStoreProofs(leaves, tree, dropId) {
    for (index in leaves) {
        leaf = leaves[index];
        leaf.proof = tree.getProof(getEncodedLeaf(dropId, leaf)).map(x => buf2hex(x.data)).toString();
        logger.info(`NFT id: ${leaf.nftId} Winner: ${leaf.winnerAddress} Ticket Number: ${leaft.ticketNumber} Proof: ${leaf.proof}`);
    }
    // store proofs on the DB so they can be easily queried
    if (hre.network.name != "hardhat") {
        created = await prisma.prizeProof.createMany({ data: leaves });
        logger.info(`${created.count} Proofs created in the DB.`);
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

function getEncodedLeaf(collectionId, leaf) {
    logger.info(`Encoding leaf: ${leaf.winnerAddress} ${leaf.nftId}`);
    return keccak256(abiCoder.encode(["uint256", "address", "uint256", "uint256"],
        [collectionId, leaf.winnerAddress, leaf.nftId, leaf.ticketNumber]));
}

async function deploySplitter(dropId, splitId) {
    let owner = await ethers.getSigner();
    let splitEntries = await prisma.splitEntry.findMany({
        where: {
            splitterId: splitId
        }
    });
    if (splitEntries.length == 0) {
        logger.error(`No split addresses found for Drop #${dropId}`);
        return null;
    }
    let splitAddress;
    if (splitEntries.length == 1) {
        logger.info(`Only one split address found for Drop #${dropId}. No splitter needed.`);
        splitAddress = splitEntries[0].destinationAddress;
    } else {
        logger.info(`Deploying splitter for splitId #${splitId}`);
        let destinations = new Array();
        let weights = new Array();
        for (i = 0; i < splitEntries.length; i++) {
            destinations.push(splitEntries[i].destinationAddress);
            weights.push(parseInt(splitEntries[i].percent * 100));// royalty percentage using basis points. 1% = 100
        }
        const Splitter = await ethers.getContractFactory("MemeXSplitter");
        const splitter = await Splitter.deploy(owner.address, destinations, weights);
        splitAddress = splitter.address;
        logger.info(`Splitter deployed to ${splitAddress}`);
    }
    await prisma.splitter.update({
        where: { id: splitId },
        data: { splitterAddress: splitAddress }
    });
    return splitAddress;
}

async function createLottery(lottery, nftContractAddress) {
    logger.info("Creating lottery for drop #id: " + lottery.dropId);
    const Nft = await ethers.getContractFactory("MemeXNFT");
    const nft = await Nft.attach(nftContractAddress);
    let royaltyAddress = lottery.Drop.secondarySplitterId != null ? lottery.Drop.SecondarySplitter.splitterAddress : lottery.Drop.artistAddress;
    let primarySalesDestination = lottery.Drop.primarySplitterId != null ? lottery.Drop.PrimarySplitter.splitterAddress : lottery.Drop.artistAddress;
    // percentage in basis points (200 = 2.00%)
    let royaltyPercentageBasisPoints = parseInt(lottery.Drop.royaltyPercentage * 100);
    await nft.createCollection(
        lottery.dropId,
        royaltyAddress,
        royaltyPercentageBasisPoints,
        "https://" + lottery.Drop.dropMetadataCid + ".ipfs.dweb.link/",
        primarySalesDestination);
    logger.info("Collection created");
    const tx = await lotteryContract.createNewLottery(
        lottery.dropId,
        lottery.vipCostPerTicketPoints,
        ethers.utils.parseEther(lottery.vipCostPerTicketCoins.toString()),
        lottery.memberCostPerTicketPoints,
        ethers.utils.parseEther(lottery.memberCostPerTicketCoins.toString()),
        ethers.utils.parseEther(lottery.nonMemberCostPerTicketCoins.toString()),
        lottery.startTime,
        lottery.endTime,
        nftContractAddress,
        lottery.isRefundable,
        lottery.defaultPrizeId || 0
    );
    logger.info("Lottery created");

    if (lottery.maxTickets > 0) {
        logger.info("Setting max tickets to " + lottery.maxTickets);
        await lottery.setMaxTickets(lottery.dropId, lottery.maxTickets);
    }
    lottery.Drop.blockchainCreatedAt = new Date();
    await prisma.lottery.update({
        where: {
            id: lottery.id
        },
        data: {
            isLive: true
        }
    });
    await prisma.drop.update({
        where: {
            id: lottery.dropId
        },
        data: {
            blockchainCreatedAt: lottery.Drop.blockchainCreatedAt,
        }
    });
    await addPrizes(lottery);

    logger.info(`Lottery created with drop id: ${lottery.dropId} | costPoints: ${lottery.costPerTicketPoints} | costCoins: ${lottery.costPerTicketCoins} | startTime: ${lottery.startTime} | endTime: ${lottery.endTime} | maxTickets: ${lottery.maxParticipants} | 
    CreatedBy: ${lottery.Drop.artistAddress} | defaultPrizeId: ${lottery.defaultPrizeId} | royaltyPercentageBasePoints: ${royaltyPercentageBasisPoints} | metadataIpfsPath: ${lottery.Drop.dropMetadataCid}`);
}

const buf2hex = x => '0x' + x.toString('hex');

async function addPrizes(lottery) {
    let prizes = await prisma.nft.findMany({
        where: {
            lotteryId: lottery.dropId
        },
        orderBy: {
            numberOfEditions: "asc"
        }
    });
    let prizeIds = Array();
    let prizeAmounts = Array();
    for (prize of prizes) {
        if (prize.numberOfEditions > 0) {
            prizeIds.push(prize.id);
            prizeAmounts.push(prize.numberOfEditions);
        }
    }
    if (prizeIds.length > 0) {
        await lotteryContract.addPrizes(parseInt(lottery.dropId), prizeIds, prizeAmounts);
    }
}

