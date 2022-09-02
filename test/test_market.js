const { expect } = require("chai");
const { ethers } = require("hardhat");
const keccak256 = require("keccak256");

const uri = "ipfs://aaaa/";

const futureTimestamp = Math.round(new Date().getTime() / 1000) + 10000000;
const pastTimestamp = Math.round(new Date().getTime() / 1000) - 10000;

describe("Marketplace Contract", () => {
    beforeEach(async () => {
        [
            owner,
            addr1,
            addr2,
            artist2,
            artist,
            ...addrs
        ] = await ethers.getSigners();
        SageStorage = await ethers.getContractFactory("SageStorage");
        sageStorage = await SageStorage.deploy();

        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20.deploy();
        mockERC20.mint(addr1.address, "1000000000000000000");
        mockERC20.mint(addr2.address, "1000000000000000000");

        NftFactory = await ethers.getContractFactory("NFTFactory");
        nftFactory = await NftFactory.deploy(sageStorage.address);
        await sageStorage.setBool(
            ethers.utils.solidityKeccak256(
                ["string", "address"],
                ["role.admin", nftFactory.address]
            ),
            true
        );

        await nftFactory.deployByAdmin(artist.address, "Sage test", "SAGE");
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
        await nft.connect(artist).artistMint(artist.address, _id, uri);
    });

    it("Should sell using signed offer", async function() {
        await mockERC20
            .connect(addr1)
            .approve(market.address, "1000000000000000000");
        let message = keccak256(
            ethers.utils.defaultAbiCoder.encode(
                [
                    "address",
                    "address",
                    "uint256",
                    "uint256",
                    "uint256",
                    "uint256",
                    "bool"
                ],
                [
                    artist.address,
                    nftContractAddress,
                    "1000000000000000000",
                    1,
                    futureTimestamp,
                    1,
                    true
                ]
            )
        );

        let signedOffer = await artist.signMessage(message);
        await market
            .connect(addr1)
            .buyFromSellOffer(
                artist.address,
                nftContractAddress,
                "1000000000000000000",
                1,
                futureTimestamp,
                1,
                signedOffer
            );
        expect(await mockERC20.balanceOf(addr1.address)).to.be.eq(0);
        expect(await mockERC20.balanceOf(nft.address)).to.be.eq(
            "1000000000000000000"
        );
    });

    it("Artist should deploy contract and mint", async function() {
        await sageStorage.setBool(
            ethers.utils.solidityKeccak256(
                ["string", "address"],
                ["role.artist", artist2.address]
            ),
            true
        );
        await nftFactory.connect(artist2).deployByArtist("Artist2", "SAGE");
        let cAddress = await nftFactory.getContractAddress(artist2.address);
        nftContract = await ethers.getContractAt("SageNFT", cAddress);
        await nftContract
            .connect(artist2)
            .artistMint(artist2.address, 1, "test");
    });

    it("Non artist should not deploy contract", async function() {
        await expect(
            nftFactory.connect(artist2).deployByArtist("Artist2", "SAGE")
        ).to.be.reverted;
    });

    it("Should not reuse sell order", async function() {
        await mockERC20.connect(addr1).approve(market.address, 1000);
        let signedOffer = await artist.signMessage(
            keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    [
                        "address",
                        "address",
                        "uint256",
                        "uint256",
                        "uint256",
                        "uint256",
                        "bool"
                    ],
                    [
                        artist.address, //signer address
                        nftContractAddress, //nft contract address
                        100, //price
                        1, //tokenId
                        futureTimestamp, //expireAt
                        1, //chainId
                        true //isSellOrder
                    ]
                )
            )
        );
        await market
            .connect(addr1)
            .buyFromSellOffer(
                artist.address,
                nftContractAddress,
                100,
                1,
                futureTimestamp,
                1,
                signedOffer
            );
        await nft.connect(addr1).transferFrom(addr1.address, artist.address, 1);
        await expect(
            market.connect(addr1).buyFromSellOffer(
                artist.address, //signer address
                nftContractAddress, //nft contract address
                100, //price
                1, //tokenId
                futureTimestamp, //expireAt
                1, // chainId
                signedOffer
            )
        ).to.be.revertedWith("Offer was cancelled");
    });

    it("Should revert with expired offer", async function() {
        await mockERC20.connect(addr1).approve(market.address, 1000);
        let signedOffer = await artist.signMessage(
            keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    [
                        "address",
                        "address",
                        "uint256",
                        "uint256",
                        "uint256",
                        "uint256",
                        "bool"
                    ],
                    [
                        artist.address,
                        nftContractAddress,
                        100,
                        1,
                        pastTimestamp,
                        1,
                        true
                    ]
                )
            )
        );
        await expect(
            market
                .connect(addr1)
                .buyFromSellOffer(
                    artist.address,
                    nftContractAddress,
                    100,
                    1,
                    pastTimestamp,
                    1,
                    signedOffer
                )
        ).to.be.revertedWith("Offer expired");
    });

    it("Should revert buyFromSellOrder if using a buy order", async function() {
        await mockERC20.connect(addr1).approve(market.address, 1000);
        let signedOffer = await artist.signMessage(
            keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    [
                        "address",
                        "address",
                        "uint256",
                        "uint256",
                        "uint256",
                        "uint256",
                        "bool"
                    ],
                    [
                        artist.address,
                        nftContractAddress,
                        100,
                        1,
                        futureTimestamp,
                        1,
                        false
                    ]
                )
            )
        );
        await expect(
            market
                .connect(addr1)
                .buyFromSellOffer(
                    artist.address,
                    nftContractAddress,
                    100,
                    1,
                    futureTimestamp,
                    1,
                    signedOffer
                )
        ).to.be.revertedWith("Invalid signature");
    });

    it("Should revert if offer data changed after signing", async function() {
        await mockERC20.connect(addr1).approve(market.address, 1000);
        let signedOffer = await artist.signMessage(
            keccak256(
                ethers.utils.defaultAbiCoder.encode(
                    [
                        "address",
                        "address",
                        "uint256",
                        "uint256",
                        "uint256",
                        "uint256",
                        "bool"
                    ],
                    [
                        artist.address,
                        nftContractAddress,
                        100,
                        1,
                        futureTimestamp,
                        1,
                        true
                    ]
                )
            )
        );
        await expect(
            market
                .connect(addr1)
                .buyFromSellOffer(
                    artist.address,
                    nftContractAddress,
                    100,
                    10,
                    futureTimestamp,
                    1,
                    signedOffer
                )
        ).to.be.revertedWith("Invalid signature");
    });
});
