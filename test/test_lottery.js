const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256');

const MANAGE_POINTS_ROLE = keccak256("MANAGE_POINTS_ROLE");
const MINTER_ROLE = keccak256("MINTER_ROLE");

describe("Lottery Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, addr3, addr4, ...addrs] = await ethers.getSigners();
        artist = addr1;
        Rewards = await ethers.getContractFactory('Rewards');
        rewards = await Rewards.deploy(owner.address);
        Lottery = await ethers.getContractFactory("MemeXLottery");
        lottery = await upgrades.deployProxy(Lottery, [rewards.address, owner.address]);
        await lottery.deployed();
        await rewards.grantRole(MANAGE_POINTS_ROLE, lottery.address);
        await rewards.grantRole(MANAGE_POINTS_ROLE, owner.address);

        Nft = await ethers.getContractFactory("MemeXNFT");
        nft = await Nft.deploy("Memex", "MEMEX", owner.address);
        await nft.grantRole(MINTER_ROLE, lottery.address);

        MockRNG = await ethers.getContractFactory("MockRNG");
        mockRng = await MockRNG.deploy(lottery.address);
        await lottery.setRandomGenerator(mockRng.address);

        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20.deploy();
        mockERC20.transfer(addr1.address, 1000);

        Whitelist = await ethers.getContractFactory("MemeXWhitelist");
        whitelist = await Whitelist.deploy(owner.address);

        // create a new lottery
        blockNum = await ethers.provider.getBlockNumber();
        block = await ethers.provider.getBlock(blockNum);
        await nft.createCollection(1, artist.address, 200, "ipfs://path/", artist.address);
        await nft.createCollection(2, artist.address, 200, "ipfs://path/collection2", artist.address)
        await lottery.createNewLottery(1, 1500000000, 0, block.timestamp, block.timestamp + 86400 * 3,
            nft.address, 0);
        lottery.addPrizes(1, [1, 2], [1, 100]);

        abiCoder = ethers.utils.defaultAbiCoder;
        leafA = abiCoder.encode(["address", "uint256"], [addr1.address, 1500000000]);
        leafB = abiCoder.encode(["address", "uint256"], [addr2.address, 15000000000]);
        buf2hex = x => '0x' + x.toString('hex');
        leaves = [leafA, leafB].map(leaf => keccak256(leaf));
        tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
        // get the merkle root and store in the contract 
        root = tree.getHexRoot().toString('hex');
        await rewards.setPointsMerkleRoot(root);
        hexproof = tree.getProof(keccak256(leafA)).map(x => buf2hex(x.data))
        hexproofB = tree.getProof(keccak256(leafB)).map(x => buf2hex(x.data))
    });

    it("Should create a lottery", async function () {
        expect(await lottery.getLotteryCount()).to.equal(1);
    });

    it("Should update a lottery", async function () {
        await lottery.updateLottery(1, 0, 1000000000000, block.timestamp, block.timestamp + 86400 * 3,
            nft.address,
            1, 2, 3);
        expect(await lottery.getLotteryCount()).to.equal(1);
        lottery = await lottery.getLotteryInfo(1);
        expect(lottery.status).to.equal(3);
        expect(lottery.ticketCostPoints).to.equal(0);
        expect(lottery.ticketCostCoins).to.equal(1000000000000);
        expect(lottery.startTime).to.equal(block.timestamp);
        expect(lottery.closeTime).to.equal(block.timestamp + 86400 * 3);
        expect(lottery.nftContract).to.equal(nft.address);
        expect(lottery.maxParticipants).to.equal(1);
        expect(lottery.defaultPrizeId).to.equal(2);
    });

    it("Should allow user to buy ticket with points", async function () {
        await lottery.connect(addr1).claimPointsAndBuyTickets(1, 1, 1500000000, hexproof);
        await lottery.connect(addr2).claimPointsAndBuyTickets(1, 2, 15000000000, hexproofB);
        expect(await lottery.getParticipantsCount(1)).to.equal(2);
        expect(await lottery.getLotteryTicketCount(1)).to.equal(3);
        lottery = await lottery.getLotteryInfo(1);
        expect(lottery.numTicketsWithPoints).to.equal(3);
    });

    it("Should allow user to buy tickets with coins", async function () {
        await lottery.createNewLottery(1, 0, ethers.utils.parseEther("1"), block.timestamp, block.timestamp + 86400 * 3,
            nft.address, 0);
        await lottery.connect(addr2).buyTickets(1, 1, false,
            { value: ethers.utils.parseEther("1") });
        expect(await lottery.getLotteryTicketCount(1)).to.equal(1);
    });

    it("Should add 100 prizes", async function () {
        await lottery.createNewLottery(1, 0, ethers.utils.parseEther("1"), block.timestamp, block.timestamp + 86400 * 3,
            nft.address, 0);
        prizes = Array(100).fill().map((_, idx) => 10 + idx);
        amounts = Array(100).fill(1);
        await lottery.addPrizes(1, prizes, amounts);
        await lottery.getPrizes(1);
    });

    it("Should remove prize", async function () {
        await lottery.removePrize(1, 0);
        prizes = await lottery.getPrizes(1);
        expect(prizes.length).to.equal(1);
    });

    it("Should allow to claim more points if new rewards are published", async function () {
        await lottery.connect(addr1).claimPointsAndBuyTickets(1, 1, 1500000000, hexproof);
        abiCoder = ethers.utils.defaultAbiCoder;
        leafA = abiCoder.encode(["address", "uint256"], [addr1.address, 3000000000]);
        leafB = abiCoder.encode(["address", "uint256"], [addr2.address, 15000000000]);
        buf2hex = x => '0x' + x.toString('hex');
        leaves = [leafA, leafB].map(leaf => keccak256(leaf));
        tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
        // get the merkle root and store in the contract 
        root = tree.getHexRoot().toString('hex');
        await rewards.setPointsMerkleRoot(root);
        hexproof = tree.getProof(keccak256(leafA)).map(x => buf2hex(x.data));
        hexproofB = tree.getProof(keccak256(leafB)).map(x => buf2hex(x.data));
        await lottery.connect(addr1).claimPointsAndBuyTickets(1, 1, 3000000000, hexproof);
    });

    it("Should throw if user doesn't have enough points", async function () {
        await lottery.connect(addr1).claimPointsAndBuyTickets(1, 1, 1500000000, hexproof);
        await expect(lottery.connect(addr1).claimPointsAndBuyTickets(1, 1, 1500000000, hexproof)).to.be.revertedWith("Not enough points to buy tickets");
        await expect(lottery.connect(addr1).buyTickets(1, 1, true)).to.be.revertedWith("Not enough points to buy tickets");
    });

    it("Should throw if buying more tickets than maxEntries", async function () {
        await lottery.connect(addr2).claimPointsAndBuyTickets(1, 1, 15000000000, hexproofB);
        await lottery.setMaxTicketsPerParticipant(1);
        await expect(lottery.connect(addr2).buyTickets(1, 2, true)).to.be.revertedWith("Can't buy this amount of tickets");
    });

    it("Should allow user to buy more tickets on a separate transaction", async function () {
        await lottery.connect(addr2).claimPointsAndBuyTickets(1, 1, 15000000000, hexproofB);
        // await lottery.connect(addr2).buyTickets(1, 1);
        await lottery.connect(addr2).claimPointsAndBuyTickets(1, 1, 15000000000, hexproofB);
        expect(await lottery.getParticipantsCount(1)).to.equal(1);
        expect(await lottery.getLotteryTicketCount(1)).to.equal(2);
    });


    it("Should let user buy 10 lottery tickets", async function () {
        await lottery.connect(addr2).claimPointsAndBuyTickets(1, 10, 15000000000, hexproofB);
        expect(await lottery.getParticipantsCount(1)).to.equal(1);
        expect(await lottery.getLotteryTicketCount(1)).to.equal(10);
    });

    it("Should not let users join when Lottery is full", async function () {
        await lottery.setMaxParticipants(1, 1);
        await lottery.connect(addr2).claimPointsAndBuyTickets(1, 1, 15000000000, hexproofB);
        // should fail on the second entry
        await expect(lottery.connect(addr2).claimPointsAndBuyTickets(1, 1, 15000000000, hexproofB)).to.be.revertedWith("Lottery is full");
    });

    describe("FTM sales", () => {
        beforeEach(async () => {
            await lottery.createNewLottery(2, 1500000000, ethers.utils.parseEther("1"), block.timestamp, block.timestamp + 86400 * 3,
                nft.address, 0);
            await lottery.connect(addr2).claimPointsAndBuyTickets(2, 1, 15000000000, hexproofB);
            await lottery.connect(addr2).buyTickets(2, 2, false,
                { value: ethers.utils.parseEther("2") });
        });

        it("Should allow user to boost", async function () {
            expect(await lottery.getLotteryTicketCount(2)).to.equal(3);
        });

        it("Should allow withdraw funds from ticket sales", async function () {
            addr2Balance = ethers.BigNumber.from(await ethers.provider.getBalance(addr2.address));
            await lottery.withdraw(2, addr2.address, ethers.utils.parseEther("1"));
            expect(ethers.BigNumber.from(await ethers.provider.getBalance(addr2.address))).to.equal(addr2Balance.add(ethers.utils.parseEther("1")));
        });

        it("Should fail trying to withdraw more funds than lottery collected", async function () {
            await lottery.withdraw(2, addr2.address, ethers.utils.parseEther("1"));
            await lottery.withdraw(2, addr2.address, ethers.utils.parseEther("1"));
            await expect(lottery.withdraw(2, addr2.address, ethers.utils.parseEther("1"))).to.be.revertedWith("Not enough funds");
        });

    });

    it("Should not allow user to buy ticket when lottery is not open", async function () {
        await ethers.provider.send("evm_increaseTime", [86000 * 4]); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await expect(lottery.buyTickets(1, 1, true)).to.be.revertedWith("Lottery is not open");
    });

    it("Should not allow to boost without sending funds", async function () {
        await lottery.createNewLottery(2, 1500000000, ethers.utils.parseEther("1"), block.timestamp, block.timestamp + 86400 * 3,
            nft.address, 0);
        await lottery.connect(addr2).claimPointsAndBuyTickets(2, 1, 15000000000, hexproofB);
        await expect(lottery.connect(addr2).buyTickets(2, 1, false,
            { value: ethers.utils.parseEther("0") })).to.be.revertedWith("Didn't transfer enough funds to buy tickets");
    });

    it("Should not allow to buy tickets with the wrong lottery id", async function () {
        await expect(lottery.buyTickets(2, 1, true)).to.be.revertedWith("Lottery is not open");
    });

    it("Should run more than one lottery", async function () {
        await lottery.connect(addr2).claimPointsAndBuyTickets(1, 1, 15000000000, hexproofB);
        await ethers.provider.send("evm_increaseTime", [86000 * 4]); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await lottery.requestRandomNumber(1);
        expect(await mockRng.fulfillRequest(1, 1)).to.have.emit(lottery, "ResponseReceived");
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        // create a second lottery
        await lottery.createNewLottery(2, 1500000000, 0, block.timestamp, block.timestamp + 86400 * 3,
            nft.address, 0);
        lottery.addPrizes(2, [3, 4], [1, 1]);
        await lottery.connect(addr2).claimPointsAndBuyTickets(2, 1, 15000000000, hexproofB);
        await ethers.provider.send("evm_increaseTime", [86000 * 4]); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await lottery.requestRandomNumber(2);
        expect(await mockRng.fulfillRequest(2, 1)).to.have.emit(lottery, "ResponseReceived");
        expect(await rewards.availablePoints(addr2.address)).to.equal(12000000000);
    });

    it("Should not allow a second RNG request after response received", async function () {
        await lottery.connect(addr2).claimPointsAndBuyTickets(1, 1, 15000000000, hexproofB);
        await ethers.provider.send("evm_increaseTime", [86000 * 4]); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await lottery.requestRandomNumber(1);
        await mockRng.fulfillRequest(1, 1);
        await expect(lottery.requestRandomNumber(1)).to.be.revertedWith("Lottery must be closed");
    });

    it("Should allow a second RNG request if no response was received", async function () {
        await lottery.connect(addr2).claimPointsAndBuyTickets(1, 1, 15000000000, hexproofB);
        await ethers.provider.send("evm_increaseTime", [86000 * 4]); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await lottery.requestRandomNumber(1);
        await ethers.provider.send("evm_mine", []);
        await lottery.requestRandomNumber(1);
        expect(await mockRng.fulfillRequest(1, 1)).to.have.emit(lottery, "LotteryStatusChanged");
    });

    it("Should not call requestRandomNumber if not admin", async function () {
        await expect(lottery.connect(addr1).requestRandomNumber(1)).to.be.revertedWith("Admin calls only");
    });

    it("Should not call cancelLottery if not admin", async function () {
        await expect(lottery.connect(addr1).cancelLottery(1)).to.be.revertedWith("Admin calls only");
    });

    it("Should not call withdraw if not admin", async function () {
        await expect(lottery.connect(addr1).withdraw(1, owner.address, 1)).to.be.revertedWith("Admin calls only");
    });

    it("Should not call setRewardsContract if not admin", async function () {
        await expect(lottery.connect(addr1).setRewardsContract(rewards.address)).to.be.revertedWith("Admin calls only");
    });

    it("Should not call changeCloseTime if not admin", async function () {
        await expect(lottery.connect(addr1).changeCloseTime(1, 1)).to.be.revertedWith("Admin calls only");
    });

    it("Should not call setMerkleRoot if not admin", async function () {
        ''
        await expect(lottery.connect(addr1).setPrizeMerkleRoot(1, keccak256('some text'))).to.be.revertedWith("Admin calls only");
    });

    it("Should not call addPrizes if not admin", async function () {
        await expect(lottery.connect(addr1).addPrizes(1, [1], [1])).to.be.revertedWith("Admin calls only");
    });

    it("Should not call createNewLottery if not admin", async function () {
        await expect(lottery.connect(addr1).createNewLottery(1, 1, 1, 1, 1, nft.address, 0)).to.be.revertedWith("Admin calls only");
    });

    it("Should not allow to boost if boostCost = 0", async function () {
        const blockNum = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNum);
        await lottery.createNewLottery(1, 1500000000, 0, block.timestamp, block.timestamp + 86400 * 3,
            nft.address, 0);
        await lottery.connect(addr2).claimPointsAndBuyTickets(1, 1, 15000000000, hexproofB);
        await expect(lottery.connect(addr2).buyTickets(1, 1, false,
            { value: ethers.utils.parseEther("1") })).to.be.revertedWith("Can't buy tickets with coins");

    });

    it("Should allow refund points manually", async function () {
        await lottery.connect(addr1).claimPointsAndBuyTickets(1, 1, 1500000000, hexproof);
        expect(await rewards.availablePoints(addr1.address)).to.equal(0);
        await rewards.connect(owner).refundPoints(addr1.address, 1500000000);
        expect(await rewards.availablePoints(addr1.address)).to.equal(1500000000);
        await expect(rewards.connect(owner).refundPoints(addr1.address, 1500000000)).to.be.revertedWith("Can't refund more points than used");
    });

    it("Should refund points if lottery is cancelled", async function () {
        await lottery.connect(addr1).claimPointsAndBuyTickets(1, 1, 1500000000, hexproof);
        await lottery.connect(addr2).claimPointsAndBuyTickets(1, 1, 15000000000, hexproofB);
        expect(await rewards.availablePoints(addr1.address)).to.equal(0);
        await lottery.cancelLottery(1);
        expect(await rewards.availablePoints(addr1.address)).to.equal(1500000000);
        expect(await rewards.availablePoints(addr2.address)).to.equal(15000000000);
    });

    describe("Merkle tree", () => {
        beforeEach(async () => {
            abiCoder = ethers.utils.defaultAbiCoder;
            leafA = abiCoder.encode(["uint256", "address", "uint256"], [1, addr1.address, 1]);
            leafB = abiCoder.encode(["uint256", "address", "uint256"], [1, addr2.address, 2]);
            leafC = abiCoder.encode(["uint256", "address", "uint256"], [1, addr3.address, 3]);
            leafD = abiCoder.encode(["uint256", "address", "uint256"], [1, addr4.address, 4]);
            leafE = abiCoder.encode(["uint256", "address", "uint256"], [1, addr1.address, 2]);
            buf2hex = x => '0x' + x.toString('hex');
            leaves = [leafA, leafB, leafC, leafD, leafE].map(leaf => keccak256(leaf));
            tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            // get the merkle root and store in the contract 
            root = tree.getHexRoot().toString('hex');
            await lottery.setPrizeMerkleRoot(1, root);
            hexproof = tree.getProof(keccak256(leafA)).map(x => buf2hex(x.data));
            hexproofE = tree.getProof(keccak256(leafE)).map(x => buf2hex(x.data));
        });

        it("Should retrieve merkle root", async function () {
            expect(await lottery.prizeMerkleRoots(1)).to.equal(root);
        });

        it("Should claim with merkle proof", async function () {
            await lottery.connect(addr1).claimPrize(1, addr1.address, 1, hexproof);
            expect(await nft.balanceOf(addr1.address, 1)).to.equal(1);
        });

        it("Should allow to claim more than one prize", async function () {
            expect(await lottery.prizeClaimed(1, addr1.address)).to.equal(false);
            await lottery.connect(addr1).claimPrize(1, addr1.address, 1, hexproof);
            expect(await lottery.prizeClaimed(1, addr1.address)).to.equal(true);
            expect(await lottery.prizeClaimed(2, addr1.address)).to.equal(false);
            await lottery.connect(addr1).claimPrize(1, addr1.address, 2, hexproofE);
            expect(await lottery.prizeClaimed(2, addr1.address)).to.equal(true);
        });

        it("Should throw trying to claim twice", async function () {
            await lottery.connect(addr1).claimPrize(1, addr1.address, 1, hexproof);
            await expect(lottery.connect(addr1).claimPrize(1, addr1.address, 1, hexproof)).to.be.revertedWith("Participant already claimed prize");
        });
    });

    describe("Whitelist", () => {
        beforeEach(async () => {
            await lottery.setWhitelist(1, whitelist.address);
        });

        it("Should set and get whitelist", async () => {
            expect(await lottery.getWhitelist(1)).to.equal(whitelist.address);
        });

        it("Should revert if not whitelisted", async () => {
            await expect(lottery.connect(addr1).claimPointsAndBuyTickets(1, 1,
                1500000000, hexproof)).to.be.revertedWith("Not whitelisted");
        });

        it("Should revert if not enough balance on whitelisted tokens", async () => {
            await whitelist.addAddress(mockERC20.address, 1001, 1);
            await expect(lottery.connect(addr1).claimPointsAndBuyTickets(1, 1,
                1500000000, hexproof)).to.be.revertedWith("Not whitelisted");
        });

        it("Should allow purchase if whitelisted", async () => {
            await whitelist.addAddress(mockERC20.address, 1, 1);
            await expect(lottery.connect(addr1).claimPointsAndBuyTickets(1, 1,
                1500000000, hexproof)).to.emit(lottery, "NewEntry");
        });
    });
});

