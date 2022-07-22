const hre = require("hardhat");
const ethers = hre.ethers;
require("dotenv").config();
const createLogger = require("./logs.js");
const nodemailer = require("nodemailer");
const CONTRACTS = require("../contracts.js");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const timer = ms => new Promise(res => setTimeout(res, ms));
let logger;

var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "notification@sage.art",
        pass: process.env.MAIL_SERVICE_KEY
    }
});

async function main() {
    logger = createLogger(
        `sage_scripts_${hre.network.name}`,
        `monitor_events_${hre.network.name}`
    );
    logger.info("Starting monitor_events script");
    sendMail("dante@sage.art", "Test", "Test");
    const lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
    const Lottery = await hre.ethers.getContractFactory("Lottery");
    const lottery = await Lottery.attach(lotteryAddress);

    const rewardAddress = CONTRACTS[hre.network.name]["rewardsAddress"];
    const Rewards = await hre.ethers.getContractFactory("Rewards");
    const rewards = await Rewards.attach(rewardAddress);

    const auctionAddress = CONTRACTS[hre.network.name]["auctionAddress"];
    const Auction = await hre.ethers.getContractFactory("Auction");
    const auction = await Auction.attach(auctionAddress);

    // listen to events
    lottery.on("LotteryStatusChanged", (lotteryId, stat) => {
        logger.info(
            `EVENT LotteryStatusChanged: Lottery ${lotteryId} status changed to ${stat}`
        );
    });

    lottery.on("RequestNumbers", (lotteryId, requestId) => {
        logger.info(
            `EVENT RequestNumbers: Lottery ${lotteryId} requested random number with requestId ${requestId}`
        );
    });

    lottery.on("ResponseReceived", requestId => {
        logger.info(`EVENT ResponseReceived: requestId ${lotteryId}`);
    });

    lottery.on(
        "TicketSold",
        (lotteryId, ticketNumber, participantAddress, tier) => {
            logger.info(
                `EVENT TicketSold: #${ticketNumber} sold for lottery ${lotteryId} for participant ${participantAddress} in tier ${tier}`
            );
        }
    );

    lottery.on("PrizeClaimed", (lotteryId, participantAddress, prizeId) => {
        logger.info(
            `EVENT PrizeClaimed: lottery ${lotteryId} prize claimed for participant ${participantAddress} with prizeId ${prizeId}`
        );
    });

    rewards.on(
        "PointsUsed",
        (participantAddress, amountUsed, amountRemaining) => {
            logger.info(
                `EVENT PointsUsed: participant ${participantAddress} used ${amountUsed} points, remaining ${amountRemaining}`
            );
        }
    );

    rewards.on("PointsEarned", (participantAddress, amount) => {
        logger.info(
            `EVENT PointsEarned: participant ${participantAddress} earned ${amount} points`
        );
    });

    auction.on(
        "AuctionCreated",
        (collectionId, auctionId, nftId, erc20Address) => {
            logger.info(
                `EVENT AuctionCreated: auction ${auctionId} created for collection ${collectionId} with nft ${nftId} and erc20 ${erc20Address}`
            );
        }
    );

    auction.on("AuctionSettled", (auctionId, highestBidder, highestBid) => {
        logger.info(
            `EVENT AuctionSettled: auction ${auctionId} settled for highest bidder ${highestBidder} with bid ${highestBid}`
        );
    });

    auction.on(
        "BidPlaced",
        (auctionId, highestBidder, previousBidder, highestBid, newEndTime) => {
            let email = getEMailFromUser(previousBidder);
            let dropName = getDropName(auctionId);

            if (email) {
                sendMail(
                    email,
                    "Sage received a new bid",
                    `Heads up, as as higher bid has been placed on the ${dropName} drop on the Sage app.`
                );
            }
            logger.info(
                `EVENT BidPlaced: auction ${auctionId} received bid from ${highestBidder} for ${highestBid}. New end time ${newEndTime}`
            );
        }
    );

    while (true) {
        await timer(60000);
    }
}

async function getEMailFromUser(walletAddress) {
    let user = prisma.user.findUnique({
        where: {
            walletAddress: walletAddress
        }
    });
    return user.email;
}

async function getDropName(auctionId) {
    let auction = prisma.auction.findUnique({
        where: {
            id: auctionId
        },
        include: {
            Drop: true
        }
    });
    return auction.Drop.name;
}

async function sendMail(to, subject, text) {
    var mailOptions = {
        from: "notification@sage.art",
        to: to,
        subject: subject,
        text: text
    };

    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            logger.error(error);
        } else {
            logger.info("email sent");
        }
    });
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        prisma.$disconnect();
        logger.info(error.stack);
        process.exit(1);
    });
