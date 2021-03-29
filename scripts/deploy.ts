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

interface KovanParams {
  l1_chainId: string
  l1_canonicalTokenAddress: string
}

interface NetworkParams {
  l2_networkName: string
  l1_chainId: string
  l2_chainId: string
  l1_tokenBridgeAddress: string
  l1_bridgeAddress: string
  l1_canonicalTokenAddress: string
  l1_messengerAddress: string
  l2_canonicalTokenAddress: string
  l2_tokenBridgeAddress: string
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

  const scripts: string[] = []
  if (networkName === 'kovan') {
    const networkParams: KovanParams = getKovanParams()
    updateConfigFile(networkParams)

    scripts.push(`npm run deploy:l1-kovan`)
  } else {
    if (networkName === 'xdai') {
      showL2CanonicalTokenWarning()
    }
    const networkParams: NetworkParams = getNetworkParams(networkName)
    updateConfigFile(networkParams)

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

function getKovanParams (): KovanParams {
  return {
    l1_chainId: CHAIN_IDS.ETHEREUM.KOVAN.toString(),
    l1_canonicalTokenAddress: '0x943599d17FE82Bb4563b1823500f3267f91Acd2e',
  }
}

function getNetworkParams (networkName: string): NetworkParams {
  const { l1_bridgeAddress } = readConfigFile()
  switch (networkName) {
    case 'optimism': {
      const l2_networkName: string = networkName
      const l1_chainId: string = CHAIN_IDS.ETHEREUM.KOVAN.toString()
      const l2_chainId: string = CHAIN_IDS.OPTIMISM.HOP_TESTNET.toString()
      const l1_messengerAddress: string = '0xb89065D5eB05Cac554FDB11fC764C679b4202322'
      const l2_tokenBridgeAddress: string = '0x4023E9eFcB444Ad6C662075FE5B4570274A2BC2E'
      const l2_messengerAddress: string = '0x4200000000000000000000000000000000000007'
      const l1_tokenBridgeAddress: string = '0xC1e7Be0E1aDD345afB2485aA5E774cD79cBbbBf5'

      return {
        // DAI
        // l2_networkName,
        // l1_chainId,
        // l2_chainId,
        // l1_bridgeAddress,
        // l1_messengerAddress,
        // l2_tokenBridgeAddress,
        // l2_messengerAddress,
        // l1_tokenBridgeAddress,
        // l1_canonicalTokenAddress: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
        // l2_canonicalTokenAddress: '0x782e1ec5F7381269b2e5DC4eD58648C60161539b',
        // l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        // l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        // l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS

        // sETH
        // l2_networkName,
        // l1_chainId,
        // l2_chainId,
        // l1_bridgeAddress,
        // l1_messengerAddress,
        // l2_tokenBridgeAddress,
        // l2_messengerAddress,
        // l1_tokenBridgeAddress,
        // l1_canonicalTokenAddress: '0x7EE6109672c07Dcf97435C8238835EFF5D6E89FD',
        // l2_canonicalTokenAddress: '0x5C18Cd9D59ca1B587db57838cf9ca8a21e3714AF',
        // l2_hBridgeTokenName: 'Synth sETH Hop Token',
        // l2_hBridgeTokenSymbol: 'hsETH',
        // l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS

        // sBTC
        // l2_networkName,
        // l1_chainId,
        // l2_chainId,
        // l1_bridgeAddress,
        // l1_messengerAddress,
        // l2_tokenBridgeAddress,
        // l2_messengerAddress,
        // l1_tokenBridgeAddress,
        // l1_canonicalTokenAddress: '0x7a4f56B0Dd21d730604A266245a0067b97605DAE',
        // l2_canonicalTokenAddress: '0x4beAFb9DfA4842Cf81A26b4e49E3f322616c4Ca5',
        // l2_hBridgeTokenName: 'Synth sBTC Hop Token',
        // l2_hBridgeTokenSymbol: 'hsBTC',
        // l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS

        // USDC
        // l2_networkName,
        // l1_chainId,
        // l2_chainId,
        // l1_bridgeAddress,
        // l1_messengerAddress,
        // l2_tokenBridgeAddress,
        // l2_messengerAddress,
        // l1_tokenBridgeAddress,
        // l1_canonicalTokenAddress: '0x7326510Cf9Ae0397dbBaF37FABba54f0A7b8D100',
        // l2_canonicalTokenAddress: '0x56836Eec6d4EfCcFBc162C0851007D9F72aD202B',
        // l2_hBridgeTokenName: 'USD Coin Hop Token',
        // l2_hBridgeTokenSymbol: 'hUSDC',
        // l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS

        // WBTC
        // l2_networkName,
        // l1_chainId,
        // l2_chainId,
        // l1_bridgeAddress,
        // l1_messengerAddress,
        // l2_tokenBridgeAddress,
        // l2_messengerAddress,
        // l1_tokenBridgeAddress,
        // l1_canonicalTokenAddress: '0x1E1a556D2166A006e662864D376e8DD249087150',
        // l2_canonicalTokenAddress: '0x067ca83e321979E31b06250E05d18a12e4f6A8f1',
        // l2_hBridgeTokenName: 'Wrapped BTC Hop Token',
        // l2_hBridgeTokenSymbol: 'hWBTC',
        // l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS

        // TST
        l2_networkName,
        l1_chainId,
        l2_chainId,
        l1_bridgeAddress,
        l1_messengerAddress,
        l2_tokenBridgeAddress,
        l2_messengerAddress,
        l1_tokenBridgeAddress,
        l1_canonicalTokenAddress: '0x943599d17FE82Bb4563b1823500f3267f91Acd2e',
        l2_canonicalTokenAddress: '0x943599d17FE82Bb4563b1823500f3267f91Acd2e',
        l2_hBridgeTokenName: 'Test Coin Hop Token',
        l2_hBridgeTokenSymbol: 'TST',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS
      }
    }
    case 'arbitrum': {
      const l2_networkName: string = networkName
      const l1_chainId: string = CHAIN_IDS.ETHEREUM.KOVAN.toString()
      const l2_chainId: string = CHAIN_IDS.ARBITRUM.TESTNET_4.toString()
      const l1_messengerAddress: string = '0x97884F2B6A2AF19C38AA0a15716CF2aC931A3c73'
      const l2_tokenBridgeAddress: string = '0xE49CCf3e19d847f8FF4d6962684A3242abF63f07'
      const l2_messengerAddress: string = '0x0000000000000000000000000000000000000064'
      const l1_tokenBridgeAddress: string = '0x5d4958A5A5C336299445353EAB2b1CD85a331B52'

      // DAI
      return {
        l2_networkName,
        l1_chainId,
        l2_chainId,
        l1_bridgeAddress,
        l1_messengerAddress,
        l2_tokenBridgeAddress,
        l2_messengerAddress,
        l1_tokenBridgeAddress,
        l1_canonicalTokenAddress: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
        l2_canonicalTokenAddress: '0xD98Ba848F10697A914a8c007dBCD05fCe2A0b84f',
        l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS
      }
    }
    case 'xdai': {
      const l2_networkName: string = networkName
      const l1_chainId: string = CHAIN_IDS.ETHEREUM.KOVAN.toString()
      const l2_chainId: string = CHAIN_IDS.XDAI.SOKOL.toString()
      const l1_messengerAddress: string = '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560'
      const l2_tokenBridgeAddress: string = '0x40CdfF886715A4012fAD0219D15C98bB149AeF0e'
      const l2_messengerAddress: string = '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560'
      const l1_tokenBridgeAddress: string = '0xA960d095470f7509955d5402e36d9DB984B5C8E2'

      return {
        // DAI
        // l2_networkName,
        // l1_chainId,
        // l2_chainId,
        // l1_bridgeAddress,
        // l1_messengerAddress,
        // l2_tokenBridgeAddress,
        // l2_messengerAddress,
        // l1_tokenBridgeAddress,
        // l1_canonicalTokenAddress: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
        // l2_canonicalTokenAddress: '0x714983a8Dc3329bf3BeB8F36b49878CF944E5A3B',
        // l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        // l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        // l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS

        // sETH
        // l2_networkName,
        // l1_chainId,
        // l2_chainId,
        // l1_bridgeAddress,
        // l1_messengerAddress,
        // l2_tokenBridgeAddress,
        // l2_messengerAddress,
        // l1_tokenBridgeAddress,
        // l1_canonicalTokenAddress: '0x7EE6109672c07Dcf97435C8238835EFF5D6E89FD',
        // l2_canonicalTokenAddress: '0xeC3B005D2BF47f505F1A0cD68eEb7Ea439D6daF6',
        // l2_hBridgeTokenName: 'Synth sETH Hop Token',
        // l2_hBridgeTokenSymbol: 'hsETH',
        // l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS

        // sBTC
        // l2_networkName,
        // l1_chainId,
        // l2_chainId,
        // l1_bridgeAddress,
        // l1_messengerAddress,
        // l2_tokenBridgeAddress,
        // l2_messengerAddress,
        // l1_tokenBridgeAddress,
        // l1_canonicalTokenAddress: '0x7a4f56B0Dd21d730604A266245a0067b97605DAE',
        // l2_canonicalTokenAddress: '0x696ED254EC9bD27328d5ef81905042913260eccd',
        // l2_hBridgeTokenName: 'Synth sBTC Hop Token',
        // l2_hBridgeTokenSymbol: 'hsBTC',
        // l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS

        // USDC
        // l2_networkName,
        // l1_chainId,
        // l2_chainId,
        // l1_bridgeAddress,
        // l1_messengerAddress,
        // l2_tokenBridgeAddress,
        // l2_messengerAddress,
        // l1_tokenBridgeAddress,
        // l1_canonicalTokenAddress: '0x7326510Cf9Ae0397dbBaF37FABba54f0A7b8D100',
        // l2_canonicalTokenAddress: '0x452AED3fdB2E83A1352624321629180aB1489Dd0',
        // l2_hBridgeTokenName: 'USD Coin Hop Token',
        // l2_hBridgeTokenSymbol: 'hUSDC',
        // l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS

        // WBTC
        // l2_networkName,
        // l1_chainId,
        // l2_chainId,
        // l1_bridgeAddress,
        // l1_messengerAddress,
        // l2_tokenBridgeAddress,
        // l2_messengerAddress,
        // l1_tokenBridgeAddress,
        // l1_canonicalTokenAddress: '0x1E1a556D2166A006e662864D376e8DD249087150',
        // l2_canonicalTokenAddress: '0x94490EF228D4aBD189694f86D1684D972431380b',
        // l2_hBridgeTokenName: 'Wrapped BTC Hop Token',
        // l2_hBridgeTokenSymbol: 'hWBTC',
        // l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS

        // TST
        l2_networkName,
        l1_chainId,
        l2_chainId,
        l1_bridgeAddress,
        l1_messengerAddress,
        l2_tokenBridgeAddress,
        l2_messengerAddress,
        l1_tokenBridgeAddress,
        l1_canonicalTokenAddress: '0x943599d17FE82Bb4563b1823500f3267f91Acd2e',
        l2_canonicalTokenAddress: '0x1a844c99766d67E6031c337E28233Fe2BF773603',
        l2_hBridgeTokenName: 'Test Coin Hop Token',
        l2_hBridgeTokenSymbol: 'TST',
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
