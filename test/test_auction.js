const { expect } = require("chai");
const { ethers } = require("hardhat");
const keccak256 = require("keccak256");
const MINTER_ROLE = keccak256("MINTER_ROLE");

describe("Auction Contract", function() {
    beforeEach(async () => {
        [
            owner,
            addr1,
            addr2,
            addr3,
            artist,
            ...addrs
        ] = await ethers.getSigners();

        SageStorage = await ethers.getContractFactory("SageStorage");
        sageStorage = await SageStorage.deploy();

        NftFactory = await ethers.getContractFactory("NFTFactory");
        nftFactory = await NftFactory.deploy(sageStorage.address);
        await nftFactory.createNFTContract(artist.address, "Sage test", "SAGE");
        nftContractAddress = await nftFactory.getContractAddress(
            artist.address
        );
        nft = await ethers.getContractAt("SageNFT", nftContractAddress);

        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20.deploy();
        mockERC20.transfer(addr1.address, 1000);
        mockERC20.transfer(addr2.address, 2000);
        mockERC20.transfer(addr3.address, 1000);

        Auction = await ethers.getContractFactory("Auction");
        auction = await upgrades.deployProxy(
            Auction,
            [owner.address, 3600, 100, mockERC20.address, sageStorage.address],
            { kind: "uups" }
        );

        await sageStorage.setBool(
            ethers.utils.solidityKeccak256(
                ["string", "address"],
                ["role.minter", auction.address]
            ),
            true
        );

        // ContractBidder = await ethers.getContractFactory('MockAuctionBidder');
        // contractBidder = await ContractBidder.deploy(auction.address);

        //await nft.grantRole(MINTER_ROLE, auction.address);

        await auction.createAuction(
            1,
            1,
            2,
            parseInt(Date.now() / 1000),
            0,
            nft.address,
            "ipfs://aaaaa"
        );
        await auction.createAuction(
            2,
            2,
            2,
            parseInt(Date.now() / 1000),
            parseInt(Date.now() / 1000) + 2 * 86400,
            nft.address,
            "ipfs://bbbb"
        );
    });

    it("Should create auction - ERC20", async function() {
        let resp = await auction.getAuction(2);
        expect(resp.startTime).to.be.greaterThan(0);
        await expect(
            auction.createAuction(
                3,
                1,
                2,
                parseInt(Date.now() / 1000),
                parseInt(Date.now() / 1000) + 86400,
                nft.address,
                "ipfs://cccc"
            )
        ).to.emit(auction, "AuctionCreated");
        await expect(
            auction.createAuction(
                4,
                1,
                2,
                parseInt(Date.now() / 1000),
                0,
                nft.address,
                "ipfs://dddd"
            )
        ).to.emit(auction, "AuctionCreated");
    });

    it("Should cancel auction", async function() {
        await expect(auction.cancelAuction(1)).to.emit(
            auction,
            "AuctionCancelled"
        );
    });

    it("Should allow ERC20 bids", async function() {
        await mockERC20.connect(addr1).approve(auction.address, 2);
        await auction.connect(addr1).bid(2, 2);
        expect(await mockERC20.balanceOf(auction.address)).to.equal(2);
        expect(await mockERC20.balanceOf(addr1.address)).to.equal(998);
        let resp = await auction.getAuction(2);
        expect(resp.highestBid).to.equal(2);
        expect(resp.highestBidder).to.equal(addr1.address);
    });

    it("Should revert if bid lower than higest bid increment", async function() {
        await auction.createAuction(
            4,
            1,
            0,
            parseInt(Date.now() / 1000),
            parseInt(Date.now() / 1000) + 3 * 86400,
            nft.address,
            "ipfs://dddd"
        );
        await mockERC20.connect(addr2).approve(auction.address, 10000);
        await auction.connect(addr2).bid(4, 200);
        await expect(auction.connect(addr2).bid(4, 201)).to.be.revertedWith(
            "Bid is lower than highest bid increment"
        );
        await expect(auction.connect(addr2).bid(4, 210)).to.emit(
            auction,
            "BidPlaced"
        );
    });

    it("Should revert if bid lower than mininum - ERC20", async function() {
        await mockERC20.approve(auction.address, 1);
        await expect(auction.connect(addr2).bid(2, 1)).to.be.revertedWith(
            "Bid is lower than minimum"
        );
    });

    it("Should revert if bid = 0", async function() {
        await auction.createAuction(
            3,
            1,
            0,
            parseInt(Date.now() / 1000),
            parseInt(Date.now() / 1000) + 86400,
            nft.address,
            "ipfs://cccc"
        );
        await expect(auction.connect(addr2).bid(3, 0)).to.be.revertedWith(
            "Bid is lower than minimum"
        );
    });

    it("Should revert if calling create not being admin", async function() {
        await expect(
            auction
                .connect(addr1)
                .createAuction(
                    3,
                    1,
                    2,
                    parseInt(Date.now() / 1000),
                    parseInt(Date.now() / 1000) + 86400,
                    nft.address,
                    "ipfs://aaaaa"
                )
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should revert if calling cancel not being admin", async function() {
        await expect(
            auction.connect(addr1).cancelAuction(1)
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should revert if calling update not being admin", async function() {
        await expect(
            auction.connect(addr1).updateAuction(1, 3, 0)
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should revert if calling setDefaultTimeExtension not being admin", async function() {
        await expect(
            auction.connect(addr1).setDefaultTimeExtension(1)
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should revert if calling setBidIncrement not being admin", async function() {
        await expect(
            auction.connect(addr1).setBidIncrementPercentage(1)
        ).to.be.revertedWith("Admin calls only");
    });

    it("Should set a new default time extension", async function() {
        await auction.setDefaultTimeExtension(60);
        expect(await auction.getDefaultTimeExtension()).to.equal(60);
    });

    it("Should set a new bidIncrementPercentage", async function() {
        await auction.setBidIncrementPercentage(200);
        expect(await auction.getBidIncrementPercentage()).to.equal(200);
    });

    it("Should revert if bid lower than highest bid - ERC20", async function() {
        await mockERC20.connect(addr1).approve(auction.address, 2);
        await mockERC20.connect(addr2).approve(auction.address, 3);
        await auction.connect(addr2).bid(2, 3);
        await expect(auction.connect(addr1).bid(2, 2)).to.be.revertedWith(
            "Bid is lower than highest bid"
        );
    });

    it("Should revert if trying to bid on a settled auction", async function() {
        await auction.cancelAuction(1);
        await expect(auction.connect(addr2).bid(1, 2)).to.be.revertedWith(
            "Auction already settled"
        );
    });

    it("Should reverse last bid - ERC20", async function() {
        await mockERC20.connect(addr1).approve(auction.address, 2);
        await mockERC20.connect(addr2).approve(auction.address, 3);
        await auction.connect(addr1).bid(2, 2);
        await auction.connect(addr2).bid(2, 3);
        expect(await mockERC20.balanceOf(auction.address)).to.equal(3);
        expect(await mockERC20.balanceOf(addr1.address)).to.equal(1000);
        expect(await mockERC20.balanceOf(addr2.address)).to.equal(1997);
    });

    it("Should revert if trying to settle auction before the end", async function() {
        await expect(auction.settleAuction(1)).to.be.revertedWith(
            "Auction is still running"
        );
    });

    it("Should revert if trying to settle auction already finished", async function() {
        await auction.cancelAuction(1);
        await expect(auction.settleAuction(1)).to.be.revertedWith(
            "Auction already settled"
        );
    });

    it("Should settle auction - ERC20", async function() {
        ercBalance = await mockERC20.balanceOf(nft.address);
        await mockERC20.connect(addr2).approve(auction.address, 2);
        await auction.connect(addr2).bid(2, 2);
        await ethers.provider.send("evm_increaseTime", [2 * 86401]);
        await auction.settleAuction(2);
        expect(await nft.tokenURI(2)).to.be.equal("ipfs://bbbb");
        balance = await nft.balanceOf(addr2.address);
        expect(balance).to.equal(1);
        expect(await mockERC20.balanceOf(nft.address)).to.equal(
            ercBalance.add(2)
        );
    });

    it("Should allow late bids when no endTime was set", async function() {
        await mockERC20.connect(addr1).approve(auction.address, 4);
        await ethers.provider.send("evm_increaseTime", [30 * 86400]);
        await auction.connect(addr1).bid(1, 2);
        expect(await mockERC20.balanceOf(auction.address)).to.equal(2);
        expect(await mockERC20.balanceOf(addr1.address)).to.equal(998);
        let resp = await auction.getAuction(1);
        expect(resp.highestBid).to.equal(2);
        expect(resp.highestBidder).to.equal(addr1.address);
        await ethers.provider.send("evm_increaseTime", [86401]);
        await expect(auction.connect(addr1).bid(1, 2)).to.be.revertedWith(
            "Auction has ended"
        );
    });
});
