require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-truffle4");

const { alchemy_key, deployer_pk, etherscan_key, ftm_key, ankr_key, account1, account2 } = require('./secrets.json');

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
  etherscan: {
    apiKey: ftm_key
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
      accounts: [
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12310",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12311",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12312",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12313",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12314",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12315",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12316",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12317",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12318",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12319",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12320",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12321",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12322",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12323",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12324",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12325",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12326",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12327",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12328",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12329",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12330",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12310",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12311",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12312",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12313",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12314",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12315",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12316",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12317",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12318",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12319",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12320",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12321",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12322",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12323",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12324",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12325",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12326",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12327",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12328",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12329",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b8b1aec43912345bc6991e43eb12330",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12310",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12311",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12312",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12313",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12314",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12315",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12316",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12317",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12318",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12319",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12320",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12321",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12322",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12323",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12324",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12325",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12326",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12327",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12328",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12329",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12330",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12310",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12311",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12312",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12313",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12314",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12315",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12316",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12317",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12318",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12319",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12320",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12321",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12322",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12323",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12324",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12325",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12326",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12327",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12328",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12329",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b8b1aec43912345bc6991e43eb12330",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12310",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12311",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12312",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12313",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12314",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12315",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12316",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12317",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12318",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12319",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12320",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12321",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12322",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12323",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12324",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12325",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12326",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12327",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12328",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12329",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12330",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12310",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12311",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12312",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12313",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12314",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12315",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12316",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12317",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12318",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12319",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12320",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12321",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12322",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12323",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12324",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12325",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12326",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12327",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12328",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12329",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d9fe1d9c2ac20be0424b844a2443912345bc6991e43eb12330",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12310",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12311",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12312",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12313",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12314",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12315",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12316",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12317",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12318",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12319",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12320",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12321",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12322",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12323",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12324",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12325",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12326",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12327",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12328",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12329",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "55a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12330",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12310",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12311",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12312",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12313",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12314",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12315",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12316",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12317",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12318",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12319",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12320",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12321",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12322",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12323",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12324",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12325",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12326",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12327",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12328",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12329",
          balance: "1000000000000000000000000000"
        },
        {
          privateKey:
            "44a24ceff28920d944a24c2ac20be0424b844a2443912345bc6991e43eb12330",
          balance: "1000000000000000000000000000"
        },
      ]
    }
  }
};
