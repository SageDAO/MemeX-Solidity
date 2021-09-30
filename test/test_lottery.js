const { expect } = require("chai");
const { ethers } = require("hardhat");
const { Wallet } = require('ethers');

const rewardRateToken = 1;
const rewardRateLiquidity = 0;
const timer = ms => new Promise(res => setTimeout(res, ms));

describe("Lottery Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
        [owner, ...accounts] = await ethers.getSigners();
        Token = await ethers.getContractFactory("MemeXToken");
        token = await Token.deploy("MEMEX", "MemeX", 1, owner.address);
        Rewards = await ethers.getContractFactory('Rewards');
        rewards = await Rewards.deploy(token.address, token.address, rewardRateToken, rewardRateLiquidity);
        Lottery = await ethers.getContractFactory("Lottery");
        lottery = await Lottery.deploy(rewards.address);
        await rewards.setLotteryAddress(lottery.address);
        Nft = await ethers.getContractFactory("MemeXNFTBasic");
        nft = await Nft.deploy("Memex", "MEMEX", owner.address);
        await nft.setLotteryContract(lottery.address);
        MockRNG = await ethers.getContractFactory("MockRNG");
        mockRng = await MockRNG.deploy(lottery.address);
        await lottery.setRandomGenerator(mockRng.address);

        // create a new lottery
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        await lottery.createNewLottery(15, 0, block.timestamp, block.timestamp + 3600 * 24,
            nft.address, 2,
            ethers.utils.parseEther("1"), 0, false);

    });

    it("Should create a lottery game", async function () {
        expect(await lottery.getCurrentLotteryId()).to.equal(1);
    });

    it("Should allow user to buy 1 lottery ticket", async function () {
        await rewards.join();
        await waitAndMineBlock(15);
        await lottery.buyTickets(1, 1);
        expect(await lottery.getNumberOfParticipants(1)).to.equal(1);
        expect(await lottery.getTotalEntries(1)).to.equal(1);
    });

    it("Should allow user to buy more tickets on a separate transaction", async function () {
        await rewards.join();
        await waitAndMineBlock(30);
        await lottery.buyTickets(1, 1);
        await lottery.buyTickets(1, 1);
        expect(await lottery.getNumberOfParticipants(1)).to.equal(1);
        expect(await lottery.getTotalEntries(1)).to.equal(2);
    });


    it("Should let user buy 10 lottery tickets", async function () {
        await rewards.join();
        await waitAndMineBlock(150);
        await lottery.buyTickets(1, 10);
        expect(await lottery.getNumberOfParticipants(1)).to.equal(1);
        expect(await lottery.getTotalEntries(1)).to.equal(10);
    });

    it("Should not let users join when Lottery is full", async function () {
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        await lottery.createNewLottery(0, 0, block.timestamp, block.timestamp + 10,
            nft.address, [1],
            ethers.utils.parseEther("1"),
            1, // just one participant allowed
            false
        );
        await lottery.buyTickets(2, 1);
        // should fail on the second entry
        await expect(lottery.connect(addr1).buyTickets(2, 1)).to.be.revertedWith("Lottery is full");
    });

    it("Should allow user to boost", async function () {
        await rewards.join();
        await waitAndMineBlock(15);
        await lottery.buyTickets(1, 1);
        await lottery.boostParticipant(1, owner.address,
            { value: ethers.utils.parseEther("1") });
        expect(await lottery.getTotalEntries(1)).to.equal(2);
        expect(await lottery.isBooster(1, owner.address)).to.equal(true);
    });

    it("Should not allow user to buy ticket when lottery is not open", async function () {
        await rewards.join();
        await waitAndMineBlock(10000000000); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await expect(lottery.buyTickets(1, 1)).to.be.revertedWith("Lottery is not open");
    });


    it("Should not allow to boost without sending funds", async function () {
        await rewards.join();
        await waitAndMineBlock(15);
        await lottery.buyTickets(1, 1);
        await expect(lottery.boostParticipant(1, owner.address,
            { value: ethers.utils.parseEther("0") })).to.be.reverted;
    });

    it("Should not allow to boost without buying ticket", async function () {
        await rewards.join();
        await waitAndMineBlock(15);
        await expect(lottery.boostParticipant(1, owner.address,
            { value: ethers.utils.parseEther("1") })).to.be.revertedWith("Participant not found");
    });

    it("Should not allow to buy ticktes with the wrong lottery id", async function () {
        await rewards.join();
        await waitAndMineBlock(15);
        await expect(lottery.buyTickets(2, 1)).to.be.revertedWith("Lottery is not open");
    });

    it("Should not allow to boost using wrong lottery id", async function () {
        await rewards.join();
        await waitAndMineBlock(15);
        await lottery.buyTickets(1, 1);
        await expect(lottery.boostParticipant(2, owner.address,
            { value: ethers.utils.parseEther("1") })).to.be.revertedWith("Can't boost on this lottery");
    });

    it("Should run the lottery with one participant and allow to mint the prize only once", async function () {
        await rewards.join();
        await waitAndMineBlock(15);
        await lottery.buyTickets(1, 1);
        await lottery.requestRandomNumber(1);
        expect(await mockRng.fulfillRequest(1, 1)).to.have.emit(lottery, "ResponseReceived");
        await lottery.definePrizeWinners(1, 1);
        result = await lottery.isAddressWinner(1, owner.address);
        expect(result[0]).to.equal(true);  // winner
        expect(result[1]).to.equal(1);     // prize id 1
        expect(result[2]).to.equal(false); // not claimed
        await lottery.redeemNFT(1);
        result = await lottery.isAddressWinner(1, owner.address);
        expect(result[0]).to.equal(true); // winner
        expect(result[1]).to.equal(1);    // prize id 1
        expect(result[2]).to.equal(true); // claimed
        // should allow to mint only once
        await expect(lottery.redeemNFT(1)).to.be.revertedWith("Participant already claimed prize");
    });

    it("Should run more than one lottery", async function () {
        await rewards.join();
        await waitAndMineBlock(15);
        await lottery.buyTickets(1, 1);
        await lottery.requestRandomNumber(1);
        expect(await mockRng.fulfillRequest(1, 1)).to.have.emit(lottery, "ResponseReceived");
        await lottery.definePrizeWinners(1, 1);
        await lottery.redeemNFT(1);
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        // deploy a second NFT contract
        Nft2 = await ethers.getContractFactory("MemeXNFTBasic");
        nft2 = await Nft2.deploy("Memex2", "MEMEX2", owner.address);
        await nft2.setLotteryContract(lottery.address);
        // create a second lottery
        await lottery.createNewLottery(0, 0, block.timestamp, block.timestamp + 3600 * 24,
            nft2.address, 1,
            ethers.utils.parseEther("1"), 0, false);
        await lottery.buyTickets(2, 1);
        await lottery.requestRandomNumber(2);
        expect(await mockRng.fulfillRequest(2, 1)).to.have.emit(lottery, "ResponseReceived");
        await lottery.definePrizeWinners(2, 1);
        await lottery.redeemNFT(2);

    });

    describe("Big Lottery", () => {
        beforeEach(async () => {
            accounts = await ethers.getSigners()
            const blockNum = await ethers.provider.getBlockNumber();
            const block = await ethers.provider.getBlock(blockNum);
            // creating lottery with id = 2
            await lottery.createNewLottery(0, 0, block.timestamp, block.timestamp + 3600 * 24,
                nft.address, 700,
                ethers.utils.parseEther("1"), 0, true);
            for (let i = 0; i < 400; i++) {
                await lottery.connect(accounts[i]).buyTickets(2, 1);
            }
        });

        it("Should run lottery with large # of entries and default prize and allow to mint", async function () {
            for (let i = 400; i < 700; i++) {
                await lottery.connect(accounts[i]).buyTickets(2, 1);
            }
            await lottery.requestRandomNumber(2);
            expect(await mockRng.fulfillRequest(2, 256)).to.have.emit(lottery, "LotteryStatusChanged");
            // distribute the prizes in batches
            await lottery.definePrizeWinners(2, 100);
            await lottery.definePrizeWinners(2, 100);
            await lottery.definePrizeWinners(2, 100);
            await lottery.definePrizeWinners(2, 100);
            await lottery.definePrizeWinners(2, 100);
            await lottery.definePrizeWinners(2, 100);
            await lottery.definePrizeWinners(2, 100);
            await lottery.redeemNFT(2);
        });
    });

    it("Should not allow a second RNG request after response received", async function () {
        await rewards.join();
        await waitAndMineBlock(15);
        await lottery.buyTickets(1, 1);
        await lottery.requestRandomNumber(1);
        await mockRng.fulfillRequest(1, 1);
        await expect(lottery.requestRandomNumber(1)).to.be.revertedWith("Lottery must be closed");
    });

    it("Should allow a second RNG request if no response was received", async function () {
        await rewards.join();
        await waitAndMineBlock(15);
        await lottery.buyTickets(1, 1);
        await lottery.requestRandomNumber(1);
        await ethers.provider.send("evm_mine", []);
        await lottery.requestRandomNumber(1);
        expect(await mockRng.fulfillRequest(1, 1)).to.have.emit(lottery, "LotteryStatusChanged");
    });

    it("Should not call requestRandomNumber if not owner", async function () {
        await expect(lottery.connect(addr1).requestRandomNumber(1)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow to boost if boostCost = 0", async function () {
        await rewards.join();
        await waitAndMineBlock(15);
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        await lottery.createNewLottery(15, 0, block.timestamp, block.timestamp + 3600 * 24,
            nft.address, 2,
            0, // boostCost
            0, false);
        await lottery.buyTickets(2, 1);
        await expect(lottery.boostParticipant(2, owner.address,
            { value: ethers.utils.parseEther("1") })).to.be.revertedWith("Can't boost on this lottery");

    });
});

async function waitAndMineBlock(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
}
