require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-truffle4");
require("hardhat-gas-reporter");
require("@nomiclabs/hardhat-solhint");
require('@typechain/hardhat')
require('@nomiclabs/hardhat-ethers')
require('@nomiclabs/hardhat-waffle')
require("dotenv").config();

task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
      accounts: [process.env.DEPLOYER_PK],
    },
    fantomtestnet: {
      url: `https://apis.ankr.com/${process.env.ANKR_KEY_TESTNET}/fantom/full/test`,
      accounts: [process.env.DEPLOYER_PK],
      chainId: 0xfa2
    },
    fantom: {
      url: `https://apis.ankr.com/${process.env.ANKR_KEY}/fantom/full/main`,
      accounts: [process.env.DEPLOYER_PK],
      chainId: 0xfa
    },
    hardhat: {
      gas: 12000000,
      allowUnlimitedContractSize: false,
      timeout: 1800000,
      accounts: {
        count: 100
      }
    }

  },
  etherscan: {
    apiKey: {
      opera: process.env.FTMSCAN_KEY,
      ftmTestnet: process.env.FTMSCAN_KEY,
      rinkeby: process.env.ETHERSCAN_KEY,
    }
  },

  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: `${process.env.COINMARKETCAP_KEY}`
  }
};