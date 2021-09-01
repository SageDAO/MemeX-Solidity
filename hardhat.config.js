require("@nomiclabs/hardhat-waffle");
require('hardhat-deploy');
const { alchemy_key, deployer_pk } = require('./secrets.json');

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
      accounts: [`${deployer_pk}`],
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.0",
      },
      {
        version: "0.6.12",
        settings: {},
      },
    ],
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
};
