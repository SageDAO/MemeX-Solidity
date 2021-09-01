require("@nomiclabs/hardhat-waffle");
require('hardhat-deploy');

const fs = require("fs");

task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

function loadApiKey(file) {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch (err) {
    console.log('Unable to load api key', err);
    return "";
  }
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${loadApiKey('keys.txt')}`,
      accounts: [`55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12312`],
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
