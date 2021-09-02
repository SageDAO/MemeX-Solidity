
const hre = require("hardhat");
const ethers = hre.ethers;
const deployer = ethers.getSigner().address;

const { lotteryAddress } = require('../contracts.json');

const file_name = process.argv.slice(2)[0];

async function main() {
    await hre.run('compile');

    const Lottery = await ethers.getContractFactory("Lottery");
    const lottery = await Lottery.attach(lotteryAddress);

    const fs = require('fs');
    const file_contents = fs.readFileSync(file_name, 'utf8');
    const json_content = JSON.parse(file_contents);
    const output_file = fs.openSync(file_name + ".output", 'w');
    // iterate over json content
    for (const drop of json_content) {
        if (drop.metadata.lotteryId == null) {
            //deploy a new NFT contract for each new drop
            const NFT = await hre.ethers.getContractFactory("MemeXNFT");
            const nftContract = await NFT.deploy(drop.metadata.dropName, "MMXNFT", lotteryAddress);
            await nftContract.deployed();
            console.log("New NFT contract deployed to:", nftContract.address);

            // create new lottery and update metadata with lotteryId
            drop.metadata.lotteryId = (await lottery.getCurrentLotteryId()).toNumber() + 1;
            console.log("Creating new lottery with #id: " + drop.metadata.lotteryId);
            try {
                // TODO: align with Daniel so that the json provides all these fields
                await lottery.createNewLottery(
                    drop.metadata.costPerTicket,
                    drop.metadata.startTime,
                    drop.metadata.endTime,
                    nftContract.address,
                    drop.prizeIds,
                    drop.metadata.boostCost,
                    drop.metadata.liquidityProviderMultiplier,
                    drop.metadata.metadataBasePath,
                    drop.metadata.defaultPrizeId,
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
