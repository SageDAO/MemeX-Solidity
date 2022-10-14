const { expect } = require("chai");
const { ethers } = require("hardhat");

const uri = "ipfs://aaaa/";

describe("NFT Contract", () => {
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
        sageStorage = await SageStorage.deploy(owner.address);

        NftFactory = await ethers.getContractFactory("NFTFactory");
        nftFactory = await NftFactory.deploy(sageStorage.address);
        await sageStorage.grantAdmin(nftFactory.address);
        await nftFactory.deployByAdmin(artist.address, "Sage test", "SAGE", );

        nftContractAddress = await nftFactory.getContractAddress(
            artist.address
        );
        nft = await ethers.getContractAt("SageNFT", nftContractAddress);
        _lotteryAddress = addr1.address;
        await sageStorage.grantRole(
            ethers.utils.solidityKeccak256(["string"], ["role.minter"]),
            _lotteryAddress
        );
        await sageStorage.grantRole(
            ethers.utils.solidityKeccak256(["string"], ["role.minter"]),
            addr2.address
        );
        _id = 1;

        await nft.connect(addr2).safeMint(addr2.address, uri);
    });

    it("Should increase minter balance", async function() {
        expect(await nft.balanceOf(addr2.address)).to.equal(1);
    });

    it("Should answer correct uri", async function() {
        expect(await nft.tokenURI(_id)).to.equal(uri);
    });

    it("Should be able to burn", async function() {
        expect(await nft.balanceOf(addr2.address)).to.equal(1);
        await nft.connect(addr2).burn(_id);
        expect(await nft.balanceOf(addr2.address)).to.equal(0);
    });

    it("Should not be able to burn other user's NFTs", async function() {
        await expect(nft.connect(addr1).burn(_id)).to.be.reverted;
    });

    it("Should be able to burn any token from authorized SC", async function() {
        await sageStorage.grantRole(
            ethers.utils.solidityKeccak256(["string"], ["role.burner"]),
            addr3.address
        );
        await nft.connect(addr3).burnFromAuthorizedAddress(_id);
    });

    it("Should not be able to burn any token if not authorized SC", async function() {
        await expect(
            nft.connect(addr3).burnFromAuthorizedAddress(_id)
        ).to.be.revertedWith("No burning rights");
    });

    it("Should not mint without minter role", async function() {
        await expect(nft.connect(addr3).safeMint(addr2.address, 1, 1)).to.be
            .reverted;
    });

    it("Should calculate royalties", async function() {
        royaltyInfo = await nft.royaltyInfo(1, 100);
        expect(royaltyInfo[0]).to.equal(nft.address);
        expect(royaltyInfo[1]).to.equal(10);
    });

    it("Should transfer from a to b", async function() {
        await nft.connect(addr2).transferFrom(addr2.address, addr3.address, _id);
        expect(await nft.balanceOf(addr2.address)).to.equal(0);
        expect(await nft.balanceOf(addr3.address)).to.equal(1);
    });

    it("Admin should update metadata", async function() {
        await nft.setTokenURI(1, 'ipfs://newdata');
        expect(await nft.tokenURI(1)).to.equal('ipfs://newdata')
    });

    it("Creator should update metadata", async function() {
        await nft.connect(artist).setTokenURI(1, 'ipfs://newdata');
        expect(await nft.tokenURI(1)).to.equal('ipfs://newdata')
    });

    it("User should not update metadata", async function() {
        await expect(nft.connect(addr2).setTokenURI(1, 'ipfs://newdata')).to.revertedWith('Only creator or admin calls')
    });

    it("Should signal implementation of EIP-2981", async function() {
        const INTERFACE_ID_ERC2981 = 0x2a55205a;

        expect(await nft.supportsInterface(INTERFACE_ID_ERC2981)).to.equal(
            true
        );
    });
});
