require('dotenv').config()

import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import "@nomiclabs/hardhat-etherscan";

import '@eth-optimism/plugins/hardhat/compiler'

import 'hardhat-abi-exporter'

import { CHAIN_IDS } from './config/constants'

const desiredAccounts: string[] = [
  process.env.OWNER_PRIVATE_KEY,
  process.env.BONDER_PRIVATE_KEY,
  process.env.LIQUIDITY_PROVIDER_PRIVATE_KEY,
  process.env.USER_PRIVATE_KEY,
  process.env.GOVERNANCE_PRIVATE_KEY
]

const isOptimizerEnabled: boolean = true
const numOptimizerRuns: number = 1

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more
export default {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    },
    kovan: {
      url: 'https://kovan.rpc.hop.exchange',
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.ETHEREUM.KOVAN.toNumber(),
      timeout: 480e3
    },
    goerli: {
      url: 'https://goerli.rpc.hop.exchange',
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.ETHEREUM.GOERLI.toNumber()
    },
    arbitrum: {
      url: 'https://kovan4.arbitrum.io/rpc',
      accounts: desiredAccounts,
      gasPrice: 0,
      chainId: CHAIN_IDS.ARBITRUM.TESTNET_4.toNumber(),
      timeout: 480e3
    },
    optimism: {
      url: 'https://kovan.optimism.io',
      accounts: desiredAccounts,
      gasPrice: 0,
      gas: 9000000,
      chainId: CHAIN_IDS.OPTIMISM.HOP_TESTNET.toNumber(),
      timeout: 480e3
    },
    xdai: {
      url: 'https://sokol.poa.network',
      accounts: desiredAccounts,
      gasPrice: 1000000000,
      gas: 500000,
      chainId: CHAIN_IDS.XDAI.SOKOL.toNumber()
    },
    polygon: {
      url: 'https://rpc-mumbai.matic.today',
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
    apiKey: ""
  }
  // abiExporter: {
  //   path: './data/abi',
  //   clear: true,
  //   flat: true
  // }
}
