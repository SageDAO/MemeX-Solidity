
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

    if (hre.network.name == "hardhat") { 
        await hardhatTests(Lottery);
    } else {
        lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
        lottery = await Lottery.attach(lotteryAddress);


    }
    logger.info('Searching for lotteries that require action');
    let collections = await fetchApprovedDrops();
    
    const now = Math.floor(Date.now() / 1000);
    for (const collection of collections) {
        if (collection.Lottery.finished ) {
            continue;
        }
        let primarySplitterAddress = collection.PrimarySplitter?.splitterAddress;
        if (collection.primarySplitterId != null && primarySplitterAddress == null) {
            collection.PrimarySplitter.splitterAddress = await deploySplitter(collection, collection.primarySplitterId);
        }
        
        let secondarySplitterAddress = collection.SecondarySplitter?.splitterAddress;
        if (collection.secondarySplitterId != null && secondarySplitterAddress == null) {
            collection.SecondarySplitter.splitterAddress = await deploySplitter(collection, collection.secondarySplitterId);   
        }

        if (collection.Lottery.blockchainCreatedAt == null) {
            await createLottery(collection, lottery, CONTRACTS[hre.network.name]["nftAddress"]);
        } else {
            // if we're past endTime, inspect the lottery and take the required actions
            if (now >= collection.Lottery.endTime) {
                await inspectLotteryState(collection.id, lottery, collection);
            }
        }
    }
    await prisma.$disconnect();
    logger.info('Lottery inspection finished successfully');
}

async function fetchApprovedDrops() {
    return await prisma.collection.findMany({
        where: {
            approvedAt: {
                not: null
            },
        },
        include: {
            PrimarySplitter: true,
            SecondarySplitter: true,
            Artist: true,
            Lottery: true,
        }      
    });
}

async function getTotalAmountOfPrizes(collectionId, totalParticipants) {
    prizes = await lottery.getPrizes(collectionId);
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

async function inspectLotteryState(collectionId, lottery, collection) {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    lotteryInfo = await lottery.getLotteryInfo(collectionId);
    participants = lotteryInfo.participantsCount;
    
    if (lotteryInfo.status == 0 && lotteryInfo.closeTime < block.timestamp) {
        if (participants > 0) {
            logger.info(`Drop #${collection.id} is closed, requesting random number.`);
            await lottery.requestRandomNumber(collectionId);
            return;
        } else {
            logger.info(`Drop #${collection.id} was canceled. Closed without participants.`);
            await lottery.cancelLottery(collectionId);
            return;
        }
    }

    if (lotteryInfo.status == 3) {
        if (participants > 0) {
            // check if there are prizeProofs stored in the DB for that lottery
            // if there aren't any, create the proofs
            logger.info(`Drop #${collection.id} is closed but has no prizes yet`);
            entries = await lottery.getLotteryTickets(collectionId, { gasLimit: 500000000 });
            totalEntries = entries.length;
            logger.info(`A total of ${totalEntries} entries for collectionId ${collectionId}`);

            defaultPrizeId = lotteryInfo.defaultPrizeId;

            randomSeed = await lottery.randomSeeds(collectionId);
            logger.info(`Random seed stored for this lottery: ${randomSeed}`);

            logger.info(`Total participants: ${participants}`);

            logger.info(`Getting prize info`);
            let totalPrizes = await getTotalAmountOfPrizes(collectionId, participants);

            logger.info(`Total prizes: ${totalPrizes}`);
            var prizesAwarded = 0;

            logger.info(`Drop #${collection.id} starting prize distribution`);
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
                        collectionId: Number(collectionId), winnerAddress: entries[randomPosition], nftId: prizes[prizeIndex].prizeId.toNumber(), proof: "", createdAt: new Date()
                    };
                    leaves.push(leaf);
                }
            }

            // if lottery has defaultPrize, distribute it to all participants who did not win a prize above
            if (defaultPrizeId != 0) {
                for (i = 0; i < entries.length; i++) {
                    if (!winners.has(entries[i])) {
                        var leaf = {
                            collectionId: Number(collectionId), winnerAddress: entries[i], nftId: defaultPrizeId.toNumber(), proof: "", createdAt: new Date()
                        };
                        winners.add(entries[i]);
                        leaves.push(leaf);
                    }
                }
            }
            logger.info(`All prizes awarded. Building the merkle tree`);
            hashedLeaves = leaves.map(leaf => getEncodedLeaf(collectionId, leaf));
            const tree = new MerkleTree(hashedLeaves, keccak256, { sortPairs: true });

            const root = tree.getHexRoot().toString('hex');
            logger.info(`Storing the Merkle tree root in the contract: ${root}`);
            await lottery.setPrizeMerkleRoot(collectionId, root);

            // generate and store proofs for each winner
            await generateAndStoreProofs(leaves, tree, collectionId);

            await prisma.lottery.update({
                where: {
                    collectionId: collection.id
                },
                data: {
                    finished: true,
                }
            });

            logger.info(`Drop #${collection.id} had ${leaves.length} prizes distributed.`);
        }
    }
}

