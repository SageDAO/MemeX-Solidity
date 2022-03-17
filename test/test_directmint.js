const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DirectMint Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, artist, ...addrs] = await ethers.getSigners();
        const DirectMint = await ethers.getContractFactory('MemeXDirectMint');
        directMint = await DirectMint.deploy(owner.address);

        const Nft = await ethers.getContractFactory("MemeXNFT");
        nft = await Nft.deploy("Memex", "MEMEX", owner.address);
        await nft.addSmartContractRole(directMint.address);

        await nft.createCollection(1, artist.address, 200, "ipfs://path/", artist.address);
        const ts = parseInt(Date.now() / 1000);
        await directMint.createDirectMint(10, '0x0000000000000000000000000000000000000000', nft.address, ethers.utils.parseEther('0.5'),
            1, ts, ts + 86400, 1, 100);
    });

    it("Should create direct mint", async function () {
        const dm = await directMint.getDirectMint(1);
        expect(dm.limitPerUser).to.equal(10);
        expect(dm.totalTokensMinted).to.equal(0);
        expect(dm.collectionId).to.equal(1);
    });

    it("Should revert if trying to call next token id directly", async function () {
        let error;
        try {
            directMint.nextTokenId(1);
            error = true;
        } catch (err) { }
        if (error) {
            throw new Error("nextTokenId() should not be callable");
        }
    });

    it("Should mint a single token", async function () {
        await directMint.mintBatch(1, 1, { value: ethers.utils.parseEther('0.5') });
        const dm = await directMint.getDirectMint(1);
        expect(dm.totalTokensMinted).to.equal(1);
    });

    it("Should mint multiple tokens", async function () {
        await directMint.mintBatch(1, 10, { value: ethers.utils.parseEther('5') });
        const dm = await directMint.getDirectMint(1);
        expect(dm.totalTokensMinted).to.equal(10);
    });

    it("Should revert if trying to mint without sending funds", async function () {
        expect(directMint.mintBatch(1, 1)).to.be.revertedWith("Didn't transfer enough funds");
    });

    it("Should revert if trying to mint more than the limit", async function () {
        expect(directMint.mintBatch(1, 11)).to.be.revertedWith("Can't mint more than limit");
    });


});

