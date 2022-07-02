const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { ONE } = require("bignumber/lib/rsa/jsbn");

const MANAGE_POINTS_ROLE = keccak256("MANAGE_POINTS_ROLE");
const MINTER_ROLE = keccak256("MINTER_ROLE");

const ONE_ETH = ethers.utils.parseEther("1");
const TWO_ETH = ethers.utils.parseEther("2");
const THREE_ETH = ethers.utils.parseEther("3");
const FOUR_ETH = ethers.utils.parseEther("4");

describe("Lottery Contract", function() {
    beforeEach(async () => {
        [
            owner,
            addr1,
            addr2,
            addr3,
            addr4,
            ...addrs
        ] = await ethers.getSigners();
        artist = addr1;

        Rewards = await ethers.getContractFactory("Rewards");
        rewards = await upgrades.deployProxy(Rewards, [owner.address], {
            kind: "uups"
        });
        await rewards.deployed();

        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20.deploy();
        mockERC20.mint(addr1.address, 1000);
        mockERC20.mint(addr2.address, 1000);

        Lottery = await ethers.getContractFactory("Lottery");
        lottery = await upgrades.deployProxy(
            Lottery,
            [rewards.address, owner.address, mockERC20.address],
            { kind: "uups" }
        );
        await lottery.deployed();
        await rewards.grantRole(MANAGE_POINTS_ROLE, lottery.address);
        await rewards.grantRole(MANAGE_POINTS_ROLE, owner.address);

        Nft = await ethers.getContractFactory("NFT");
        nft = await upgrades.deployProxy(Nft, ["Sage", "SAGE", owner.address], {
            kind: "uups"
        });
        await nft.grantRole(MINTER_ROLE, lottery.address);

        MockRNG = await ethers.getContractFactory("MockRNG");
        mockRng = await MockRNG.deploy(lottery.address);
        await lottery.setRandomGenerator(mockRng.address);

        Whitelist = await ethers.getContractFactory("Whitelist");
        whitelist = await Whitelist.deploy(owner.address);

        // create a new lottery
        blockNum = await ethers.provider.getBlockNumber();
        block = await ethers.provider.getBlock(blockNum);
        await nft.createCollection(
            1,
            artist.address,
            200,
            "ipfs://path/",
            artist.address
        );
        await nft.createCollection(
            2,
            artist.address,
            200,
            "ipfs://path/collection2",
            artist.address
        );
        await lottery.createLottery(
            1,
            1,
            10,
            0,
            block.timestamp,
            block.timestamp + 86400 * 3,
            nft.address,
            true,
            0,
            0,
            0,
            [1, 2],
            [1, 100]
        );
        await lottery.createLottery(
            2,
            2,
            0,
            1,
            block.timestamp,
            block.timestamp + 86400 * 3,
            nft.address,
            true,
            0,
            0,
            0,
            [1, 2],
            [1, 100]
        );
        lottery.setSignerAddress(owner.address);

        abiCoder = ethers.utils.defaultAbiCoder;
        leafA = keccak256(
            abiCoder.encode(["address", "uint256"], [addr1.address, 150])
        );
        leafB = abiCoder.encode(["address", "uint256"], [addr2.address, 1500]);
        signedMessageA = await owner.signMessage(leafA);
        signedMessageB = await owner.signMessage(keccak256(leafB));
        await mockERC20.connect(addr2).approve(lottery.address, 1000);
        await mockERC20.connect(addr1).approve(lottery.address, 1000);
    });

    it("Should create lotteries", async function() {
        expect(await lottery.getLotteryCount()).to.equal(2);
    });

    it("Should update a lottery", async function() {
        await lottery.updateLottery(
            1,
            5,
            ONE_ETH,
            block.timestamp,
            block.timestamp + 86400 * 3,
            nft.address,
            1,
            2,
            3,
            true
        );
        expect(await lottery.getLotteryCount()).to.equal(2);
        lottery = await lottery.getLotteryInfo(1);
        expect(lottery.status).to.equal(3);
        expect(lottery.startTime).to.equal(block.timestamp);
        expect(lottery.closeTime).to.equal(block.timestamp + 86400 * 3);
        expect(lottery.nftContract).to.equal(nft.address);
        expect(lottery.maxTickets).to.equal(1);
        expect(lottery.defaultPrizeId).to.equal(2);
    });

    it("Should allow users to buy tickets with points", async function() {
        await lottery
            .connect(addr1)
            .buyTicketsWithSignedMessage(150, 1, 1, signedMessageA);
        await lottery
            .connect(addr2)
            .buyTicketsWithSignedMessage(1500, 1, 2, signedMessageB);
        expect(await lottery.getParticipantsCount(1)).to.equal(2);
        expect(await lottery.getLotteryTicketCount(1)).to.equal(3);
    });

    it("Should allow non member to buy tickets with coins", async function() {
        await lottery.connect(addr2).buyTickets(2, 1);
        expect(await lottery.getLotteryTicketCount(2)).to.equal(1);
    });

    it("Should add 100 prizes", async function() {
        prizes = Array(100)
            .fill()
            .map((_, idx) => 10 + idx);
        amounts = Array(100).fill(1);
        await lottery.addPrizes(1, prizes, amounts);
        await lottery.getPrizes(1);
    });

    it("Should remove prize", async function() {
        await lottery.removePrize(1, 0);
        prizes = await lottery.getPrizes(1);
        expect(prizes.length).to.equal(1);
    });

    it("Should allow to claim more points if new rewards are published", async function() {
        await lottery
            .connect(addr1)
            .buyTicketsWithSignedMessage(150, 1, 1, signedMessageA);
        abiCoder = ethers.utils.defaultAbiCoder;
        leafA = abiCoder.encode(["address", "uint256"], [addr1.address, 300]);
        leafB = abiCoder.encode(["address", "uint256"], [addr2.address, 1500]);
        signedMessageA = owner.signMessage(keccak256(leafA));
        signedMessageB = owner.signMessage(keccak256(leafB));
        await lottery
            .connect(addr1)
            .buyTicketsWithSignedMessage(300, 1, 1, signedMessageA);
        expect(await lottery.getLotteryTicketCount(1)).to.equal(2);
    });

    it("Should throw if user doesn't have enough points", async function() {
        await lottery
            .connect(addr1)
            .buyTicketsWithSignedMessage(150, 1, 15, signedMessageA);
        await expect(
            lottery
                .connect(addr1)
                .buyTicketsWithSignedMessage(150, 1, 1, signedMessageA)
        ).to.be.revertedWith("Not enough points");
        await expect(
            lottery.connect(addr1).buyTickets(1, 1)
        ).to.be.revertedWith("Not enough points");
    });

    it("Should throw if buying more tickets than maxEntries", async function() {
        await lottery
            .connect(addr1)
            .buyTicketsWithSignedMessage(150, 1, 1, signedMessageA);
        await lottery.setMaxTicketsPerUser(1, 1);
        await expect(
            lottery.connect(addr1).buyTickets(1, 2)
        ).to.be.revertedWith("Can't buy this amount of tickets");
    });

    it("Should allow user to buy more tickets on a separate transaction", async function() {
        await lottery.connect(addr2).buyTickets(2, 1);
        await lottery.connect(addr2).buyTickets(2, 1);
        expect(await lottery.getParticipantsCount(2)).to.equal(1);
        expect(await lottery.getLotteryTicketCount(2)).to.equal(2);
    });

    it("Should let user buy 10 lottery tickets", async function() {
        await lottery
            .connect(addr2)
            .buyTicketsWithSignedMessage(1500, 1, 10, signedMessageB);
        expect(await lottery.getParticipantsCount(1)).to.equal(1);
        expect(await lottery.getLotteryTicketCount(1)).to.equal(10);
    });

    it("Should not let users buy tickets when lottery sold out", async function() {
        await lottery.setMaxTickets(1, 1);
        await lottery
            .connect(addr2)
            .buyTicketsWithSignedMessage(1500, 1, 1, signedMessageB);
        // should fail on the second entry
        await expect(
            lottery
                .connect(addr2)
                .buyTicketsWithSignedMessage(1500, 1, 1, signedMessageB)
        ).to.be.revertedWith("Tickets sold out");
    });

    it("Should allow withdraw funds from ticket sales", async function() {
        addr2Balance = await mockERC20.balanceOf(addr2.address);
        await lottery.connect(addr2).buyTickets(2, 1);

        await lottery.withdraw(addr2.address, 1);
        expect(await mockERC20.balanceOf(addr2.address)).to.equal(addr2Balance);
    });

    it("Should allow refunds on a refundable lottery", async function() {
        await lottery.connect(addr2).buyTickets(2, 1);
        await lottery.connect(addr1).buyTickets(2, 1);
        await lottery.connect(addr1).buyTickets(2, 1);
        await lottery.updateLottery(
            2,
            10,
            0,
            block.timestamp,
            block.timestamp + 86400 * 3,
            nft.address,
            0,
            0,
            3,
            true
        ); // "force" a lottery completion (status = 3)
        expect(await lottery.connect(addr2).askForRefund(2)).to.have.emit(
            lottery,
            "Refunded"
        );
        expect(await lottery.connect(addr1).askForRefund(2)).to.have.emit(
            lottery,
            "Refunded"
        );
    });

    it("Should get the user refundable balance", async function() {
        await lottery.connect(addr2).buyTickets(2, 1);
        await lottery.connect(addr1).buyTickets(2, 1);
        await lottery.connect(addr1).buyTickets(2, 1);
        await lottery.updateLottery(
            2,
            10,
            TWO_ETH,
            block.timestamp,
            block.timestamp + 86400 * 3,
            nft.address,
            0,
            0,
            3,
            true
        ); // "force" a lottery completion (status = 3)
        expect(
            await lottery
                .connect(addr2)
                .getRefundableCoinBalance(2, addr2.address)
        ).to.equal(1);
        expect(
            await lottery
                .connect(addr1)
                .getRefundableCoinBalance(2, addr1.address)
        ).to.equal(2);
    });

    it("Should return the correct # of tickets bought", async function() {
        await lottery.connect(addr2).buyTickets(2, 1);
        await lottery.connect(addr1).buyTickets(2, 1);
        await lottery.connect(addr1).buyTickets(2, 1);
        expect(
            await lottery.connect(addr2).getTicketCountPerUser(2, addr2.address)
        ).to.equal(1);
        expect(
            await lottery.connect(addr1).getTicketCountPerUser(2, addr1.address)
        ).to.equal(2);
    });

    it("Should revert if asking for a refund before the lottery ends", async function() {
        await expect(lottery.connect(addr2).askForRefund(1)).to.be.revertedWith(
            "Can't ask for a refund on this lottery"
        );
    });

    it("Should revert if asking for a refund twice", async function() {
        await lottery.connect(addr2).buyTickets(2, 1);
        await lottery.updateLottery(
            2,
            10,
            TWO_ETH,
            block.timestamp,
            block.timestamp + 86400 * 3,
            nft.address,
            0,
            0,
            3,
            true
        ); // "force" a lottery completion (status = 3)
        expect(await lottery.connect(addr2).askForRefund(2)).to.have.emit(
            lottery,
            "Refunded"
        );
        await expect(lottery.connect(addr2).askForRefund(2)).to.be.revertedWith(
            "Participant has no refundable tickets"
        );
    });

    it("Should not allow user to buy ticket when lottery is not open", async function() {
        await ethers.provider.send("evm_increaseTime", [86000 * 4]); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await expect(lottery.buyTickets(1, 1)).to.be.revertedWith(
            "Lottery is not open"
        );
    });

    it("Should not allow to buy tickets without token balance", async function() {
        await mockERC20.connect(addr3).approve(lottery.address, 1000);

        await expect(
            lottery.connect(addr3).buyTickets(2, 1)
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Should not allow to buy tickets with the wrong lottery id", async function() {
        await expect(lottery.buyTickets(3, 1)).to.be.revertedWith(
            "Lottery is not open"
        );
    });

    it("Should not allow a second RNG request after response received", async function() {
        await lottery.connect(addr2).buyTickets(2, 1);
        await ethers.provider.send("evm_increaseTime", [86000 * 4]); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await lottery.requestRandomNumber(2);
        await mockRng.fulfillRequest(2, 1);
        await expect(lottery.requestRandomNumber(2)).to.be.revertedWith(
            "Lottery must be closed"
        );
    });

    it("Should allow a second RNG request if no response was received", async function() {
        await lottery.connect(addr2).buyTickets(2, 1);
        await ethers.provider.send("evm_increaseTime", [86000 * 4]); // long wait, enough to be after the end of the lottery
        await ethers.provider.send("evm_mine", []);
        await lottery.requestRandomNumber(2);
        await ethers.provider.send("evm_mine", []);
        await lottery.requestRandomNumber(2);
        expect(await mockRng.fulfillRequest(2, 1)).to.have.emit(
            lottery,
            "LotteryStatusChanged"
        );
    });

    it("Should not call requestRandomNumber if not admin", async function() {
        await expect(
            lottery.connect(addr1).requestRandomNumber(1)
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should not call cancelLottery if not admin", async function() {
        await expect(
            lottery.connect(addr1).cancelLottery(1)
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should not call withdraw if not admin", async function() {
        await expect(
            lottery.connect(addr1).withdraw(owner.address, 1)
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should not call setRewardsContract if not admin", async function() {
        await expect(
            lottery.connect(addr1).setRewardsContract(rewards.address)
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should not call changeCloseTime if not admin", async function() {
        await expect(
            lottery.connect(addr1).changeCloseTime(1, 1)
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should not call setMerkleRoot if not admin", async function() {
        "";
        await expect(
            lottery.connect(addr1).setPrizeMerkleRoot(1, keccak256("some text"))
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should not call addPrizes if not admin", async function() {
        await expect(
            lottery.connect(addr1).addPrizes(1, [1], [1])
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should not call createLottery if not admin", async function() {
        await expect(
            lottery
                .connect(addr1)
                .createLottery(
                    3,
                    1,
                    10,
                    TWO_ETH,
                    block.timestamp,
                    block.timestamp + 86400 * 3,
                    nft.address,
                    true,
                    0,
                    0,
                    0,
                    [1, 2],
                    [1, 100]
                )
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should allow refund points manually", async function() {
        await lottery
            .connect(addr1)
            .buyTicketsWithSignedMessage(150, 1, 1, signedMessageA);
        expect(await rewards.availablePoints(addr1.address)).to.equal(140);
        await rewards.connect(owner).refundPoints(addr1.address, 10);
        expect(await rewards.availablePoints(addr1.address)).to.equal(150);
        await expect(
            rewards.connect(owner).refundPoints(addr1.address, 15)
        ).to.be.revertedWith("Can't refund more points than used");
    });

    describe("Prize merkle tree", () => {
        beforeEach(async () => {
            abiCoder = ethers.utils.defaultAbiCoder;
            leafA = abiCoder.encode(
                ["uint256", "address", "uint256", "uint256"],
                [2, addr1.address, 1, 0]
            );
            leafB = abiCoder.encode(
                ["uint256", "address", "uint256", "uint256"],
                [2, addr2.address, 2, 1]
            );
            leafC = abiCoder.encode(
                ["uint256", "address", "uint256", "uint256"],
                [2, addr1.address, 2, 2]
            );
            buf2hex = x => "0x" + x.toString("hex");
            leaves = [leafA, leafB, leafC].map(leaf => keccak256(leaf));
            tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            // get the merkle root and store in the contract
            root = tree.getHexRoot().toString("hex");
            await lottery.setPrizeMerkleRoot(2, root);
            prizeProofA = tree
                .getProof(keccak256(leafA))
                .map(x => buf2hex(x.data));
            prizeProofB = tree
                .getProof(keccak256(leafB))
                .map(x => buf2hex(x.data));
            prizeProofC = tree
                .getProof(keccak256(leafC))
                .map(x => buf2hex(x.data));
        });

        it("Should retrieve merkle root", async function() {
            expect(await lottery.prizeMerkleRoots(2)).to.equal(root);
        });

        it("Should claim prize with a merkle proof", async function() {
            await lottery.connect(addr1).buyTickets(2, 1);
            await lottery
                .connect(addr1)
                .claimPrize(2, addr1.address, 1, 0, prizeProofA);
            expect(await nft.balanceOf(addr1.address, 1)).to.equal(1);
        });

        it("Should allow to claim more than one prize", async function() {
            await lottery.connect(addr1).buyTickets(2, 1);
            await lottery.connect(addr1).buyTickets(2, 1);
            await lottery.connect(addr2).buyTickets(2, 1);
            expect(await lottery.prizeClaimed(2, 0)).to.equal(false);
            await lottery
                .connect(addr1)
                .claimPrize(2, addr1.address, 1, 0, prizeProofA);
            expect(await lottery.prizeClaimed(2, 0)).to.equal(true);

            expect(await lottery.prizeClaimed(2, 2)).to.equal(false);
            await lottery
                .connect(addr1)
                .claimPrize(2, addr1.address, 2, 2, prizeProofC);
            expect(await lottery.prizeClaimed(2, 2)).to.equal(true);
        });

        it("Should throw trying to claim twice", async function() {
            await lottery.connect(addr1).buyTickets(2, 1);
            await lottery
                .connect(addr1)
                .claimPrize(2, addr1.address, 1, 0, prizeProofA);
            await expect(
                lottery
                    .connect(addr1)
                    .claimPrize(2, addr1.address, 1, 0, prizeProofA)
            ).to.be.revertedWith("Participant already claimed prize");
        });

        it("Should revert if trying to claim a prize after asking for a refund", async function() {
            await lottery.connect(addr1).buyTickets(2, 1);
            await ethers.provider.send("evm_increaseTime", [86000 * 4]); // long wait, enough to be after the end of the lottery
            await ethers.provider.send("evm_mine", []);
            await lottery.requestRandomNumber(2);
            expect(await mockRng.fulfillRequest(2, 1)).to.have.emit(
                lottery,
                "ResponseReceived"
            );
            await lottery.connect(addr1).askForRefund(2);
            await expect(
                lottery
                    .connect(addr1)
                    .claimPrize(2, addr1.address, 1, 0, prizeProofA)
            ).to.be.revertedWith("Participant has requested a refund");
        });

        it("Should allow refund of non winning tickets after claiming prize", async function() {
            expect(await lottery.connect(addr1).buyTickets(2, 1)).to.have.emit(
                lottery,
                "TicketSold"
            );
            expect(await lottery.connect(addr1).buyTickets(2, 1)).to.have.emit(
                lottery,
                "TicketSold"
            );
            await lottery.updateLottery(
                2,
                10,
                TWO_ETH,
                block.timestamp,
                block.timestamp + 86400 * 3,
                nft.address,
                0,
                0,
                3,
                true
            ); // "force" a lottery completion (status = 3)
            await lottery
                .connect(addr1)
                .claimPrize(2, addr1.address, 1, 0, prizeProofA);
            expect(await lottery.connect(addr1).askForRefund(2)).to.have.emit(
                lottery,
                "Refunded"
            );
        });

        it("Should revert if asking for a refund after claiming a prize from a single ticket", async function() {
            await lottery.connect(addr1).buyTickets(2, 1);
            await ethers.provider.send("evm_increaseTime", [86000 * 4]); // long wait, enough to be after the end of the lottery
            await ethers.provider.send("evm_mine", []);
            await lottery.requestRandomNumber(2);
            expect(await mockRng.fulfillRequest(2, 1)).to.have.emit(
                lottery,
                "ResponseReceived"
            );
            await lottery
                .connect(addr1)
                .claimPrize(2, addr1.address, 1, 0, prizeProofA);
            await expect(
                lottery.connect(addr1).askForRefund(2)
            ).to.be.revertedWith("Participant has no refundable tickets");
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
            await expect(
                lottery
                    .connect(addr1)
                    .buyTicketsWithSignedMessage(150, 1, 1, signedMessageA)
            ).to.be.revertedWith("Not whitelisted");
        });

        it("Should revert if not enough balance on whitelisted tokens", async () => {
            await whitelist.addAddress(mockERC20.address, 1001, 1);
            await expect(
                lottery
                    .connect(addr1)
                    .buyTicketsWithSignedMessage(150, 1, 1, signedMessageA)
            ).to.be.revertedWith("Not whitelisted");
        });

        it("Should allow purchase if whitelisted", async () => {
            await whitelist.addAddress(mockERC20.address, 1, 1);
            await expect(
                lottery
                    .connect(addr1)
                    .buyTicketsWithSignedMessage(150, 1, 1, signedMessageA)
            ).to.emit(lottery, "TicketSold");
        });
    });
});
