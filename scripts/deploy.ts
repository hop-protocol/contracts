require('dotenv').config()

import { BigNumber } from 'ethers'
import {
  readConfigFile,
  updateConfigFile,
  execScript,
  Logger,
  getL1ChainIdFromNetworkName
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
// $ npm run deploy -- kovan xdai DAI
// $ npm run deploy -- goerli xdai USDC
// $ npm run deploy -- goerli optimism USDC

// In order to run just the L1 bridge deployment, use `x` as the L2 name
// $ npm run deploy -- goerli x USDC 

// In order to run just the L1 bridge deployment for polygon, use `xpolygon` as the L2 name
// NOTE: This will deploy the messenger wrapper / messenger
// $ npm run deploy -- goerli xpolygon USDC 
async function main () {
  logger.log('deploy script initiated')
  const l1NetworkName: string = process.argv[2].toLowerCase()
  const l2NetworkName: string = process.argv[3].toLowerCase()
  const tokenSymbol: string = process.argv[4].toLowerCase()

  if (!l1NetworkName) {
    throw new Error('L1 network name not specified')
  }

  if (!l2NetworkName) {
    throw new Error('L2 network name not specified')
  }

  if (!tokenSymbol) {
    throw new Error('Token symbol not specified')
  }

  setNetworkParams(l1NetworkName, l2NetworkName,tokenSymbol)
  const scripts: string[] = []
  if (l2NetworkName === 'x' || l2NetworkName === 'xpolygon') {
    scripts.push(`npm run deploy:l1-${l1NetworkName}`)
  } else {
    scripts.push(
      `npm run deploy:l2-${l2NetworkName}`,
      `npm run setup:l1-${l1NetworkName}`,
      `npm run setup:l2-${l2NetworkName}`
    )
  }

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i]
    logger.log(`executing script ${i + 1}/${scripts.length} "${script}"`)
    await execScript(script)
  }

  logger.log('complete')
}

