const { assert } = require("chai");

const hre = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const createLogger = require("./logs.js");

const sendMail = require("../util/email.js");
const baseUrl = process.env.BASE_URL;

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const ethers = hre.ethers;

const CONTRACTS = require("../contracts.js");

var abiCoder = ethers.utils.defaultAbiCoder;
let logger;
let lotteryContract;
let lotteryAddress;
let auctionAddress;

async function main() {
    await hre.run("compile");
    logger = createLogger(
        `sage_scripts_${hre.network.name}`,
        `lottery_inspection_${hre.network.name}`
    );
    logger.info(`Starting the game inspection script on ${hre.network.name}`);

    const Lottery = await ethers.getContractFactory("Lottery");
    const Auction = await ethers.getContractFactory("Auction");

    if (hre.network.name == "hardhat") {
        await hardhatTests(Lottery);
    } else {
        lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
        lotteryContract = await Lottery.attach(lotteryAddress);

        auctionAddress = CONTRACTS[hre.network.name]["auctionAddress"];
        auctionContract = await Auction.attach(auctionAddress);
    }

    await updateLotteries();
    await updateAuctions();
    await payRefunds();

    await prisma.$disconnect();
    logger.info("Game inspection script finished successfully");
}

async function payRefunds() {
    logger.info("Checking pending refunds");

    let pendingRefunds = await prisma.refund.findMany({
        where: {
            txHash: null
        }
    });

    for (const pendingRefund of pendingRefunds) {
        gasPrice = ethers.utils.formatUnits(
            await ethers.provider.getGasPrice(),
            "gwei"
        );
        if (gasPrice < 100) {
            let pendingAmount = (
                pendingRefund.refundableTokens *
                ethers.BigNumber.from("1000000000000000000")
            ).toString();
            logger.info(
                "Gas at " +
                    gasPrice +
                    " gwei. Sending " +
                    pendingRefund.refundableTokens +
                    " ASH refund to " +
                    pendingRefund.buyer
            );
            let tx = await lotteryContract.refund(
                pendingRefund.buyer,
                pendingRefund.lotteryId,
                pendingAmount
            );
            let receipt = await tx.wait(1);
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            await prisma.refund.update({
                where: {
                    id: pendingRefund.id
                },
                data: {
                    txHash: tx.hash,
                    blockTimestamp: block.timestamp
                }
            });

            let winner = getUserInfo(pendingRefund.buyer);
            sendMail(
                winner.email,
                "You received a SAGE refund!", // subject
                "We just sent you a refund", // header
                "Your ticket was not selected for minting, so we sent you a refund!", // message
                "", // no img
                `https://etherscan.io/tx/${tx.hash}`, // link
                "Check Etherscan", // action
                logger
            );
        }
    }
}

async function updateAuctions() {
    logger.info("Searching for auctions that require action");
    let auctions = await fetchApprovedAuctions();

    const now = Math.floor(Date.now() / 1000);
    for (const auction of auctions) {
        if (auction.claimedAt != null) {
            continue;
        }
        const endTime = Math.floor(auction.endTime / 1000);
        if (auction.contractAddress != null) {
            // if we're past endTime, inspect the auction and take the required actions
            if (now >= endTime && auction.winnerAddress == null) {
                await updateAuctionInfo(auction);
            }
        }
    }
}

async function updateAuctionInfo(auction) {
    let blockchainAuction = await auctionContract.getAuction(auction.id);
    if (blockchainAuction.highestBidder != auction.winnerAddress) {
        logger.info(
            `Updating auction #${auction.id} with highest bidder ${blockchainAuction.highestBidder}`
        );
        await prisma.auction.update({
            where: {
                id: auction.id
            },
            data: {
                winnerAddress: blockchainAuction.highestBidder
            }
        });
    }
}

async function updateLotteries() {
    logger.info("Searching for lotteries that require action");
    let lotteries = await fetchApprovedLotteries();

    const now = Math.floor(Date.now() / 1000);
    for (const lottery of lotteries) {
        if (lottery.prizesAwardedAt != null || lottery.status == 1) {
            // skip if prizes awarded or lottery was cancelled
            continue;
        }

        if (lottery.contractAddress != null) {
            const endTime = Math.floor(lottery.endTime / 1000);
            // if we're past endTime, inspect the lottery and take the required actions
            if (now >= endTime && lottery.prizesAwardedAt == null) {
                await inspectLotteryState(lottery);
            }
        }
    }
}

async function fetchApprovedLotteries() {
    return await prisma.lottery.findMany({
        where: {
            Drop: {
                approvedAt: {
                    not: null
                }
            }
        },
        include: {
            Drop: {
                include: {
                    NftContract: true
                }
            }
        }
    });
}

async function fetchApprovedAuctions() {
    return await prisma.auction.findMany({
        where: {
            Drop: {
                approvedAt: {
                    not: null
                }
            }
        },
        include: {
            Drop: {
                include: {
                    NftContract: true
                }
            }
        }
    });
}

