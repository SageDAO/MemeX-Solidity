
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
            //deploy new NFT contract for the new drop
            const NFT = await hre.ethers.getContractFactory("MemeXNFT");
            const nftContract = await NFT.deploy(drop.metadata.dropName, "MMXNFT");
            await nftContract.deployed();
            console.log("New NFT contract deployed to:", nftContract.address);
            nftContract.setLotteryContract(lotteryAddress, { gasLimit: 4000000, });

            // create new lottery and update metadata lotteryId
            drop.metadata.lotteryId = (await lottery.getCurrentLotteryId()).toNumber() + 1;
            try {
                await lottery.createNewLottery(drop.metadata.costPerTicket, drop.metadata.startTime, drop.metadata.endTime,
                    nftContract.address, drop.prizeIds, 0, 0,
                    drop.metadata.metadataBasePath, 0,
                    {
                        gasLimit: 4000000,
                    });
            } catch (err) {
                console.log(err);
                return;
            }
        }
        console.log("Created new lottery with #id: " + drop.metadata.lotteryId);
    }
    const output_line = JSON.stringify(json_content, null, 2) + "\n";
    fs.writeSync(output_file, output_line);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