function setNetworkParams (l1NetworkName: string, l2NetworkName: string, tokenSymbol: string) {
  const { l1_bridgeAddress } = readConfigFile()
  
  let generalData: IGeneralData
  let specificData: ISpecificData

  const l1ChainId: BigNumber = getL1ChainIdFromNetworkName(l1NetworkName) 

  let l1CanonicalTokenAddresses: { [key: string]: string }
  if (l1NetworkName === 'kovan') {
    l1CanonicalTokenAddresses = {
      'DAI': '0x436e3FfB93A4763575E5C0F6b3c97D5489E050da',
      'sETH': '0x7EE6109672c07Dcf97435C8238835EFF5D6E89FD',
      'sBTC': '0x7a4f56B0Dd21d730604A266245a0067b97605DAE',
      'USDC': '0x7326510Cf9Ae0397dbBaF37FABba54f0A7b8D100',
      'WBTC': '0x1E1a556D2166A006e662864D376e8DD249087150',
      'TST': '0x943599d17FE82Bb4563b1823500f3267f91Acd2e'
    }
  } else if (l1NetworkName === 'goerli') {
    l1CanonicalTokenAddresses = {
      'DAI': '0xC61bA16e864eFbd06a9fe30Aab39D18B8F63710a',
      'sETH': '0x5D13179c5fa40b87D53Ff67ca26245D3D5B2F872',
      'sBTC': '0x12a3a66720dD925fa93f7C895bC20Ca9560AdFe7',
      'USDC': '0x2C2Ab81Cf235e86374468b387e241DF22459A265',
      'WBTC': '0xCB784a097f33231f2D3a1E22B236a9D2c878555d',
      'TST': '0x72BC29409f4F8a29284285b7af4f3D59d206d454'
    }
  }

  // TODO: Handle this better
  if (l2NetworkName === 'x' || l2NetworkName === 'xpolygon') {
    let l2ChainId: BigNumber

    // Define the L2 chain ID
    if (l2NetworkName === 'xpolygon' && l1NetworkName === 'goerli') {
      l2ChainId = CHAIN_IDS.POLYGON.MUMBAI
    } else if (l2NetworkName === 'xpolygon' && l1NetworkName === 'mainnet') {
      l2ChainId = CHAIN_IDS.POLYGON.MAINNET
    }

    // Define the token addresses
    let l1_canonicalTokenAddress: string = ''
    if (tokenSymbol === COMMON_SYMBOLS.DAI.toLowerCase()) {
      l1_canonicalTokenAddress = l1CanonicalTokenAddresses.DAI
    } else if (tokenSymbol === COMMON_SYMBOLS.sETH.toLowerCase()) {
      l1_canonicalTokenAddress = l1CanonicalTokenAddresses.sETH
    } else if (tokenSymbol === COMMON_SYMBOLS.sBTC.toLowerCase()) {
      l1_canonicalTokenAddress = l1CanonicalTokenAddresses.sBTC
    } else if (tokenSymbol === COMMON_SYMBOLS.USDC.toLowerCase()) {
      l1_canonicalTokenAddress = l1CanonicalTokenAddresses.USDC
    } else if (tokenSymbol === COMMON_SYMBOLS.WBTC.toLowerCase()) {
      l1_canonicalTokenAddress = l1CanonicalTokenAddresses.WBTC
    } else if (tokenSymbol === COMMON_SYMBOLS.TST.toLowerCase()) {
      l1_canonicalTokenAddress = l1CanonicalTokenAddresses.TST
    }

    updateConfigFile({
      l1_chainId: l1ChainId.toString(),
      l2_chainId: l2ChainId.toString(),
      l1_canonicalTokenAddress
    })
    return
  } else if (l2NetworkName === 'optimism') {
    generalData = {
      l2_networkName: l2NetworkName,
      l1_chainId: l1ChainId.toString(),
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
  } else if (l2NetworkName === 'arbitrum') {
    generalData = {
      l2_networkName: l2NetworkName,
      l1_chainId: l1ChainId.toString(),
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
  } else if (l2NetworkName === 'xdai') {
    generalData = {
      l2_networkName: l2NetworkName,
      l1_chainId: l1ChainId.toString(),
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
    } else if (tokenSymbol === COMMON_SYMBOLS.sETH) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sETH,
        l2_canonicalTokenAddress: '0xeC3B005D2BF47f505F1A0cD68eEb7Ea439D6daF6',
        l2_hBridgeTokenName: 'Synth sETH Hop Token',
        l2_hBridgeTokenSymbol: 'hsETH',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop sETH LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-sETH'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.sBTC) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sBTC,
        l2_canonicalTokenAddress: '0x696ED254EC9bD27328d5ef81905042913260eccd',
        l2_hBridgeTokenName: 'Synth sBTC Hop Token',
        l2_hBridgeTokenSymbol: 'hsBTC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop sBTC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-sBTC'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.USDC) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.USDC,
        l2_canonicalTokenAddress: '0x452AED3fdB2E83A1352624321629180aB1489Dd0',
        l2_hBridgeTokenName: 'USD Coin Hop Token',
        l2_hBridgeTokenSymbol: 'hUSDC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop USDC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-USDC'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.WBTC) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.WBTC,
        l2_canonicalTokenAddress: '0x94490EF228D4aBD189694f86D1684D972431380b',
        l2_hBridgeTokenName: 'Wrapped BTC Hop Token',
        l2_hBridgeTokenSymbol: 'hWBTC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop WBTC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-WBTC'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.TST) {
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
  } else if (l2NetworkName === 'polygon') {
    generalData = {
      l2_networkName: l2NetworkName,
      l1_chainId: l1ChainId.toString(),
      l2_chainId: CHAIN_IDS.POLYGON.MUMBAI.toString(),
      // For Polygon, this is the messenger wrapper. This is handled during the deployment scripts
      l1_messengerAddress: '0x',
      // For Polygon, this is unused
      l2_tokenBridgeAddress: '0x',
      // For Polygon, this is the messenger proxy. This is handled during the deployment scripts.
      l2_messengerAddress: '0x',
      l1_tokenBridgeAddress: '0x57823134bc226b2335CA2E6D03c8E59a8314b2A9'
    }

    if (tokenSymbol === COMMON_SYMBOLS.DAI) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.DAI,
        l2_canonicalTokenAddress: '0xb224913CE3851b0a0d7C0FB461eEF40f2e31ddb8',
        l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop DAI LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-DAI'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.sETH) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sETH,
        l2_canonicalTokenAddress: '0x61F00BD6995A087F84BCcA62dCC835905f2a9207',
        l2_hBridgeTokenName: 'Synth sETH Hop Token',
        l2_hBridgeTokenSymbol: 'hsETH',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop sETH LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-sETH'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.sBTC) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sBTC,
        l2_canonicalTokenAddress: '0xe5BEd2355E575b32B0e151EA6577Dfe05FaE5484',
        l2_hBridgeTokenName: 'Synth sBTC Hop Token',
        l2_hBridgeTokenSymbol: 'hsBTC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop sBTC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-sBTC'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.USDC) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.USDC,
        l2_canonicalTokenAddress: '0xcc4f6aE976dd9dFb44E741e7430b6111bF0cbCd0',
        l2_hBridgeTokenName: 'USD Coin Hop Token',
        l2_hBridgeTokenSymbol: 'hUSDC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop USDC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-USDC'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.WBTC) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.WBTC,
        l2_canonicalTokenAddress: '0x90ac599445B07c8aa0FC82248f51f6558136203D',
        l2_hBridgeTokenName: 'Wrapped BTC Hop Token',
        l2_hBridgeTokenSymbol: 'hWBTC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop WBTC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-WBTC'
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.TST) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.TST,
        l2_canonicalTokenAddress: '0xd9965dD7FD84246Bbca1ee4E3eE8f92D8e5cbE6F',
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
  console.log('data: ', data)
  updateConfigFile(data)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    logger.error(error)
    process.exit(1)
  })
