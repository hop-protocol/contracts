require('dotenv').config()

import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'

// import '@eth-optimism/plugins/hardhat/compiler'
import "@eth-optimism/hardhat-ovm"

import 'hardhat-abi-exporter'

import { CHAIN_IDS } from './config/constants'

// Compiler Config
const isOptimizerEnabled: boolean = true
const numOptimizerRuns: number = 50000

// Network Config
// NOTE: Defining an accounts const and using that in the networks config does not work with hardhat
//       so we must use a different name than accounts
const desiredAccounts: string[] = [
  process.env.DEPLOYER_PRIVATE_KEY!,
  process.env.GOVERNANCE_PRIVATE_KEY!
]
const timeout: number = 480e3

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more
export default {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    },
    mainnet: {
      url: process.env.RPC_ENDPOINT_MAINNET,
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.ETHEREUM.MAINNET.toNumber(),
      timeout
    },
    goerli: {
      url: process.env.RPC_ENDPOINT_GOERLI,
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.ETHEREUM.GOERLI.toNumber(),
      timeout
    },
    arbitrum_mainnet: {
      url: process.env.RPC_ENDPOINT_ARBITRUM_MAINNET,
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.ARBITRUM.ARBITRUM_MAINNET.toNumber(),
      timeout
    },
    arbitrum_testnet: {
      url: process.env.RPC_ENDPOINT_ARBITRUM_TESTNET,
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.ARBITRUM.ARBITRUM_TESTNET.toNumber(),
      timeout
    },
    optimism_mainnet: {
      url: process.env.RPC_ENDPOINT_OPTIMISM_MAINNET,
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.OPTIMISM.OPTIMISM_MAINNET.toNumber(),
      timeout
    },
    optimism_testnet: {
      url: process.env.RPC_ENDPOINT_OPTIMISM_TESTNET,
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.OPTIMISM.OPTIMISM_TESTNET.toNumber(),
      timeout
    },
    xdai: {
      url: process.env.RPC_ENDPOINT_XDAI,
      accounts: desiredAccounts,
      gasPrice: 1000000000,
      gas: 500000,
      chainId: CHAIN_IDS.XDAI.XDAI.toNumber(),
      timeout
    },
    polygon: {
      url: process.env.RPC_ENDPOINT_POLYGON,
      accounts: desiredAccounts,
      gasPrice: 1000000000,
      gas: 500000,
      chainId: CHAIN_IDS.POLYGON.POLYGON.toNumber(),
      timeout
    },
    mumbai: {
      url: process.env.RPC_ENDPOINT_MUMBAI,
      accounts: desiredAccounts,
      gasPrice: 1000000000,
      gas: 500000,
      chainId: CHAIN_IDS.POLYGON.MUMBAI.toNumber(),
      timeout
    }
  },
  solidity: {
    compilers: [
      {
        settings: {
          optimizer: {
            enabled: isOptimizerEnabled,
            runs: numOptimizerRuns
          }
        },
        version: '0.8.9'
      },
      {
        settings: {
          optimizer: {
            enabled: isOptimizerEnabled,
            runs: numOptimizerRuns
          }
        },
        version: '0.7.6'
      },
      {
        settings: {
          optimizer: {
            enabled: isOptimizerEnabled,
            runs: numOptimizerRuns
          }
        },
        version: '0.7.3'
      },
      {
        settings: {
          optimizer: {
            enabled: isOptimizerEnabled,
            runs: numOptimizerRuns
          }
        },
        version: '0.7.0'
      },
      {
        settings: {
          optimizer: {
            enabled: isOptimizerEnabled,
            runs: numOptimizerRuns
          }
        },
        version: '0.6.12'
      },
      {
        settings: {
          optimizer: {
            enabled: isOptimizerEnabled,
            runs: numOptimizerRuns
          }
        },
        version: '0.5.17'
      }
    ]
  },
  mocha: {
    timeout: 40000
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
    // apiKey: process.env.POLYGONSCAN_API_KEY
  },
  // abiExporter: {
  //   path: './data/abi',
  //   clear: true,
  //   flat: true
  // }
}
