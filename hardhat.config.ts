import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@nomiclabs/hardhat-solhint"
import "@nomiclabs/hardhat-ethers"
import "@openzeppelin/hardhat-upgrades"

dotenv.config();


//require("@nomiclabs/hardhat-truffle4");

task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();
  for (const account of accounts) {
    console.log(account.address);
  }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 const config: HardhatUserConfig = { 
  networks: {  
    rinkeby: {
      url: process.env.PROVIDER_URL,
      accounts:
      process.env.DEPLOYER_PK !== undefined ? [process.env.DEPLOYER_PK] : [],
    },
    fantomtestnet: {
      url: process.env.PROVIDER_URL,
      accounts:
      process.env.DEPLOYER_PK !== undefined ? [process.env.DEPLOYER_PK] : [],
      chainId: 0xfa2,
    },
    fantom: {
      url: process.env.PROVIDER_URL,
      accounts:
      process.env.DEPLOYER_PK !== undefined ? [process.env.DEPLOYER_PK] : [],
      chainId: 0xfa,
    },
    hardhat: {
      gas: 12000000,
      allowUnlimitedContractSize: false,
      accounts: {
        count: 100,
      },
    },
    localhost: {
      url: "http://localhost:8545",
    }
  },
  etherscan: {
    apiKey: {
      opera: process.env.FTMSCAN_KEY,
      ftmTestnet: process.env.FTMSCAN_KEY,
      rinkeby: process.env.ETHERSCAN_KEY,
    },
  },
  solidity: {
    version: "0.8.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: `${process.env.COINMARKETCAP_KEY}`,
  },
};

export default config;