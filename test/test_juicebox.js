const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("JuiceBox Contract", function () {
    beforeEach(async () => {
        [owner, addr1, addr2, addr3, addr4, ...addrs] = await ethers.getSigners();
        JuiceBox = await ethers.getContractFactory('JuiceBox');
        juiceBox = await JuiceBox.deploy();
    });

    it("Should batch mint all NFTs", async function () {
        await juiceBox.mintBatch([1, 2, 3, 4, 5], [1500, 1000, 700, 300, 55]);
        expect(await juiceBox.totalSupply(1)).to.equal(1500);
        expect(await juiceBox.totalSupply(2)).to.equal(1000);
        expect(await juiceBox.totalSupply(3)).to.equal(700);
        expect(await juiceBox.totalSupply(4)).to.equal(300);
        expect(await juiceBox.totalSupply(5)).to.equal(55);
    });

    it("Should throw if trying to mint more", async function () {
        //mintBatch(array_of_ids, array_of_amounts)
        await juiceBox.mintBatch([1, 2, 3, 4, 5], [1500, 1000, 700, 300, 55]);
        await expect(juiceBox.mintBatch([1], [1])).to.be.revertedWith("JuiceBox already minted");
    });

    it("Should throw if trying to mint wrong supply", async function () {
        await expect(juiceBox.mintBatch([1, 2, 3, 4], [1500, 1000, 700, 300])).to.be.revertedWith("Total amount of juices must be exactly 3555");
    });

    it("Should burn tokens to upgrade tiers", async function () {
        await juiceBox.mintBatch([1, 2, 3, 4, 5], [3527, 9, 9, 9, 1]);
        await juiceBox.upgradeTier(1);

        expect(await juiceBox.totalSupply(1)).to.equal(3517);
        expect(await juiceBox.totalSupply(2)).to.equal(10);

        await juiceBox.upgradeTier(2);
        expect(await juiceBox.totalSupply(1)).to.equal(3517);
        expect(await juiceBox.totalSupply(2)).to.equal(0);
        expect(await juiceBox.totalSupply(3)).to.equal(10);

        await juiceBox.upgradeTier(3);
        expect(await juiceBox.totalSupply(1)).to.equal(3517);
        expect(await juiceBox.totalSupply(2)).to.equal(0);
        expect(await juiceBox.totalSupply(3)).to.equal(0);
        expect(await juiceBox.totalSupply(4)).to.equal(10);

        await juiceBox.upgradeTier(4);
        expect(await juiceBox.totalSupply(1)).to.equal(3517);
        expect(await juiceBox.totalSupply(2)).to.equal(0);
        expect(await juiceBox.totalSupply(3)).to.equal(0);
        expect(await juiceBox.totalSupply(4)).to.equal(0);
        expect(await juiceBox.totalSupply(5)).to.equal(2);
    });

    it("Should throw if trying to upgrade tier and limit is reached", async function () {
        await juiceBox.mintBatch([1, 2, 3, 4, 5], [1500, 1000, 700, 300, 55]);
        await expect(juiceBox.upgradeTier(1)).to.be.revertedWith("Tier is full");

    });

    it("Should throw if trying to upgrade passing invalid tier", async function () {
        await juiceBox.mintBatch([1, 2, 3, 4, 5], [1500, 1000, 700, 300, 55]);
        await expect(juiceBox.upgradeTier(0)).to.be.revertedWith("Invalid tier");
        await expect(juiceBox.upgradeTier(5)).to.be.revertedWith("Invalid tier");
    });

    it("Should throw if trying to upgrade tiers without owning enough tokens", async function () {
        await juiceBox.mintBatch([1, 2, 3, 4, 5], [1, 2499, 700, 300, 55]);
        await expect(juiceBox.upgradeTier(1)).to.be.revertedWith("Not enough tokens to upgrade");
    });

    it("Should set baseURI", async function () {

    });

});