async function inspectLotteryState(lottery) {
    const now = Math.floor(Date.now() / 1000);
    lotteryInfo = await lotteryContract.getLotteryInfo(lottery.id);
    numberOfTicketsSold = lotteryInfo.numberOfTicketsSold;

    // if the lottery has finished but still has the status of "open"
    if (lotteryInfo.status == 0 && lotteryInfo.closeTime < now) {
        if (numberOfTicketsSold > 0) {
            logger.info(
                `Lottery #${lottery.id} is closed, requesting random number.`
            );
            await lotteryContract.requestRandomNumber(lottery.id);
        } else {
            // there were no tickets sold
            logger.info(
                `Lottery #${lottery.id} was canceled. Closed without participants.`
            );
            await lotteryContract.cancelLottery(lottery.id);
        }
        return;
    }

    // if the lottery is completed
    if (lotteryInfo.status == 3) {
        if (numberOfTicketsSold > 0) {
            // check if there are prizeProofs stored in the DB for that lottery
            // if there aren't any, create the proofs
            logger.info(
                `Lottery #${lottery.id} is closed but has no prizes yet`
            );

            var tickets = await lotteryContract.getLotteryTickets(
                lottery.id,
                0,
                numberOfTicketsSold - 1,
                { gasLimit: 500000000 }
            );

            logger.info(
                `A total of ${numberOfTicketsSold} tickets for lottery ${lottery.id}`
            );

            randomSeed = await lotteryContract.randomSeeds(lottery.id);
            logger.info(`Random seed stored for this lottery: ${randomSeed}`);

            logger.info(`Getting prize info`);
            let prizes = await prisma.nft.findMany({
                where: {
                    lotteryId: lottery.id
                },
                orderBy: {
                    id: "asc"
                }
            });
            console.log("Prizes length: " + prizes.length);

            let totalPrizes =
                prizes.length > numberOfTicketsSold
                    ? numberOfTicketsSold
                    : prizes.length;
            if (totalPrizes == 0) {
                logger.info(`No prizes for lottery #${lottery.id}`);
                return;
            }
            logger.info(`Total prizes: ${totalPrizes}`);
            var prizesAwarded = 0;

            logger.info(`Lottery #${lottery.id} starting prize distribution`);
            const winnerTicketNumbers = new Set();
            var leaves = new Array();

            for (let i = 0; i < totalPrizes; i++) {
                hashOfSeed = keccak256(
                    abiCoder.encode(
                        ["uint256", "uint256"],
                        [randomSeed, prizesAwarded]
                    )
                );

                // convert hash into a number
                let randomBigNumber = ethers.BigNumber.from(hashOfSeed).mod(
                    numberOfTicketsSold
                );
                let randomPosition = randomBigNumber.toNumber();
                logger.info(`Generated random position ${randomPosition}`);
                while (winnerTicketNumbers.has(randomPosition)) {
                    logger.info(
                        `${randomPosition} already won a prize, checking next position in array`
                    );
                    randomPosition++;
                    randomPosition = randomPosition % numberOfTicketsSold;
                }
                winnerTicketNumbers.add(randomPosition);
                prizesAwarded++;
                logger.info(
                    `Awarded prize ${prizesAwarded} of ${totalPrizes} to winner: ${tickets[randomPosition]}`
                );

                var leaf = {
                    lotteryId: Number(lottery.id),
                    winnerAddress: tickets[randomPosition],
                    nftId: prizes[i].id,
                    uri: prizes[i].metadataPath,
                    proof: "",
                    createdAt: new Date()
                };
                leaves.push(leaf);
                //}
            }

            logger.info(`All prizes awarded. Building the merkle tree`);
            hashedLeaves = leaves.map(leaf => getEncodedLeaf(lottery.id, leaf));
            const tree = new MerkleTree(hashedLeaves, keccak256, {
                sortPairs: true
            });

            const root = tree.getHexRoot().toString("hex");
            const storedMerkleRoot = await lotteryContract.prizeMerkleRoots(
                lottery.id
            );
            if (root == storedMerkleRoot) {
                logger.info(`Merkle root stored: ${storedMerkleRoot}`);
            } else {
                logger.info(
                    `Storing the Merkle tree root in the contract: ${root}`
                );
                await lotteryContract.setPrizeMerkleRoot(lottery.id, root);
            }
            // generate and store proofs for each winner
            await generateAndStoreProofs(leaves, tree, lottery.id);

            await sendEmailNotificationsToWinners(leaves);

            await prisma.lottery.update({
                where: {
                    id: lottery.id
                },
                data: {
                    prizesAwardedAt: new Date()
                }
            });

            await createRefundRecords(
                lotteryInfo,
                tickets,
                winnerTicketNumbers
            );

            logger.info(
                `Lottery #${lottery.id} had ${leaves.length} prizes distributed.`
            );
        }
    }
}

