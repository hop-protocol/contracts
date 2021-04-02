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
  DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
  COMMON_SYMBOLS
} from '../config/constants'

const logger = Logger('deploy')

interface IGeneralData {
  l2_networkName: string
  l1_chainId: string
  l2_chainId: string
  l1_messengerAddress: string
  l2_tokenBridgeAddress: string
  l2_messengerAddress: string
  l1_tokenBridgeAddress: string

}

interface ISpecificData {
  l1_canonicalTokenAddress: string
  l2_canonicalTokenAddress: string
  l2_hBridgeTokenName: string
  l2_hBridgeTokenSymbol: string
  l2_hBridgeTokenDecimals: number
  l2_swapLpTokenName: string
  l2_swapLpTokenSymbol: string
}

interface INetworkParams extends IGeneralData, ISpecificData {
  l1_bridgeAddress: string
}

// Example usage:
// $ npm run deploy -- kovan DAI
// $ npm run deploy -- xdai USDC
// $ npm run deploy -- optimism sETH
async function main () {
  logger.log('deploy script initiated')
  const networkName: string = process.argv[2]
  const tokenSymbol: string = process.argv[3]

  if (!networkName) {
    throw new Error('network name not specified')
  }

  if (!tokenSymbol) {
    throw new Error('token symbol not specified')
  }

  setNetworkParams(networkName, tokenSymbol)
  const scripts: string[] = []
  if (networkName === 'kovan') {
    scripts.push(`npm run deploy:l1-kovan`)
  } else {
    if (networkName === 'xdai') {
      showL2CanonicalTokenWarning()
    }

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

function setNetworkParams (networkName: string, tokenSymbol: string) {
  const { l1_bridgeAddress } = readConfigFile()
  
  let generalData: IGeneralData
  let specificData: ISpecificData

  const l1CanonicalTokenAddresses = {
    'DAI': '0x436e3FfB93A4763575E5C0F6b3c97D5489E050da',
    'sETH': '0x7EE6109672c07Dcf97435C8238835EFF5D6E89FD',
    'sBTC': '0x7a4f56B0Dd21d730604A266245a0067b97605DAE',
    'USDC': '0x7326510Cf9Ae0397dbBaF37FABba54f0A7b8D100',
    'WBTC': '0x1E1a556D2166A006e662864D376e8DD249087150',
    'TST': '0x943599d17FE82Bb4563b1823500f3267f91Acd2e'
  }

  console.log(networkName, tokenSymbol)
  if (networkName === 'kovan') {
    let l1_canonicalTokenAddress: string = ''
    if (tokenSymbol === COMMON_SYMBOLS.DAI) {
      l1_canonicalTokenAddress = l1CanonicalTokenAddresses.DAI
    } else if (tokenSymbol === COMMON_SYMBOLS.sETH) {
      l1_canonicalTokenAddress = l1CanonicalTokenAddresses.sETH
    } else if (tokenSymbol === COMMON_SYMBOLS.sBTC) {
      l1_canonicalTokenAddress = l1CanonicalTokenAddresses.sBTC
    } else if (tokenSymbol === COMMON_SYMBOLS.USDC) {
      l1_canonicalTokenAddress = l1CanonicalTokenAddresses.USDC
    } else if (tokenSymbol === COMMON_SYMBOLS.WBTC) {
      l1_canonicalTokenAddress = l1CanonicalTokenAddresses.WBTC
    } else if (tokenSymbol === COMMON_SYMBOLS.TST) {
      l1_canonicalTokenAddress = l1CanonicalTokenAddresses.TST
    }

    updateConfigFile({
      l1_chainId: CHAIN_IDS.ETHEREUM.KOVAN.toString(),
      l1_canonicalTokenAddress
    })
    return
  } else if (networkName === 'optimism') {
    generalData = {
      l2_networkName: networkName,
      l1_chainId: CHAIN_IDS.ETHEREUM.KOVAN.toString(),
      l2_chainId: CHAIN_IDS.OPTIMISM.HOP_TESTNET.toString(),
      l1_messengerAddress: '0xb89065D5eB05Cac554FDB11fC764C679b4202322',
      l2_tokenBridgeAddress: '0x4023E9eFcB444Ad6C662075FE5B4570274A2BC2E',
      l2_messengerAddress: '0x4200000000000000000000000000000000000007',
      l1_tokenBridgeAddress: '0xC1e7Be0E1aDD345afB2485aA5E774cD79cBbbBf5'
    }

    if (tokenSymbol === COMMON_SYMBOLS.DAI) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.DAI,
        l2_canonicalTokenAddress: '0x3D1d74D898e29957aDc29Fb3861489899faFAFfd',
        l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop DAI LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-DAI'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.sETH) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sETH,
        l2_canonicalTokenAddress: '0x5C18Cd9D59ca1B587db57838cf9ca8a21e3714AF',
        l2_hBridgeTokenName: 'Synth sETH Hop Token',
        l2_hBridgeTokenSymbol: 'hsETH',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop sETH LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-sETH'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.sBTC) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sBTC,
        l2_canonicalTokenAddress: '0x4beAFb9DfA4842Cf81A26b4e49E3f322616c4Ca5',
        l2_hBridgeTokenName: 'Synth sBTC Hop Token',
        l2_hBridgeTokenSymbol: 'hsBTC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop sBTC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-sBTC'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.USDC) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.USDC,
        l2_canonicalTokenAddress: '0x56836Eec6d4EfCcFBc162C0851007D9F72aD202B',
        l2_hBridgeTokenName: 'USD Coin Hop Token',
        l2_hBridgeTokenSymbol: 'hUSDC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop USDC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-USDC'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.WBTC) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.WBTC,
        l2_canonicalTokenAddress: '0x067ca83e321979E31b06250E05d18a12e4f6A8f1',
        l2_hBridgeTokenName: 'Wrapped BTC Hop Token',
        l2_hBridgeTokenSymbol: 'hWBTC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop WBTC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-WBTC'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.TST) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.TST,
        l2_canonicalTokenAddress: '0x943599d17FE82Bb4563b1823500f3267f91Acd2e',
        l2_hBridgeTokenName: 'Test Coin Hop Token',
        l2_hBridgeTokenSymbol: 'TST',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop TST LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-TST'
      }
    } 
  } else if (networkName === 'arbitrum') {
    generalData = {
      l2_networkName: networkName,
      l1_chainId: CHAIN_IDS.ETHEREUM.KOVAN.toString(),
      l2_chainId: CHAIN_IDS.ARBITRUM.TESTNET_4.toString(),
      l1_messengerAddress: '0x97884F2B6A2AF19C38AA0a15716CF2aC931A3c73',
      l2_tokenBridgeAddress: '0xE49CCf3e19d847f8FF4d6962684A3242abF63f07',
      l2_messengerAddress: '0x0000000000000000000000000000000000000064',
      l1_tokenBridgeAddress: '0x5d4958A5A5C336299445353EAB2b1CD85a331B52'
    }

    if (tokenSymbol === COMMON_SYMBOLS.DAI) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.DAI,
        l2_canonicalTokenAddress: '0xD98Ba848F10697A914a8c007dBCD05fCe2A0b84f',
        l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop DAI LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-DAI'
      }
    }
  } else if (networkName === 'xdai') {
    generalData = {
      l2_networkName: networkName,
      l1_chainId: CHAIN_IDS.ETHEREUM.KOVAN.toString(),
      l2_chainId: CHAIN_IDS.XDAI.SOKOL.toString(),
      l1_messengerAddress: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
      l2_tokenBridgeAddress: '0x40CdfF886715A4012fAD0219D15C98bB149AeF0e',
      l2_messengerAddress: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
      l1_tokenBridgeAddress: '0xA960d095470f7509955d5402e36d9DB984B5C8E2'
    }

    if (tokenSymbol === COMMON_SYMBOLS.DAI) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.DAI,
        l2_canonicalTokenAddress: '0x6D2d8B29d92cab87a273e872FcC4650A64116283',
        l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop DAI LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-DAI'
      }
    } else if (COMMON_SYMBOLS.sETH) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sETH,
        l2_canonicalTokenAddress: '0xeC3B005D2BF47f505F1A0cD68eEb7Ea439D6daF6',
        l2_hBridgeTokenName: 'Synth sETH Hop Token',
        l2_hBridgeTokenSymbol: 'hsETH',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop sETH LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-sETH'
      }
    } else if (COMMON_SYMBOLS.sBTC) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sBTC,
        l2_canonicalTokenAddress: '0x696ED254EC9bD27328d5ef81905042913260eccd',
        l2_hBridgeTokenName: 'Synth sBTC Hop Token',
        l2_hBridgeTokenSymbol: 'hsBTC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop sBTC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-sBTC'
      }
    } else if (COMMON_SYMBOLS.USDC) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.USDC,
        l2_canonicalTokenAddress: '0x452AED3fdB2E83A1352624321629180aB1489Dd0',
        l2_hBridgeTokenName: 'USD Coin Hop Token',
        l2_hBridgeTokenSymbol: 'hUSDC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop USDC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-USDC'
      }
    } else if (COMMON_SYMBOLS.WBTC) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.WBTC,
        l2_canonicalTokenAddress: '0x94490EF228D4aBD189694f86D1684D972431380b',
        l2_hBridgeTokenName: 'Wrapped BTC Hop Token',
        l2_hBridgeTokenSymbol: 'hWBTC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop WBTC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-WBTC'
      }
    } else if (COMMON_SYMBOLS.TST) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.TST,
        l2_canonicalTokenAddress: '0x1a844c99766d67E6031c337E28233Fe2BF773603',
        l2_hBridgeTokenName: 'Test Coin Hop Token',
        l2_hBridgeTokenSymbol: 'TST',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop TST LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-TST'
      }
    }
  }

  const data: INetworkParams = {
    l1_bridgeAddress,
    ...generalData,
    ...specificData
  }
  updateConfigFile(data)
}

function showL2CanonicalTokenWarning() {
  logger.log(
    `
    ********************************************
    * If this is the first time a token is     *
    * being used on L2, you must first         *
    * generate the L2 canonical token address  *
    * by sending tokens across the bridge.     *
    ********************************************
    `
  )
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    logger.error(error)
    process.exit(1)
  })
