require('dotenv').config()

import { task } from 'hardhat/config'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'

// import '@eth-optimism/plugins/hardhat/compiler'
import "@eth-optimism/hardhat-ovm"

import 'hardhat-abi-exporter'

import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";


import { CHAIN_IDS } from './config/constants'
import { verifyContract } from './scripts/other/verifyContract'

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

task('verify-contract', 'Verify a contract')
  .addParam("chain", "The chain of the contract to verify")
  .addParam("name", "The contract name")
  .addParam("address", "The contract address")
  .addParam("data", "The deployment data")
  .setAction(async (taskArgs, hre) => {
    const { chain, name, address, data } = taskArgs
    await verifyContract(hre, chain, name, address, data)
  })

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
    nova_mainnet: {
      url: process.env.RPC_ENDPOINT_ARBITRUM_NOVA,
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.NOVA.NOVA_MAINNET.toNumber(),
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
    },
    consensys_testnet: {
      url: process.env.RPC_ENDPOINT_CONSENSYS_TESTNET,
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.CONSENSYS.CONSENSYS_TESTNET.toNumber(),
      timeout
    },
    zksync_testnet: {
      url: process.env.RPC_ENDPOINT_ZKSYNC_TESTNET,
      ethNetwork: process.env.RPC_ENDPOINT_GOERLI,
      accounts: desiredAccounts,
      chainId: CHAIN_IDS.ZKSYNC.ZKSYNC_TESTNET.toNumber(),
      timeout,
      zksync: true
    },
  },
  zksolc: {
    version: "1.2.2",
    compilerSource: "binary",
    settings: {},
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
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      goerli: process.env.ETHERSCAN_API_KEY,
      arbitrumOne: process.env.ARBITRUM_API_KEY,
      optimisticEthereum: process.env.OPTIMISM_API_KEY,
      xdai: process.env.XDAI_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
      nova_mainnet: process.env.NOVA_API_KEY,
      consensys_testnet: process.env.CONSENSYS_API_KEY,
      zksync_testnet: process.env.ZKSYNC_API_KEY,
    },
    customChains: [
      {
        network: "xdai",
        chainId: 100,
        urls: {
          apiURL: "https://api.gnosisscan.io/api",
          browserURL: "https://gnosisscan.io"
        }
      },
      {
        network: "optimism_testnet",
        chainId: 420,
        urls: {
          apiURL: "https://api-goerli-optimism.etherscan.io/api",
          browserURL: "https://goerli-optimism.etherscan.io"
        }
      },
      {
        network: "nova_mainnet",
        chainId: 42170,
        urls: {
          apiURL: "https://api-nova.arbiscan.io/api",
          browserURL: "https://nova.arbiscan.io"
        }
      },
      {
        network: "consensys_testnet",
        chainId: 59140,
        urls: {
          apiURL: "https://explorer.goerli.zkevm.consensys.net/api",
          browserURL: "https://explorer.goerli.zkevm.consensys.net"
        }
      },
      {
        network: "zksync_testnet",
        chainId: 280,
        urls: {
          apiURL: "https://goerli.explorer.zksync.io/api",
          browserURL: "https://goerli.explorer.zksync.io/"
        }
      },
    ]
  }
  // abiExporter: {
  //   path: './data/abi',
  //   clear: true,
  //   flat: true
  // }
}