async function createRefundRecords(lotteryInfo, tickets, winnerTicketNumbers) {
    const ticketCost =
        ethers.BigNumber.from(lotteryInfo.ticketCostTokens) /
        1000000000000000000;
    var refunds = new Map();
    for (let i = 0; i < tickets.length; i++) {
        var refund = {
            lotteryId: lotteryInfo.lotteryID.toNumber(),
            buyer: tickets[i],
            refundableTokens: 0
        };
        if (!winnerTicketNumbers.has(i)) {
            if (!refunds.has(tickets[i])) {
                refunds.set(tickets[i], refund);
            }
            let value = refunds.get(tickets[i]).refundableTokens;
            refund.refundableTokens = value + ticketCost;
            refunds.set(tickets[i], refund);
        }
    }
    const refundsArray = Array.from(refunds.values());
    await prisma.refund.createMany({
        data: refundsArray
    });
    logger.info("Created refund records");

    for (refund of refundsArray) {
        let user = getUserInfo(refund.buyer);
        sendMail(
            user.email,
            "A refund from SAGE", // subject
            "", // header
            "You have a refund for your non-winning tickets. SAGE will send the funds in batches soon. If you prefer, you can head to SAGE and claim them now.", // message
            "", // no img
            `${baseUrl}profile?notifications`, // link
            "Claim refund", // action
            logger
        );
    }
}

async function generateAndStoreProofs(leaves, tree, lotteryId) {
    for (index in leaves) {
        leaf = leaves[index];
        leaf.proof = tree
            .getProof(getEncodedLeaf(lotteryId, leaf))
            .map(x => buf2hex(x.data))
            .toString();
        logger.info(
            `NFT id: ${leaf.nftId} Winner: ${leaf.winnerAddress} URI: ${leaf.uri} Proof: ${leaf.proof}`
        );
    }
    // store proofs on the DB so they can be easily queried
    if (hre.network.name != "hardhat") {
        created = await prisma.prizeProof.createMany({ data: leaves });
        logger.info(`${created.count} Proofs created in the DB.`);
    }
}

async function getUserInfo(walletAddress) {
    return await prisma.user.findUnique({ where: { walletAddress } });
}

async function getNFTInfo(id) {
    return await prisma.nft.findUnique({ where: { id } });
}

async function sendEmailNotificationsToWinners(leaves) {
    for (const leaf of leaves) {
        const winner = await getUserInfo(leaf.winnerAddress);
        if (winner.email && winner.receiveEmailNotification) {
            const nft = await getNFTInfo(leaf.nftId);
            sendMail(
                winner.email,
                "You won a SAGE NFT prize!", // subject
                "Sage NFT Game Prize", // header
                "Your ticket was selected for minting an NFT!", // message
                nft.s3Path, // img
                `${baseUrl}profile?notifications`, // link
                "Claim NFT", // action
                logger
            );
        }
    }
}

async function hardhatTests(Lottery) {
    // if running on the hardhat network, deploy the contracts and initialize
    let owner = await ethers.getSigner();
    const Rewards = await ethers.getContractFactory("Rewards");
    const Nft = await ethers.getContractFactory("NFT");
    const rewards = await Rewards.deploy(owner.address);
    const lottery = await hre.upgrades.deployProxy(Lottery, [
        rewards.address,
        owner.address
    ]);

    nft = await Nft.deploy("Urn", "URN", owner.address);
    MockRNG = await ethers.getContractFactory("MockRNG");
    mockRng = await MockRNG.deploy(lottery.address);
    await lottery.setRandomGenerator(mockRng.address);
    // get current timestamp
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);

    // await lottery.createLottery(0, 1, block.timestamp, block.timestamp + 1100,
    //     nft.address, 0, owner.address, "ipfs://path/");
    // await lottery.addPrizes(1, [1, 2], [1, 1000]);
    // accounts = await ethers.getSigners();
    // for (i = 0; i < 100; i++) {
    //     logger.info(`Buying ticket with account ${i}`);
    //     await lottery.connect(accounts[i]).buyTickets(1, 1, false, { value: 1 });
    // }
    // await ethers.provider.send("evm_increaseTime", [1500]); // long wait, enough to be after the end of the lottery
    // await ethers.provider.send("evm_mine", []);
    // await lottery.requestRandomNumber(1);
    // await mockRng.fulfillRequest(1, 1);
}

function exit(code) {
    process.exit(code);
}

main()
    .then(() => setTimeout(exit, 2000, 0))
    .catch(error => {
        prisma.$disconnect();
        logger.error(error.stack);
        setTimeout(exit, 2000, 1);
    });

function getEncodedLeaf(lotteryId, leaf) {
    logger.info(`Encoding leaf: ${leaf.winnerAddress} ${leaf.nftId}`);
    return keccak256(
        abiCoder.encode(
            ["uint256", "address", "uint256", "string"],
            [lotteryId, leaf.winnerAddress, leaf.nftId, leaf.uri]
        )
    );
}

const buf2hex = x => "0x" + x.toString("hex");
