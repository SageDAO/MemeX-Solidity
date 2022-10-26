CONTRACTS = {
    goerli: {
        marketplaceAddress: "0x11049f4231B8D32403821B8A157325E2B0FB6cab",
        storageAddress: "0xd03ecE827177d7D7ACA0EF6065A605abcAF62d22",
        factoryAddress: "0xfD2126F97519b90B81196373178E0b97AcD0CDC4",
        lotteryAddress: "0xBB8022c7235d456252eC1B40C65DB5F4B7123F2D",
        randomnessAddress: "0xc1202264727FC40239295C61aa25E6Daacd2A650",
        rewardsAddress: "0xC1F9787079a83E444836450b8f3b31A9D5D3cBad", //imp 0x05A45Ee2E54DF5B273394Ac4368e6c3CDa89c5c6
        auctionAddress: "0xC99A4a7a2222fcdc488D15Bda9f9A95D4f59bF0C", //imp 0xc827cef79121F5Cf41684C311D7C0C4AaDdDC7c5
        ashAddress: "0x4afD23683118561B39084Cc26BaE966e03033174",
        vrfCoordinator: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
        linkToken: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
        keyHash:
            "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        chainlinkSubscriptionId: 2683
    },
    mainnet: {
        lotteryAddress: "0xFCCCed6439ab16313B39048019aA50566d6bd72b", //imp 0xbb03246366ffb993a382c2f2e27f582ae1ca2471
        storageAddress: "0xEc620c97C0c2f893e6D86B8C0008B654fA738a9e",
        factoryAddress: "0x12abc7c2Fbe0454EAea59A09873B16a3c85209C6",
        factoryAddress_old: "0x8fCe9aA49BACe6d7f1d906A229450baEa7406dB6",
        randomnessAddress: "0xa148E37DB040fFe7F4e88E99Cfdf444C754176DF",
        rewardsAddress: "0x9faC40CA206b61e48AdC5c440d5dcbCc5F9beE35",
        auctionAddress: "0x78209A2985595ff3128Fc69291b51443f918d636", //imp 0x2fbe2943cb78dc92e6a2a48140bbaf250192a8c8
        ashAddress: "0x64d91f12ece7362f91a6f8e7940cd55f05060b92",
        linkToken: "0x514910771af9ca656af840dff83e8264ecf986ca",
        vrfCoordinator: "0x271682DEB8C4E0901D1a1550aD2e64D568E69909",
        keyHash: "0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e0777be13527e7ef",
        chainlinkSubscriptionId: 478
    }
};

module.exports = CONTRACTS;
