require('dotenv').config()

import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'

// import '@eth-optimism/plugins/hardhat/compiler'
import "@eth-optimism/hardhat-ovm"

import 'hardhat-abi-exporter'

import { CHAIN_IDS } from './config/constants'

const desiredAccounts: string[] = [
  process.env.DEPLOYER_PRIVATE_KEY,
  process.env.GOVERNANCE_PRIVATE_KEY
]

const isOptimizerEnabled: boolean = true
// 50k for normal, 1 for Optimism
// const numOptimizerRuns: number = 1
const numOptimizerRuns: number = 50000

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
      timeout: 480e3
    },
    kovan: {
      url: process.env.RPC_ENDPOINT_KOVAN,
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.ETHEREUM.KOVAN.toNumber(),
      timeout: 480e3
    },
    goerli: {
      url: process.env.RPC_ENDPOINT_GOERLI,
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.ETHEREUM.GOERLI.toNumber()
    },
    arbitrum_mainnet: {
      url: process.env.RPC_ENDPOINT_ARBITRUM_MAINNET,
      accounts: desiredAccounts,
      gasPrice: 0,
      chainId: CHAIN_IDS.ARBITRUM.ARBITRUM_MAINNET.toNumber(),
      timeout: 480e3
    },
    arbitrum_testnet: {
      url: process.env.RPC_ENDPOINT_ARBITRUM_TESTNET,
      accounts: desiredAccounts,
      gasPrice: 0,
      chainId: CHAIN_IDS.ARBITRUM.ARBITRUM_TESTNET.toNumber(),
      timeout: 480e3
    },
    optimism_mainnet: {
      url: process.env.RPC_ENDPOINT_OPTIMISM_MAINNET,
      accounts: desiredAccounts,
      gasPrice: 15000000,
      // gasPrice: 10000000000,
      chainId: CHAIN_IDS.OPTIMISM.OPTIMISM_MAINNET.toNumber(),
      timeout: 480e3,
      ovm: true
    },
    optimism_testnet: {
      url: process.env.RPC_ENDPOINT_OPTIMISM_TESTNET,
      accounts: desiredAccounts,
      gasPrice: 15000000,
      // gasPrice: 10000000000,
      chainId: CHAIN_IDS.OPTIMISM.OPTIMISM_TESTNET.toNumber(),
      timeout: 480e3,
      ovm: true
    },
    xdai: {
      url: process.env.RPC_ENDPOINT_XDAI,
      accounts: desiredAccounts,
      gasPrice: 1000000000,
      gas: 500000,
      chainId: CHAIN_IDS.XDAI.XDAI.toNumber()
    },
    sokol: {
      url: process.env.RPC_ENDPOINT_SOKOL,
      accounts: desiredAccounts,
      gasPrice: 1000000000,
      gas: 500000,
      chainId: CHAIN_IDS.XDAI.SOKOL.toNumber()
    },
    polygon: {
      url: process.env.RPC_ENDPOINT_POLYGON,
      accounts: desiredAccounts,
      gasPrice: 1000000000,
      gas: 500000,
      chainId: CHAIN_IDS.POLYGON.POLYGON.toNumber()
    },
    mumbai: {
      url: process.env.RPC_ENDPOINT_MUMBAI,
      accounts: desiredAccounts,
      gasPrice: 1000000000,
      gas: 500000,
      chainId: CHAIN_IDS.POLYGON.MUMBAI.toNumber()
    }
  },
  ovm: {
    solcVersion: '0.6.12'
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
        version: '0.6.11'
      },
      {
        settings: {
          optimizer: {
            enabled: isOptimizerEnabled,
            runs: numOptimizerRuns
          }
        },
        version: '0.6.6'
      },
      {
        settings: {
          optimizer: {
            enabled: isOptimizerEnabled,
            runs: numOptimizerRuns
          }
        },
        version: '0.5.17'
      },
      {
        settings: {
          optimizer: {
            enabled: isOptimizerEnabled,
            runs: numOptimizerRuns
          }
        },
        version: '0.5.16'
      },
      {
        settings: {
          optimizer: {
            enabled: isOptimizerEnabled,
            runs: numOptimizerRuns
          }
        },
        version: '0.5.11'
      },
      {
        settings: {
          optimizer: {
            enabled: isOptimizerEnabled,
            runs: numOptimizerRuns
          }
        },
        version: '0.4.25'
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
