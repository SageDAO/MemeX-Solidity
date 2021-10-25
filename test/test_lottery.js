const { expect } = require("chai");
const { ethers } = require("hardhat");
const { Wallet } = require('ethers');
const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256')

const timer = ms => new Promise(res => setTimeout(res, ms));

describe("Lottery Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, addr3, addr4, ...addrs] = await ethers.getSigners();
        artist = addr1;
        Token = await ethers.getContractFactory("MemeXToken");
        token = await Token.deploy("MEMEX", "MemeX", 1, owner.address);
        Rewards = await ethers.getContractFactory('Rewards');
        rewards = await Rewards.deploy();
        Lottery = await ethers.getContractFactory("Lottery");
        lottery = await Lottery.deploy(rewards.address);
        await rewards.setLotteryAddress(lottery.address);
        Nft = await ethers.getContractFactory("MemeXNFT");
        nft = await Nft.deploy("Memex", "MEMEX", owner.address);
        nft.addMinterRole(owner.address);
        // // nft.create(1, 1, 1, owner.address);
        // // nft.create(2, 5000, 1, owner.address);
        await nft.setLotteryContract(lottery.address);
        MockRNG = await ethers.getContractFactory("MockRNG");
        mockRng = await MockRNG.deploy(lottery.address);
        await lottery.setRandomGenerator(mockRng.address);

        // create a new lottery
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        await lottery.createNewLottery(1500000000, 0, block.timestamp, block.timestamp + 86400 * 3,
            nft.address,
            ethers.utils.parseEther("1"), 0, artist.address, "ipfs://path/");
        lottery.addPrizes(1, [1, 2], [1, 100]);

        abiCoder = ethers.utils.defaultAbiCoder;
        leafA = abiCoder.encode(["address", "uint256"], [addr1.address, 1500000000]);
        leafB = abiCoder.encode(["address", "uint256"], [addr2.address, 15000000000]);
        buf2hex = x => '0x' + x.toString('hex');
        leaves = [leafA, leafB].map(leaf => keccak256(leaf));
        tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
        // get the merkle root and store in the contract 
        root = tree.getHexRoot().toString('hex');
        await rewards.setMerkleRoot(root);
        hexproof = tree.getProof(keccak256(leafA)).map(x => buf2hex(x.data))
        hexproofB = tree.getProof(keccak256(leafB)).map(x => buf2hex(x.data))
    });

    it("Should create a lottery game", async function () {
        expect(await lottery.getLotteryCount()).to.equal(1);
    });

    it("Should allow user to buy 1 lottery ticket", async function () {
        await lottery.connect(addr1).claimRewardAndBuyTickets(1, 1, 1500000000, hexproof);
        expect(await lottery.getNumberOfParticipants(1)).to.equal(1);
        expect(await lottery.getTotalEntries(1)).to.equal(1);
    });

    it("Should allow to claim more points if new rewards are published", async function () {
        await lottery.connect(addr1).claimRewardAndBuyTickets(1, 1, 1500000000, hexproof);
        abiCoder = ethers.utils.defaultAbiCoder;
        leafA = abiCoder.encode(["address", "uint256"], [addr1.address, 3000000000]);
        leafB = abiCoder.encode(["address", "uint256"], [addr2.address, 15000000000]);
        buf2hex = x => '0x' + x.toString('hex');
        leaves = [leafA, leafB].map(leaf => keccak256(leaf));
        tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
        // get the merkle root and store in the contract 
        root = tree.getHexRoot().toString('hex');
        await rewards.setMerkleRoot(root);
        hexproof = tree.getProof(keccak256(leafA)).map(x => buf2hex(x.data));
        hexproofB = tree.getProof(keccak256(leafB)).map(x => buf2hex(x.data));
        await lottery.connect(addr1).claimRewardAndBuyTickets(1, 1, 3000000000, hexproof);
    });

    it("Should throw if user doesn't have enough points", async function () {
        await lottery.connect(addr1).claimRewardAndBuyTickets(1, 1, 1500000000, hexproof);
        await expect(lottery.connect(addr1).claimRewardAndBuyTickets(1, 1, 1500000000, hexproof)).to.be.revertedWith("Not enough points to buy tickets");
        await expect(lottery.connect(addr1).buyTickets(1, 1)).to.be.revertedWith("Not enough points to buy tickets");
    });

    it("Should throw if buyting more tickets than maxEntries", async function () {
        await lottery.connect(addr2).claimRewardAndBuyTickets(1, 1, 15000000000, hexproofB);
        await lottery.setMaxEntries(1);
        await expect(lottery.connect(addr2).buyTickets(1, 2)).to.be.revertedWith("Can't buy this amount of tickets");
    });

    it("Should allow user to buy more tickets on a separate transaction", async function () {
        await lottery.connect(addr2).claimRewardAndBuyTickets(1, 1, 15000000000, hexproofB);
        // await lottery.connect(addr2).buyTickets(1, 1);
        await lottery.connect(addr2).claimRewardAndBuyTickets(1, 1, 15000000000, hexproofB);
        expect(await lottery.getNumberOfParticipants(1)).to.equal(1);
        expect(await lottery.getTotalEntries(1)).to.equal(2);
    });


    it("Should let user buy 10 lottery tickets", async function () {
        await lottery.connect(addr2).claimRewardAndBuyTickets(1, 10, 15000000000, hexproofB);
        expect(await lottery.getNumberOfParticipants(1)).to.equal(1);
        expect(await lottery.getTotalEntries(1)).to.equal(10);
    });

    it("Should not let users join when Lottery is full", async function () {
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        await lottery.createNewLottery(0, 0, block.timestamp, block.timestamp + 86400 * 3,
            nft.address,
            ethers.utils.parseEther("1"),
            1, // just one participant allowed
            artist.address, "ipfs://path/"
        );
        await lottery.connect(addr2).claimRewardAndBuyTickets(2, 1, 15000000000, hexproofB);
        // should fail on the second entry
        await expect(lottery.connect(addr2).claimRewardAndBuyTickets(2, 1, 15000000000, hexproofB)).to.be.revertedWith("Lottery is full");
    });

    it("Should allow user to boost", async function () {
        await lottery.connect(addr2).claimRewardAndBuyTickets(1, 1, 15000000000, hexproofB);
        await lottery.boostParticipant(1, addr2.address,
            { value: ethers.utils.parseEther("1") });
        expect(await lottery.getTotalEntries(1)).to.equal(2);
        expect(await lottery.isBooster(1, addr2.address)).to.equal(true);
    });

    it("Should not allow user to buy ticket when lottery is not open", async function () {
        await ethers.provider.send("evm_increaseTime", [86000 * 4]); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await expect(lottery.buyTickets(1, 1)).to.be.revertedWith("Lottery is not open");
    });

    it("Should not allow to boost without sending funds", async function () {
        await lottery.connect(addr2).claimRewardAndBuyTickets(1, 1, 15000000000, hexproofB);
        await expect(lottery.connect(addr2).boostParticipant(1, addr2.address,
            { value: ethers.utils.parseEther("0") })).to.be.reverted;
    });

    it("Should not allow to boost without buying ticket", async function () {
        await expect(lottery.boostParticipant(1, owner.address,
            { value: ethers.utils.parseEther("1") })).to.be.revertedWith("Participant not found");
    });

    it("Should not allow to buy tickets with the wrong lottery id", async function () {
        await expect(lottery.buyTickets(2, 1)).to.be.revertedWith("Lottery is not open");
    });

    it("Should not allow to boost using wrong lottery id", async function () {
        await lottery.connect(addr2).claimRewardAndBuyTickets(1, 1, 15000000000, hexproofB);
        await expect(lottery.boostParticipant(2, addr2.address,
            { value: ethers.utils.parseEther("1") })).to.be.revertedWith("Can't boost on this lottery");
    });

    it("Should run more than one lottery", async function () {
        await lottery.connect(addr2).claimRewardAndBuyTickets(1, 1, 15000000000, hexproofB);
        await lottery.requestRandomNumber(1);
        expect(await mockRng.fulfillRequest(1, 1)).to.have.emit(lottery, "ResponseReceived");
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        // create a second lottery
        await lottery.createNewLottery(1500000000, 0, block.timestamp, block.timestamp + 86400 * 3,
            nft.address,
            ethers.utils.parseEther("1"), 0, artist.address, "ipfs://path/");
        lottery.addPrizes(2, [3, 4], [1, 1]);
        await lottery.connect(addr2).claimRewardAndBuyTickets(2, 1, 15000000000, hexproofB);
        await lottery.requestRandomNumber(2);
        expect(await mockRng.fulfillRequest(2, 1)).to.have.emit(lottery, "ResponseReceived");
        expect(await rewards.getAvailablePoints(addr2.address)).to.equal(12000000000);
    });

    it("Should not allow a second RNG request after response received", async function () {
        await lottery.connect(addr2).claimRewardAndBuyTickets(1, 1, 15000000000, hexproofB);
        await lottery.requestRandomNumber(1);
        await mockRng.fulfillRequest(1, 1);
        await expect(lottery.requestRandomNumber(1)).to.be.revertedWith("Lottery must be closed");
    });

    it("Should allow a second RNG request if no response was received", async function () {
        await lottery.connect(addr2).claimRewardAndBuyTickets(1, 1, 15000000000, hexproofB);
        await lottery.requestRandomNumber(1);
        await ethers.provider.send("evm_mine", []);
        await lottery.requestRandomNumber(1);
        expect(await mockRng.fulfillRequest(1, 1)).to.have.emit(lottery, "LotteryStatusChanged");
    });

    it("Should not call requestRandomNumber if not owner", async function () {
        await expect(lottery.connect(addr1).requestRandomNumber(1)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not call setTicketCostPinas if not owner", async function () {
        await expect(lottery.connect(addr1).setTicketCostPinas(1, 1)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not call cancelLottery if not owner", async function () {
        await expect(lottery.connect(addr1).cancelLottery(1)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not call withdraw if not owner", async function () {
        await expect(lottery.connect(addr1).withdraw(owner.address, 1)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not call setRewardsContract if not owner", async function () {
        await expect(lottery.connect(addr1).setRewardsContract(rewards.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not call changeCloseTime if not owner", async function () {
        await expect(lottery.connect(addr1).changeCloseTime(1, 1)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not call setMerkleRoot if not owner", async function () {
        await expect(lottery.connect(addr1).setMerkleRoot(1, keccak256('some text'))).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not call addPrizes if not owner", async function () {
        await expect(lottery.connect(addr1).addPrizes(1, [1], [1])).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not call createNewLottery if not owner", async function () {
        await expect(lottery.connect(addr1).createNewLottery(1, 1, 1, 1, nft.address, 1, 1, lottery.address, "ipfs string")).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow to boost if boostCost = 0", async function () {
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        await lottery.createNewLottery(1500000000, 0, block.timestamp, block.timestamp + 86400 * 3,
            nft.address,
            0, // boostCost
            0, artist.address, "ipfs://path/");
        await lottery.connect(addr2).claimRewardAndBuyTickets(1, 1, 15000000000, hexproofB);
        await expect(lottery.boostParticipant(2, addr2.address,
            { value: ethers.utils.parseEther("1") })).to.be.revertedWith("Can't boost on this lottery");

    });

    describe("Merkle tree", () => {
        beforeEach(async () => {
            abiCoder = ethers.utils.defaultAbiCoder;
            leafA = abiCoder.encode(["uint256", "address", "uint256"], [1, addr1.address, 1]);
            leafB = abiCoder.encode(["uint256", "address", "uint256"], [1, addr2.address, 2]);
            leafC = abiCoder.encode(["uint256", "address", "uint256"], [1, addr3.address, 3]);
            leafD = abiCoder.encode(["uint256", "address", "uint256"], [1, addr4.address, 4]);
            buf2hex = x => '0x' + x.toString('hex');
            leaves = [leafA, leafB, leafC, leafD].map(leaf => keccak256(leaf));
            tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            // get the merkle root and store in the contract 
            root = tree.getHexRoot().toString('hex');
            await lottery.setMerkleRoot(1, root);
            hexproof = tree.getProof(keccak256(leafA)).map(x => buf2hex(x.data))
        });

        it("Should claim with merkle proof", async function () {
            await lottery.connect(addr1).claimWithProof(1, addr1.address, 1, hexproof);
            expect(await nft.balanceOf(addr1.address, 1)).to.equal(1);
        });

        it("Should throw using third person proof", async function () {
            await expect(lottery.connect(addr2).claimWithProof(1, addr1.address, 1, hexproof)).to.be.revertedWith("Sender is not the winner address");
        });

        it("Should throw trying to claim twice", async function () {
            await lottery.connect(addr1).claimWithProof(1, addr1.address, 1, hexproof);
            await expect(lottery.connect(addr1).claimWithProof(1, addr1.address, 1, hexproof)).to.be.revertedWith("Participant already claimed prize");
        });
    });
});

