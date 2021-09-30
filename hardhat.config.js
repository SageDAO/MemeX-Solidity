require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-truffle4");
require("hardhat-gas-reporter");
require("@nomiclabs/hardhat-solhint");

const { alchemy_key, deployer_pk, etherscan_key, ftm_key, ankr_key, account1, account2, coinmarketcap_key } = require('./secrets.json');

const fs = require("fs");

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
      url: `https://eth-rinkeby.alchemyapi.io/v2/${alchemy_key}`,
      accounts: [`${deployer_pk}`, `${account1}`, `${account2}`],
    },
    fantomtestnet: {
      url: `https://apis.ankr.com/${ankr_key}/fantom/full/test`,
      accounts: [`${deployer_pk}`, `${account1}`, `${account2}`],
      chainId: 0xfa2
    },
    hardhat: {
      gas: 12000000,
      allowUnlimitedContractSize: true,
      timeout: 1800000,
      accounts: {
        count: 700
      }
    }

  },
  etherscan: {
    apiKey: etherscan_key
  },

  solidity: {
    compilers: [
      {
        version: "0.8.7",
      },
    ],
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
    coinmarketcap: `${coinmarketcap_key}`
  }
};