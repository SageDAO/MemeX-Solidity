const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const sendMail = require("../util/email.js");
const baseUrl = process.env.BASE_URL;
const createLogger = require("./logs.js");

var logger;

async function main() {
    console.log(`main()`);
    logger = createLogger(
        `sage_scripts`,
        `monitor_events`
    );
    const leaves = [
        { winnerAddress: '0x58a26F4048CdFd3785aD2139AeD336595af22fF5', nftId: 200 },
        { winnerAddress: '0xc88124EFECD07c1947756993F950a53261f102df', nftId: 160 },
        { winnerAddress: '0x19596e1D6cd97916514B5DBaA4730781eFE49975', nftId: 70 },
    ];
    await sendEmailNotificationsToWinners(leaves);
}

async function sendEmailNotificationsToWinners(leaves) {

    async function getUserInfo(walletAddress) {
        return await prisma.user.findUnique({ where: { walletAddress } });
    }
    
    async function getNFTInfo(id) {
        return await prisma.nft.findUnique({ where: { id } });
    }

    for (const leaf of leaves) {
        const winner = await getUserInfo(leaf.winnerAddress);
        if (winner.email && winner.receiveEmailNotification) {
            const nft = await getNFTInfo(leaf.nftId);
            console.log(`${winner.email} ${nft.s3Path}`)
            sendMail(
                winner.email,
                "You won a SAGE NFT prize!", // subject
                "Sage NFT Game Prize", // header
                "Your ticket was selected for minting an NFT!", // message
                nft.s3Path, // img
                `${baseUrl}profile`, // link
                "Claim NFT", // action
                logger
            );
        } else {
            console.log(`Bypassing winner ${leaf.winnerAddress}`)
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        prisma.$disconnect();
        console.log(error.stack);
        process.exit(1);
    });