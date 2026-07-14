require('@nomicfoundation/hardhat-toolbox')
require('dotenv').config()

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY
const accounts = deployerKey ? [deployerKey] : []

module.exports = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 500 },
      metadata: { bytecodeHash: 'ipfs' },
    },
  },
  networks: {
    monadTestnet: {
      url: process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz',
      chainId: 10143,
      accounts,
    },
    monadMainnet: {
      url: process.env.MONAD_MAINNET_RPC_URL || 'https://rpc.monad.xyz',
      chainId: 143,
      accounts,
    },
  },
  sourcify: {
    enabled: true,
    apiUrl: 'https://sourcify-api-monad.blockvision.org',
    browserUrl: 'https://monadvision.com',
  },
  etherscan: {
    enabled: true,
    apiKey: {
      monadMainnet: process.env.ETHERSCAN_API_KEY || '',
      monadTestnet: process.env.ETHERSCAN_API_KEY || '',
    },
    customChains: [
      {
        network: 'monadMainnet',
        chainId: 143,
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api?chainid=143',
          browserURL: 'https://monadscan.com',
        },
      },
      {
        network: 'monadTestnet',
        chainId: 10143,
        urls: {
          apiURL: 'https://api.etherscan.io/v2/api?chainid=10143',
          browserURL: 'https://testnet.monadscan.com',
        },
      },
    ],
  },
}