async function generateAndStoreProofs(leaves, tree, collectionId) {
    for (index in leaves) {
        leaf = leaves[index];
        leaf.proof = tree.getProof(getEncodedLeaf(collectionId, leaf)).map(x => buf2hex(x.data)).toString();
        logger.info(`NFT id: ${leaf.nftId} Winner: ${leaf.winnerAddress} Proof: ${leaf.proof}`);
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
    return keccak256(abiCoder.encode(["uint256", "address", "uint256"],
        [collectionId, leaf.winnerAddress, leaf.nftId]));
}

async function deploySplitter(collection, splitId) {
    let owner = await ethers.getSigner();
    let splitEntries =  await prisma.splitEntry.findMany({
        where: {
            splitterId: splitId
        }
    });
    if (splitEntries.length == 0) {
        logger.error(`No split addresses found for Drop #${collection.id}`);
        return null;
    }
    let splitAddress;
    if (splitEntries.length == 1) {
        logger.info(`Only one split address found for Drop #${collection.id}. No splitter needed.`);
        splitAddress = splitEntries[0].destinationAddress;
    } else {
        logger.info(`Deploying splitter for splitId #${splitId}`);
        let destinations = new Array();
        let weights = new Array();
        for (i = 0; i < splitEntries.length; i++) {
            destinations.push(splitEntries[i].destinationAddress);
            weights.push(parseInt(splitEntries[i].percent * 100) );// royalty percentage using basis points. 1% = 100
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

async function createLottery(collection, lottery, nftContractAddress) {
    logger.info("Creating lottery for drop #id: " + collection.id);
    const Nft = await ethers.getContractFactory("MemeXNFT");
    const nft = await Nft.attach(nftContractAddress);
    let royaltyAddress = collection.secondarySplitterId != null ? collection.SecondarySplitter.splitterAddress : collection.Collection.artistAddress; 
    let primarySalesDestination = collection.primarySplitterId != null ? collection.PrimarySplitter.splitterAddress : collection.Collection.artistAddress;
    // percentage in basis points (200 = 2.00%)
    let royaltyPercentageBasisPoints = parseInt(collection.royaltyPercentage * 100);
    await nft.createCollection(
        collection.id, 
        royaltyAddress, 
        royaltyPercentageBasisPoints, 
        "https://" + collection.collectionMetadataCid + ".ipfs.dweb.link/",
        primarySalesDestination);
    logger.info("Collection created");
    const tx = await lottery.createNewLottery(
        collection.id,
        collection.Lottery.costPerTicketPoints,
        ethers.utils.parseEther(collection.Lottery.costPerTicketCoins.toString()),
        collection.Lottery.startTime,
        collection.Lottery.endTime,
        nftContractAddress,
        collection.Lottery.defaultPrizeId || 0
    );
    logger.info("Lottery created");

    if (collection.Lottery.maxParticipants > 0) {
        logger.info("Setting max participants to " + collection.Lottery.maxParticipants);
        await lottery.setMaxParticipants(collection.id, collection.Lottery.maxParticipants);
    }
    collection.Lottery.blockchainCreatedAt = new Date();
    await prisma.lottery.update({
        where: {
            collectionId: collection.id
        },
        data: {
            blockchainCreatedAt: collection.Lottery.blockchainCreatedAt,
            isLive: true
        }
    });
    await addPrizes(collection, lottery);

    logger.info(`Lottery created with id: ${collection.collectionId} | costPoints: ${collection.Lottery.costPerTicketPoints} | costCoins: ${collection.Lottery.costPerTicketCoins} | startTime: ${collection.Lottery.startTime} | endTime: ${collection.Lottery.endTime} | maxParticipants: ${collection.Lottery.maxParticipants} | 
    CreatedBy: ${collection.artistAddress} | defaultPrizeId: ${collection.Lottery.defaultPrizeId} | royaltyPercentageBasePoints: ${royaltyPercentageBasisPoints} | metadataIpfsPath: ${collection.collectionMetadataCid}`);
}

const buf2hex = x => '0x' + x.toString('hex');

async function addPrizes(collection, lottery) {
    let prizes = await prisma.nft.findMany({
        where: {
            collectionId: collection.id
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
        await lottery.addPrizes(parseInt(collection.id), prizeIds, prizeAmounts);
    }
}

