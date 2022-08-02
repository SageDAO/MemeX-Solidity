const hre = require("hardhat");
const ethers = hre.ethers;
require("dotenv").config();
const createLogger = require("./logs.js");
const nodemailer = require("nodemailer");
const CONTRACTS = require("../contracts.js");
const fs = require("fs");

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

const baseUrl = process.env.BASE_URL;

async function main() {
    logger = createLogger(
        `sage_scripts_${hre.network.name}`,
        `monitor_events_${hre.network.name}`
    );
    logger.info("Starting monitor_events script");

    // let test = await getUserInfo("0x58a26F4048CdFd3785aD2139AeD336595af22fF5");
    // let nft = await getNFTInfo(64);

    // if (test.email) {
    //     sendMail(
    //         test.email,
    //         "New NFT Sale",
    //         "NFT Sale",
    //         "Your NFT sale was a success, time to celebrate.",
    //         nft.s3Path,
    //         `${baseUrl}artists/${test.username}`,
    //         "See your galery"
    //     );
    // }

    const lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
    const Lottery = await hre.ethers.getContractFactory("Lottery");
    const lottery = await Lottery.attach(lotteryAddress);

    const rewardAddress = CONTRACTS[hre.network.name]["rewardsAddress"];
    const Rewards = await hre.ethers.getContractFactory("Rewards");
    const rewards = await Rewards.attach(rewardAddress);

    const auctionAddress = CONTRACTS[hre.network.name]["auctionAddress"];
    const Auction = await hre.ethers.getContractFactory("Auction");
    const auction = await Auction.attach(auctionAddress);

    const marketplaceAddress =
        CONTRACTS[hre.network.name]["marketplaceAddress"];
    const Marketplace = await hre.ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.attach(marketplaceAddress);

    // listen to events
    marketplace.on(
        "ListedNFTSold",
        async (seller, buyer, contractAddress, tokenId, price) => {
            logger.info(
                `EVENT ListedNFTSold: NFT ${tokenId}/${contractAddress} sold for ${price}`
            );
            let sellerInfo = await getUserInfo(seller);
            let nft = await getNFTInfo(tokenId.toNumber());

            if (sellerInfo.email && sellerInfo.receiveEmailNotification) {
                sendMail(
                    sellerInfo.email,
                    "New NFT Sale",
                    "NFT Sale",
                    "Your NFT sale was a success, time to celebrate.",
                    nft.s3Path,
                    `${baseUrl}artists/${sellerInfo.username}`,
                    "See your galery"
                );
            }
        }
    );

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
            let user = getUserInfo(previousBidder);
            let email = user.email;
            let auction = getAuctionInfo(auctionId.toNumber());

            if (email) {
                sendMail(
                    email,
                    "Sage Auction - NEW BID",
                    "New bid on auction",
                    `The NFT "${auctionInfo.Nft.name}" received a new bid, but there's time if you want it.`,
                    auctionInfo.Nft.s3Path,
                    `${baseUrl}drops/${auctionInfo.Drop.id}`,
                    "View"
                );
            }
            logger.info(
                `EVENT BidPlaced: auction ${auctionId} received bid from ${highestBidder} for ${highestBid}. New end time ${newEndTime}`
            );
        }
    );

    let nftContracts = await getNFTContracts();
    const NFTContract = await hre.ethers.getContractFactory("SageNFT");
    for (contract of nftContracts) {
        let attachedContract = await NFTContract.attach(
            contract.contractAddress
        );
        // monitor nft contract events?
    }

    while (true) {
        await timer(60000);
    }
}

async function getNFTContracts() {
    return await prisma.nftContract.findMany({
        where: {
            contractAddress: {
                not: null
            }
        }
    });
}

async function getUserInfo(walletAddress) {
    let user = await prisma.user.findUnique({
        where: {
            walletAddress: walletAddress
        }
    });
    return user;
}

async function getNFTInfo(tokenId) {
    return await prisma.nft.findUnique({
        where: {
            id: tokenId
        }
    });
}

async function getAuctionInfo(auctionId) {
    let auction = await prisma.auction.findUnique({
        where: {
            id: auctionId
        },
        include: {
            Drop: true,
            Nft: true
        }
    });
    return auction;
}

async function sendMail(to, subject, header, message, img, link, action) {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
        </head>
        <body style="margin: 0">
            <center
                style="
                    max-width: 600px;
                    margin-left: auto;
                    margin-right: auto;
                    background-color: #fff;
                "
            >
                <h1
                    style="
                        border: none;
                        margin-top: 40px;
                        text-transform: uppercase;
                        font-family: 'Marine';
                        font-weight: 400;
                        font-size: 20px;
                        line-height: 136.6%;
                        text-align: center;
                        letter-spacing: 0.1em;
                    "
                >
                    ${header}
                </h1>
                <h4
                    style="
                        margin-top: 24px;
                        text-transform: uppercase;
                        font-family: 'Marine';
                        font-weight: 400;
                        font-size: 12px;
                        line-height: 130%;
                        text-align: center;
                        color: #161619;
                    "
                >
                    ${message}
                </h4>
                <img
                    src="${img}"
                    alt="sdf"
                    class="content-img"
                    style="
                        display: block;
                        margin-top: 20px;
                        width: 311px;
                        height: 300px;
                        margin-left: auto;
                        margin-right: auto;
                    "
                />
                <a
                    href="${link}"
                    target="_blank"
                    style="text-decoration: none"
                >
                    <button
                        style="
                            display: block;
                            text-decoration: none;
                            width: 311px;
                            vertical-align: center;
                            height: 51px;
                            font-family: 'Marine';
                            margin-top: 32px;
                            background-color: red;
                            border: none;
                            border-radius: 0;
                            color: #fff;
                            text-transform: uppercase;
                            font-size: 14px;
                            line-height: 130%;
                            text-align: center;
                            letter-spacing: 0.2em;
                            text-transform: uppercase;
                            cursor: pointer;
                        "
                    >
                        ${action}
                    </button>
                </a>
                <table style=""></table>
                <h5
                    style="
                        margin-top: 39px;
                        font-family: 'Marine';
                        font-style: normal;
                        font-weight: 400;
                        font-size: 8px;
                        line-height: 9px;
                        letter-spacing: 0.1em;
                        color: #161619;
                    "
                >
                    SAGE™️ - ALL RIGHTS RESERVED
                </h5>
            </center>
        </body>
    </html>
`;
    var mailOptions = {
        from: "notification@sage.art",
        to: to,
        subject: subject,
        html: html
    };

    transporter.sendMail(mailOptions, function(error, info) {
        if (error) {
            logger.error(error);
        } else {
            logger.info("email sent");
        }
    });
}

// fs.readFile("test.html", "utf-8", function(err, body) {
//     sendMail("dante@sage.art", "Sage notification", body);
// });

main()
    .then(() => process.exit(0))
    .catch(error => {
        prisma.$disconnect();
        logger.info(error.stack);
        process.exit(1);
    });
