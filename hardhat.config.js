require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-truffle4");

const { alchemy_key, deployer_pk, etherscan_key, account1, account2 } = require('./secrets.json');

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
    fantom_testnet: {
      url: `https://apis.ankr.com/${ankr_key}/fantom/full/test`,
      accounts: [`${deployer_pk}`, `${account1}`, `${account2}`],
    },

  },
  etherscan: {
    apiKey: etherscan_key,
  },
  solidity: {
    compilers: [
      {
        version: "0.8.0",
      },
    ],
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
};
