CONTRACTS = {
    goerli: {
        marketplaceAddress: "0x76a6e787ab3f2dba23d0C12354e2a0D38e46e0cF",
        storageAddress: "0xF615Ea96BEac2C8f0B3a467474D4c5d89E1CE0Bb",
        factoryAddress: "0xBCD30d26fef05A4AAAC7760A906A3339B10c4D08",
        lotteryAddress: "0x6c6510441018e8b51384891f7560A3BAEfD6c23a",
        randomnessAddress: "0xc1202264727FC40239295C61aa25E6Daacd2A650",
        rewardsAddress: "0x29292dbA15c6DeDb50aFD8B8CaF1C30A74331768", //imp 0x05A45Ee2E54DF5B273394Ac4368e6c3CDa89c5c6
        auctionAddress: "0x0cBa4965C6658d314c1269f76f3d6F96Cd9c56Eb", //imp 0xc827cef79121F5Cf41684C311D7C0C4AaDdDC7c5
        ashAddress: "0x4afD23683118561B39084Cc26BaE966e03033174",
        vrfCoordinator: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
        linkToken: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
        keyHash:
            "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        chainlinkSubscriptionId: 2683
    },
    mainnet: {
        lotteryAddress: "0xf71aaedd6a10dB52D885472747823edDb78f7619",
        storageAddress: "0xF615Ea96BEac2C8f0B3a467474D4c5d89E1CE0Bb",
        factoryAddress: "0x3C3920be49eab5F949f9Fd332E458f1f4F092E8f",
        randomnessAddress: "0x28601963052668f60a0652B649D62f45c7Aa9304",
        rewardsAddress: "0xe15E098CBF9f479Dba9cC7450b59E0e7bf1596B1",
        auctionAddress: "0x857053dd8E42F4f7eB3862ECaE025067013e0def",
        ashAddress: "0x64d91f12ece7362f91a6f8e7940cd55f05060b92",
        linkToken: "0x514910771af9ca656af840dff83e8264ecf986ca",
        vrfCoordinator: "0x271682DEB8C4E0901D1a1550aD2e64D568E69909",
        keyHash: "",
        chainlinkSubscriptionId: 0
    }
};

module.exports = CONTRACTS;
