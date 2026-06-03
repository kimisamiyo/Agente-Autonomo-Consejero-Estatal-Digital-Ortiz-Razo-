require("@nomicfoundation/hardhat-toolbox");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const deployerKey = process.env.CEDIT_MINTER_PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    zktanenbaum: {
      url: process.env.SYSCOIN_RPC_URL || "https://rpc-zk.tanenbaum.io/",
      chainId: Number(process.env.SYSCOIN_CHAIN_ID || 57057),
      accounts: deployerKey ? [deployerKey] : [],
    },
  },
};
