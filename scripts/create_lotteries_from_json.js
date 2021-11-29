
const hre = require("hardhat");
const ethers = hre.ethers;
const deployer = ethers.getSigner().address;

const CONTRACTS = require('../contracts.js');
const lotteryAddress = CONTRACTS[hre.network.name]["lotteryAddress"];
const nftAddress = CONTRACTS[hre.network.name]["nftAddress"];

const file_name = process.argv.slice(2)[0];

async function main() {
    await hre.run('compile');

    const Lottery = await ethers.getContractFactory("MemeXLottery");
    const lottery = await Lottery.attach(lotteryAddress);

    const fs = require('fs');
    const file_contents = fs.readFileSync(file_name, 'utf8');
    const json_content = JSON.parse(file_contents);
    const output_file = fs.openSync(file_name + ".output", 'w');
    // iterate over json content
    for (const drop of json_content) {
        if (drop.metadata.lotteryId == null) {
            const NFT = await hre.ethers.getContractFactory("MemeXNFT");
            const nftContract = await NFT.attach(nftAddress);

            // create new lottery and update metadata with lotteryId
            drop.metadata.lotteryId = (await lottery.getCurrentLotteryId()).toNumber() + 1;
            console.log("Creating new lottery with #id: " + drop.metadata.lotteryId);
            try {
                // TODO: align with Daniel so that the json provides all these fields
                await lottery.createNewLottery(
                    drop.metadata.costPerTicketPoints,
                    drop.metadata.costPerTicketCoins,
                    drop.metadata.startTime,
                    drop.metadata.endTime,
                    nftContract.address,
                    drop.metadata.boostCost, // boost cost in FTM
                    drop.metadata.maxParticipants,
                    drop.metadata.artistAddress,
                    drop.metadata.metadataBasePath,
                    {
                        gasLimit: 4000000,
                    });
            } catch (err) {
                console.log(err);
                return;
            }
        }
    }
    // generate the output file with updated json content
    const output_line = JSON.stringify(json_content, null, 2);
    fs.writeSync(output_file, output_line);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
