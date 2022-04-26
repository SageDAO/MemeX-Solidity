const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("JuiceBox Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, addr3, addr4, ...addrs] = await ethers.getSigners();
        JuiceBox = await ethers.getContractFactory('JuiceBox');
        juiceBox = await JuiceBox.deploy(owner.address, [1, 2, 3, 4, 5], [2000, 1000, 500, 53, 2]);
    });

    it("Should batch mint all NFTs", async function () {
        expect(await juiceBox.totalSupply(1)).to.equal(2000);
        expect(await juiceBox.totalSupply(2)).to.equal(1000);
        expect(await juiceBox.totalSupply(3)).to.equal(500);
        expect(await juiceBox.totalSupply(4)).to.equal(53);
        expect(await juiceBox.totalSupply(5)).to.equal(2);
    });

    it("Should send NFTs to users", async function () {
        await juiceBox.safeTransferFrom(owner.address, addr1.address, 1, 10, []);
        expect(await juiceBox.balanceOf(addr1.address, 1)).to.equal(10);
        expect(await juiceBox.balanceOf(owner.address, 1)).to.equal(1990);
    });

    it("Should burn tokens to upgrade tiers", async function () {
        await juiceBox.upgradeTier(1, 1);

        expect(await juiceBox.totalSupply(1)).to.equal(1998);
        expect(await juiceBox.totalSupply(2)).to.equal(1001);

        await juiceBox.upgradeTier(2, 1);
        expect(await juiceBox.totalSupply(1)).to.equal(1998);
        expect(await juiceBox.totalSupply(2)).to.equal(999);
        expect(await juiceBox.totalSupply(3)).to.equal(501);

        await juiceBox.upgradeTier(3, 1);
        expect(await juiceBox.totalSupply(1)).to.equal(1998);
        expect(await juiceBox.totalSupply(2)).to.equal(999);
        expect(await juiceBox.totalSupply(3)).to.equal(496);
        expect(await juiceBox.totalSupply(4)).to.equal(54);

        await juiceBox.upgradeTier(4, 1);
        expect(await juiceBox.totalSupply(1)).to.equal(1998);
        expect(await juiceBox.totalSupply(2)).to.equal(999);
        expect(await juiceBox.totalSupply(3)).to.equal(496);
        expect(await juiceBox.totalSupply(4)).to.equal(44);
        expect(await juiceBox.totalSupply(5)).to.equal(3);
    });

    it("Should burn tokens to upgrade tiers for multiple batches", async function () {
        await juiceBox.upgradeTier(1, 10);
        expect(await juiceBox.totalSupply(1)).to.equal(1980);
        expect(await juiceBox.totalSupply(2)).to.equal(1010);
    });

    it("Should throw if trying to upgrade tier and limit is reached", async function () {
        await expect(juiceBox.upgradeTier(1, 1000)).to.be.revertedWith("Tier is full");
    });

    it("Should throw if trying to upgrade passing invalid tier", async function () {
        await expect(juiceBox.upgradeTier(0, 1)).to.be.revertedWith("Invalid tier");
        await expect(juiceBox.upgradeTier(5, 1)).to.be.revertedWith("Invalid tier");
    });

    it("Should throw if trying to upgrade passing invalid number of upgrades", async function () {
        await expect(juiceBox.upgradeTier(1, 0)).to.be.revertedWith("Number of upgrades must be greater than 0");
    });

    it("Should throw if trying to upgrade tiers without owning enough tokens", async function () {
        await expect(juiceBox.upgradeTier(4, 10)).to.be.revertedWith("Not enough tokens to upgrade");
    });

    it("Should set baseURI", async function () {
        await juiceBox.setBaseURI("https://example.com/");
        expect(await juiceBox.baseURI()).to.equal("https://example.com/");
    });

    it("Should get the correct token URI", async function () {
        await juiceBox.setBaseURI("https://example.com/");
        expect(await juiceBox.uri(1)).to.equal("https://example.com/1");
    });

});



