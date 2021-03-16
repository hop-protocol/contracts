require('dotenv').config()

import {
  readConfigFile,
  updateConfigFile,
  execScript,
  Logger
} from './shared/utils'
import {
  CHAIN_IDS,
  DEFAULT_H_BRIDGE_TOKEN_NAME,
  DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
  DEFAULT_H_BRIDGE_TOKEN_DECIMALS
} from '../config/constants'

const logger = Logger('deploy')

interface NetworkParams {
  l2_networkName: string
  l1_chainId: string
  l2_chainId: string
  l1_bridgeAddress: string
  l1_canonicalTokenAddress: string
  l1_messengerAddress: string
  l2_canonicalTokenAddress: string
  l2_messengerAddress: string
  l2_hBridgeTokenName: string
  l2_hBridgeTokenSymbol: string
  l2_hBridgeTokenDecimals: number
}

// Example usage:
// $ npm run deploy -- kovan
// $ npm run deploy -- xdai
// $ npm run deploy -- optimism
async function main () {
  logger.log('deploy script initiated')
  const networkName: string = process.argv[2]
  if (!networkName) {
    throw new Error('network name not specified')
  }

  const networkParams: NetworkParams = getNetworkParams(networkName)
  updateConfigFile(networkParams)

  const scripts: string[] = []
  if (networkName === 'kovan') {
    scripts.push(`npm run deploy:l1-kovan`)
  } else {
    validateInputs(networkParams)
    scripts.push(
      `npm run deploy:l2-${networkName}`,
      `npm run setup:l1-kovan`,
      `npm run setup:l2-${networkName}`
    )
  }

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i]
    logger.log(`executing script ${i + 1}/${scripts.length} "${script}"`)
    await execScript(script)
  }

  logger.log('complete')
}

function getNetworkParams (networkName: string): NetworkParams {
  const { l1_bridgeAddress } = readConfigFile()
  switch (networkName) {
    case 'kovan': {
      return {
        l2_networkName: '',
        l1_chainId: CHAIN_IDS.ETHEREUM.KOVAN.toString(),
        l2_chainId: CHAIN_IDS.OPTIMISM.HOP_TESTNET.toString(),
        l1_bridgeAddress: '',
        l1_canonicalTokenAddress: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
        l1_messengerAddress: '0x77eeDe6CC8B46C76e50979Ce3b4163253979c519',
        l2_canonicalTokenAddress: '',
        l2_messengerAddress: '',
        l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS
      }
    }
    case 'optimism': {
      return {
        l2_networkName: networkName,
        l1_chainId: CHAIN_IDS.ETHEREUM.KOVAN.toString(),
        l2_chainId: CHAIN_IDS.OPTIMISM.HOP_TESTNET.toString(),
        l1_bridgeAddress,
        l1_canonicalTokenAddress: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',

        //l1_messengerAddress: '0x77eeDe6CC8B46C76e50979Ce3b4163253979c519',
        l1_messengerAddress: '0xb89065D5eB05Cac554FDB11fC764C679b4202322',

        //l2_canonicalTokenAddress: '0x57eaeE3D9C99b93D8FD1b50EF274579bFEC8e14B',
        l2_canonicalTokenAddress: '0x782e1ec5F7381269b2e5DC4eD58648C60161539b',

        l2_messengerAddress: '0x4200000000000000000000000000000000000007',
        l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS
      }
    }
    case 'arbitrum': {
      return {
        l2_networkName: networkName,
        l1_chainId: CHAIN_IDS.ETHEREUM.KOVAN.toString(),
        l2_chainId: CHAIN_IDS.ARBITRUM.TESTNET_3.toString(),
        l1_bridgeAddress,
        l1_canonicalTokenAddress: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
        l1_messengerAddress: '0xE681857DEfE8b454244e701BA63EfAa078d7eA85',
        l2_canonicalTokenAddress: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
        l2_messengerAddress: '0x0000000000000000000000000000000000000064',
        l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS
      }
    }
    case 'xdai': {
      return {
        l2_networkName: networkName,
        l1_chainId: CHAIN_IDS.ETHEREUM.KOVAN.toString(),
        l2_chainId: CHAIN_IDS.XDAI.SOKOL.toString(),
        l1_bridgeAddress,
        l1_canonicalTokenAddress: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
        l1_messengerAddress: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
        l2_canonicalTokenAddress: '0x714983a8Dc3329bf3BeB8F36b49878CF944E5A3B',
        l2_messengerAddress: '0x40CdfF886715A4012fAD0219D15C98bB149AeF0e',
        l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS
      }
    }
    default: {
      throw new Error(`Unsupported network: ${networkName}`)
    }
  }
}

function validateInputs (inputs: any) {
  if (
    !inputs.l2_networkName ||
    !inputs.l1_chainId ||
    !inputs.l2_chainId ||
    !inputs.l1_bridgeAddress ||
    !inputs.l1_canonicalTokenAddress ||
    !inputs.l1_messengerAddress ||
    !inputs.l2_canonicalTokenAddress ||
    !inputs.l2_messengerAddress ||
    !inputs.l2_hBridgeTokenName ||
    !inputs.l2_hBridgeTokenSymbol ||
    !inputs.l2_hBridgeTokenDecimals
  ) {
    throw new Error('Inputs must be defined')
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    logger.error(error)
    process.exit(1)
  })
