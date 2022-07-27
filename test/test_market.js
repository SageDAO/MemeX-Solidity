const { expect } = require("chai");
const { ethers } = require("hardhat");
const keccak256 = require("keccak256");

const uri = "ipfs://aaaa/";

const futureTimestamp = Math.round(new Date().getTime() / 1000) + 10000;
const pastTimestamp = Math.round(new Date().getTime() / 1000) - 10000;

describe("Marketplace Contract", () => {
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

        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20.deploy();
        mockERC20.mint(addr1.address, 1000);
        mockERC20.mint(addr2.address, 1000);

        NftFactory = await ethers.getContractFactory("NFTFactory");
        nftFactory = await NftFactory.deploy(sageStorage.address);
        await nftFactory.createNFTContract(artist.address, "Sage test", "SAGE");
        nftContractAddress = await nftFactory.getContractAddress(
            artist.address
        );
        nft = await ethers.getContractAt("SageNFT", nftContractAddress);

        Marketplace = await ethers.getContractFactory("Marketplace");
        market = await Marketplace.deploy(
            sageStorage.address,
            mockERC20.address
        );
        await sageStorage.setAddress(
            ethers.utils.solidityKeccak256(["string"], ["address.marketplace"]),
            market.address
        );

        _lotteryAddress = addr1.address;
        await sageStorage.setBool(
            ethers.utils.solidityKeccak256(
                ["string", "address"],
                ["role.minter", _lotteryAddress]
            ),
            true
        );
        await sageStorage.setBool(
            ethers.utils.solidityKeccak256(
                ["string", "address"],
                ["role.minter", addr2.address]
            ),
            true
        );
        _id = 1;

        await nft.connect(addr2).safeMint(addr2.address, _id, uri);
    });

    it("Should sell using signed offer", async function() {
        await mockERC20.connect(addr1).approve(market.address, 1000);
        let signedOffer = await addr2.signMessage(
            keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    [
                        "address",
                        "address",
                        "uint256",
                        "uint256",
                        "uint256",
                        "bool"
                    ],
                    [
                        addr2.address,
                        nftContractAddress,
                        100,
                        1,
                        futureTimestamp,
                        true
                    ]
                )
            )
        );
        await market
            .connect(addr1)
            .buyFromSellOffer(
                addr2.address,
                nftContractAddress,
                100,
                1,
                futureTimestamp,
                true,
                signedOffer
            );
        expect(await mockERC20.balanceOf(addr1.address)).to.be.eq(900);
        expect(await mockERC20.balanceOf(nft.address)).to.be.eq(10);
        expect(await mockERC20.balanceOf(addr2.address)).to.be.eq(1090);
    });

    it("Should not reuse sell order", async function() {
        await mockERC20.connect(addr1).approve(market.address, 1000);
        let signedOffer = await addr2.signMessage(
            keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    [
                        "address",
                        "address",
                        "uint256",
                        "uint256",
                        "uint256",
                        "bool"
                    ],
                    [
                        addr2.address, //signer address
                        nftContractAddress, //nft contract address
                        100, //price
                        1, //tokenId
                        futureTimestamp, //expireAt
                        true //isSellOrder
                    ]
                )
            )
        );
        await market
            .connect(addr1)
            .buyFromSellOffer(
                addr2.address,
                nftContractAddress,
                100,
                1,
                futureTimestamp,
                true,
                signedOffer
            );
        await nft.connect(addr1).transferFrom(addr1.address, addr2.address, 1);
        await expect(
            market.connect(addr1).buyFromSellOffer(
                addr2.address, //signer address
                nftContractAddress, //nft contract address
                100, //price
                1, //tokenId
                futureTimestamp, //expireAt
                true, //isSellOrder
                signedOffer
            )
        ).to.be.revertedWith("Offer was cancelled");
    });

    it("Should revert with expired offer", async function() {
        await mockERC20.connect(addr1).approve(market.address, 1000);
        let signedOffer = await addr2.signMessage(
            keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    [
                        "address",
                        "address",
                        "uint256",
                        "uint256",
                        "uint256",
                        "bool"
                    ],
                    [
                        addr2.address,
                        nftContractAddress,
                        100,
                        1,
                        pastTimestamp,
                        true
                    ]
                )
            )
        );
        await expect(
            market
                .connect(addr1)
                .buyFromSellOffer(
                    addr2.address,
                    nftContractAddress,
                    100,
                    1,
                    pastTimestamp,
                    true,
                    signedOffer
                )
        ).to.be.revertedWith("Offer expired");
    });

    it("Should revert buyFromSellOrder if using a buy order", async function() {
        await mockERC20.connect(addr1).approve(market.address, 1000);
        let signedOffer = await addr2.signMessage(
            keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    [
                        "address",
                        "address",
                        "uint256",
                        "uint256",
                        "uint256",
                        "bool"
                    ],
                    [
                        addr2.address,
                        nftContractAddress,
                        100,
                        1,
                        futureTimestamp,
                        false
                    ]
                )
            )
        );
        await expect(
            market
                .connect(addr1)
                .buyFromSellOffer(
                    addr2.address,
                    nftContractAddress,
                    100,
                    1,
                    futureTimestamp,
                    false,
                    signedOffer
                )
        ).to.be.revertedWith("Not a sell order");
    });

    it("Should revert if offer data changed after signing", async function() {
        await mockERC20.connect(addr1).approve(market.address, 1000);
        let signedOffer = await addr2.signMessage(
            keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    [
                        "address",
                        "address",
                        "uint256",
                        "uint256",
                        "uint256",
                        "bool"
                    ],
                    [
                        addr2.address,
                        nftContractAddress,
                        100,
                        1,
                        futureTimestamp,
                        true
                    ]
                )
            )
        );
        await expect(
            market
                .connect(addr1)
                .buyFromSellOffer(
                    addr2.address,
                    nftContractAddress,
                    100,
                    10,
                    futureTimestamp,
                    true,
                    signedOffer
                )
        ).to.be.revertedWith("Invalid signature");
    });
});
