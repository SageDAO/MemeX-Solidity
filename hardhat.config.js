require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-truffle4");

const { alchemy_key, deployer_pk, etherscan_key, ftm_key, ankr_key, account1, account2 } = require('./secrets.json');

const fs = require("fs");
const { count } = require("console");

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
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  networks: {
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${alchemy_key}`,
      accounts: [`${deployer_pk}`, `${account1}`, `${account2}`],
    },
    Fantom: {
      url: `https://apis.ankr.com/${ankr_key}/fantom/full/test`,
      accounts: [`${deployer_pk}`, `${account1}`, `${account2}`],
      chainId: 0xfa2
    },
    hardhat: {
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      timeout: 1800000,
      accounts: {
        count: 200
      }
    }
  }
};
