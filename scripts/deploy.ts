require('dotenv').config()
import prompt from 'prompt'
import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
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
  COMMON_SYMBOLS,
  ZERO_ADDRESS,
  LIQUIDITY_PROVIDER_INITIAL_BALANCE,
  LIQUIDITY_PROVIDER_AMM_AMOUNT
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
  l2_messengerProxyAddress: string
}

interface ISpecificData {
  l1_canonicalTokenAddress: string
  l2_canonicalTokenAddress: string
  l2_hBridgeTokenName: string
  l2_hBridgeTokenSymbol: string
  l2_hBridgeTokenDecimals: number
  l2_swapLpTokenName: string
  l2_swapLpTokenSymbol: string
  liquidityProviderSendAmount: string
  liquidityProviderAmmAmount: string
}

interface INetworkParams extends IGeneralData, ISpecificData {
  l1_bridgeAddress: string
}

async function main () {
  logger.log('deploy script initiated')

  let l1NetworkName: string
  let l2NetworkName: string
  let tokenSymbol: string
  let isL1BridgeDeploy: boolean

  ;({
    l1NetworkName,
    l2NetworkName,
    tokenSymbol,
    isL1BridgeDeploy
  } = await getPrompts())

  if (!l1NetworkName) {
    throw new Error('L1 network name not specified')
  }

  if (!l2NetworkName) {
    throw new Error('L2 network name not specified')
  }

  if (!tokenSymbol) {
    throw new Error('Token symbol not specified')
  }

  setNetworkParams(l1NetworkName, l2NetworkName, tokenSymbol, isL1BridgeDeploy)
  const scripts: string[] = []
  if (isL1BridgeDeploy) {
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

async function getPrompts () {
  prompt.start()
  const res = await prompt.get([{
    name: 'l1NetworkName',
    type: 'string',
    required: true
  }, {
    name: 'l2NetworkName',
    type: 'string',
    required: true
  }, {
    name: 'tokenSymbol',
    type: 'string',
    required: true
  }, {
    name: 'isL1BridgeDeploy',
    type: 'boolean',
    required: true,
    default: false
  }])

  return {
    l1NetworkName: res.l1NetworkName as string,
    l2NetworkName: res.l2NetworkName as string,
    tokenSymbol: res.tokenSymbol as string,
    isL1BridgeDeploy: res.isL1BridgeDeploy as boolean
  }
}

function setNetworkParams (
  l1NetworkName: string,
  l2NetworkName: string,
  tokenSymbol: string,
  isL1BridgeDeploy: boolean
) {
  const { l1_bridgeAddress } = readConfigFile()
  
  let generalData: IGeneralData
  let specificData: ISpecificData

  const l1ChainId: BigNumber = getL1ChainIdFromNetworkName(l1NetworkName) 

  let l1CanonicalTokenAddresses: { [key: string]: string }
  if (l1NetworkName === 'mainnet') {
    l1CanonicalTokenAddresses = {
      'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    }
  } else if (l1NetworkName === 'kovan') {
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
      'USDC': '0x98339D8C260052B7ad81c28c16C0b98420f2B46a',
      'WBTC': '0xCB784a097f33231f2D3a1E22B236a9D2c878555d',
      'TST': '0x72BC29409f4F8a29284285b7af4f3D59d206d454'
    }
  }

  if (isL1BridgeDeploy) {
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
      l1_canonicalTokenAddress
    })
    return
  } else if (l2NetworkName === 'optimism') {
    generalData = {
      l2_networkName: l2NetworkName,
      l1_chainId: l1ChainId.toString(),
      l2_chainId: CHAIN_IDS.OPTIMISM.HOP_TESTNET.toString(),
      l1_messengerAddress: '0x48062eD9b6488EC41c4CfbF2f568D7773819d8C9',
      l2_tokenBridgeAddress: '0x82784078a7a8A1697BcCe5E07896C6a553846Bd5',
      l2_messengerAddress: '0x4200000000000000000000000000000000000007',
      l1_tokenBridgeAddress: '0xf8099DD44375Fdbb70D286af0fFCd46bA4B193dF',
      l2_messengerProxyAddress: ZERO_ADDRESS
    }

    if (tokenSymbol === COMMON_SYMBOLS.DAI.toLowerCase()) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.DAI,
        l2_canonicalTokenAddress: '0x43AF508997d3b33555b3Cdc093a94b5DED06e306',
        l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop DAI LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-DAI',
        liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
        liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.sETH.toLowerCase()) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sETH,
        l2_canonicalTokenAddress: '0x5C18Cd9D59ca1B587db57838cf9ca8a21e3714AF',
        l2_hBridgeTokenName: 'Synth sETH Hop Token',
        l2_hBridgeTokenSymbol: 'hsETH',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop sETH LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-sETH',
        liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
        liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.sBTC.toLowerCase()) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sBTC,
        l2_canonicalTokenAddress: '0x4beAFb9DfA4842Cf81A26b4e49E3f322616c4Ca5',
        l2_hBridgeTokenName: 'Synth sBTC Hop Token',
        l2_hBridgeTokenSymbol: 'hsBTC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop sBTC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-sBTC',
        liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
        liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.USDC.toLowerCase()) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.USDC,
        l2_canonicalTokenAddress: '0xd4740F9cE3149b657D2457B6Ef29F953c2FcB479',
        l2_hBridgeTokenName: 'USD Coin Hop Token',
        l2_hBridgeTokenSymbol: 'hUSDC',
        l2_hBridgeTokenDecimals: 6,
        l2_swapLpTokenName: 'Hop USDC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-USDC',
        liquidityProviderSendAmount: BigNumber.from('1000000000').toString(),
        liquidityProviderAmmAmount: BigNumber.from('500000000').toString()
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.WBTC.toLowerCase()) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.WBTC,
        l2_canonicalTokenAddress: '0x067ca83e321979E31b06250E05d18a12e4f6A8f1',
        l2_hBridgeTokenName: 'Wrapped BTC Hop Token',
        l2_hBridgeTokenSymbol: 'hWBTC',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop WBTC LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-WBTC',
        liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
        liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
      }
    } else if (tokenSymbol === COMMON_SYMBOLS.TST.toLowerCase()) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.TST,
        l2_canonicalTokenAddress: '0x943599d17FE82Bb4563b1823500f3267f91Acd2e',
        l2_hBridgeTokenName: 'Test Coin Hop Token',
        l2_hBridgeTokenSymbol: 'TST',
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop TST LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-TST',
        liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
        liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
      }
    } 
  } else if (l2NetworkName === 'arbitrum') {
    generalData = {
      l2_networkName: l2NetworkName,
      l1_chainId: l1ChainId.toString(),
      l2_chainId: CHAIN_IDS.ARBITRUM.TESTNET_4.toString(),
      l1_messengerAddress: '0xD71d47AD1b63981E9dB8e4A78C0b30170da8a601',
      l2_tokenBridgeAddress: '0xE49CCf3e19d847f8FF4d6962684A3242abF63f07',
      l2_messengerAddress: '0x0000000000000000000000000000000000000064',
      l1_tokenBridgeAddress: '0x2948ac43e4aff448f6af0f7a11f18bb6062dd271',
      l2_messengerProxyAddress: ZERO_ADDRESS
    }

    if (tokenSymbol === COMMON_SYMBOLS.DAI.toLowerCase()) {
      specificData = {
        l1_canonicalTokenAddress: l1CanonicalTokenAddresses.DAI,
        l2_canonicalTokenAddress: '0xFa226E8B73Acaafeb29fEcd601afBEC8b1208986',
        l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
        l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
        l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
        l2_swapLpTokenName: 'Hop DAI LP Token',
        l2_swapLpTokenSymbol: 'HOP-LP-DAI',
        liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
        liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
      }
    }
  } else if (l2NetworkName === 'xdai') {
    if (l1NetworkName === 'mainnet') {
      generalData = {
        l2_networkName: l2NetworkName,
        l1_chainId: l1ChainId.toString(),
        l2_chainId: CHAIN_IDS.XDAI.XDAI.toString(),
        l1_messengerAddress: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
        l2_tokenBridgeAddress: '0xf6A78083ca3e2a662D6dd1703c939c8aCE2e268d',
        l2_messengerAddress: '0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59',
        l1_tokenBridgeAddress: '0x88ad09518695c6c3712AC10a214bE5109a655671',
        l2_messengerProxyAddress: ZERO_ADDRESS
      }

      if (tokenSymbol === COMMON_SYMBOLS.USDC.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.USDC,
          l2_canonicalTokenAddress: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
          l2_hBridgeTokenName: 'USD Coin Hop Token',
          l2_hBridgeTokenSymbol: 'hUSDC',
          l2_hBridgeTokenDecimals: 6,
          l2_swapLpTokenName: 'Hop USDC LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-USDC',
          liquidityProviderSendAmount: BigNumber.from('10000000').toString(),
          liquidityProviderAmmAmount: BigNumber.from('5000000').toString()
        }
      }
    } else if (l1NetworkName === 'kovan') {
      generalData = {
        l2_networkName: l2NetworkName,
        l1_chainId: l1ChainId.toString(),
        l2_chainId: CHAIN_IDS.XDAI.SOKOL.toString(),
        l1_messengerAddress: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
        l2_tokenBridgeAddress: '0x40CdfF886715A4012fAD0219D15C98bB149AeF0e',
        l2_messengerAddress: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
        l1_tokenBridgeAddress: '0xA960d095470f7509955d5402e36d9DB984B5C8E2',
        l2_messengerProxyAddress: ZERO_ADDRESS
      }

      if (tokenSymbol === COMMON_SYMBOLS.DAI.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.DAI,
          l2_canonicalTokenAddress: '0x6D2d8B29d92cab87a273e872FcC4650A64116283',
          l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
          l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
          l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
          l2_swapLpTokenName: 'Hop DAI LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-DAI',
          liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
          liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
        }
      } else if (tokenSymbol === COMMON_SYMBOLS.sETH.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sETH,
          l2_canonicalTokenAddress: '0xeC3B005D2BF47f505F1A0cD68eEb7Ea439D6daF6',
          l2_hBridgeTokenName: 'Synth sETH Hop Token',
          l2_hBridgeTokenSymbol: 'hsETH',
          l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
          l2_swapLpTokenName: 'Hop sETH LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-sETH',
          liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
          liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
        }
      } else if (tokenSymbol === COMMON_SYMBOLS.sBTC.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sBTC,
          l2_canonicalTokenAddress: '0x696ED254EC9bD27328d5ef81905042913260eccd',
          l2_hBridgeTokenName: 'Synth sBTC Hop Token',
          l2_hBridgeTokenSymbol: 'hsBTC',
          l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
          l2_swapLpTokenName: 'Hop sBTC LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-sBTC',
          liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
          liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
        }
      } else if (tokenSymbol === COMMON_SYMBOLS.USDC.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.USDC,
          l2_canonicalTokenAddress: '0x452AED3fdB2E83A1352624321629180aB1489Dd0',
          l2_hBridgeTokenName: 'USD Coin Hop Token',
          l2_hBridgeTokenSymbol: 'hUSDC',
          l2_hBridgeTokenDecimals: 6,
          l2_swapLpTokenName: 'Hop USDC LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-USDC',
          liquidityProviderSendAmount: BigNumber.from('1000000000').toString(),
          liquidityProviderAmmAmount: BigNumber.from('500000000').toString()
        }
      } else if (tokenSymbol === COMMON_SYMBOLS.WBTC.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.WBTC,
          l2_canonicalTokenAddress: '0x94490EF228D4aBD189694f86D1684D972431380b',
          l2_hBridgeTokenName: 'Wrapped BTC Hop Token',
          l2_hBridgeTokenSymbol: 'hWBTC',
          l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
          l2_swapLpTokenName: 'Hop WBTC LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-WBTC',
          liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
          liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
        }
      } else if (tokenSymbol === COMMON_SYMBOLS.TST.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.TST,
          l2_canonicalTokenAddress: '0x1a844c99766d67E6031c337E28233Fe2BF773603',
          l2_hBridgeTokenName: 'Test Coin Hop Token',
          l2_hBridgeTokenSymbol: 'TST',
          l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
          l2_swapLpTokenName: 'Hop TST LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-TST',
          liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
          liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
        }
      }
    }
  } else if (l2NetworkName === 'polygon') {
    if (l1NetworkName === 'mainnet') {
      generalData = {
        l2_networkName: l2NetworkName,
        l1_chainId: l1ChainId.toString(),
        l2_chainId: CHAIN_IDS.POLYGON.POLYGON.toString(),
        // For Polygon, this is our MessengerWrapper. We never call the messenger (0x28e... on Mainnet) directly
        l1_messengerAddress: ZERO_ADDRESS,
        // For Polygon, this is unused
        l2_tokenBridgeAddress: ZERO_ADDRESS,
        // For Polygon, this is the messenger proxy. This is handled during the deployment scripts.
        l2_messengerAddress: ZERO_ADDRESS,
        l1_tokenBridgeAddress: '0xA0c68C638235ee32657e8f720a23ceC1bFc77C77',
        l2_messengerProxyAddress: ZERO_ADDRESS
      }

      if (tokenSymbol === COMMON_SYMBOLS.USDC.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.USDC,
          l2_canonicalTokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          l2_hBridgeTokenName: 'USD Coin Hop Token',
          l2_hBridgeTokenSymbol: 'hUSDC',
          l2_hBridgeTokenDecimals: 6,
          l2_swapLpTokenName: 'Hop USDC LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-USDC',
          liquidityProviderSendAmount: BigNumber.from('10000000').toString(),
          liquidityProviderAmmAmount: BigNumber.from('5000000').toString()
        }
      }
    } else if (l1NetworkName === 'goerli') {
      generalData = {
        l2_networkName: l2NetworkName,
        l1_chainId: l1ChainId.toString(),
        l2_chainId: CHAIN_IDS.POLYGON.MUMBAI.toString(),
        // For Polygon, this is our MessengerWrapper. We never call the messenger (0xEAa... on Goerli) directly
        l1_messengerAddress: ZERO_ADDRESS,
        // For Polygon, this is unused
        l2_tokenBridgeAddress: ZERO_ADDRESS,
        // For Polygon, this is the messenger proxy. This is handled during the deployment scripts.
        l2_messengerAddress: ZERO_ADDRESS,
        l1_tokenBridgeAddress: '0xBbD7cBFA79faee899Eaf900F13C9065bF03B1A74',
        l2_messengerProxyAddress:ZERO_ADDRESS 
      }

      if (tokenSymbol === COMMON_SYMBOLS.DAI.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.DAI,
          l2_canonicalTokenAddress: '0xb224913CE3851b0a0d7C0FB461eEF40f2e31ddb8',
          l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
          l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
          l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
          l2_swapLpTokenName: 'Hop DAI LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-DAI',
          liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
          liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
        }
      } else if (tokenSymbol === 'dummy') {
        specificData = {
          l1_canonicalTokenAddress: '0x655F2166b0709cd575202630952D71E2bB0d61Af',
          l2_canonicalTokenAddress: '0xfe4F5145f6e09952a5ba9e956ED0C25e3Fa4c7F1',
          l2_hBridgeTokenName: 'Dummy ERC20 Hop Token',
          l2_hBridgeTokenSymbol: 'hDERC20',
          l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
          l2_swapLpTokenName: 'Hop DERC20 LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-DERC20',
          liquidityProviderSendAmount: BigNumber.from(parseEther('0.5')).toString(),
          liquidityProviderAmmAmount: BigNumber.from(parseEther('0.25')).toString()
        }
      } else if (tokenSymbol === COMMON_SYMBOLS.sETH.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sETH,
          l2_canonicalTokenAddress: '0x61F00BD6995A087F84BCcA62dCC835905f2a9207',
          l2_hBridgeTokenName: 'Synth sETH Hop Token',
          l2_hBridgeTokenSymbol: 'hsETH',
          l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
          l2_swapLpTokenName: 'Hop sETH LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-sETH',
          liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
          liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
        }
      } else if (tokenSymbol === COMMON_SYMBOLS.sBTC.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.sBTC,
          l2_canonicalTokenAddress: '0xe5BEd2355E575b32B0e151EA6577Dfe05FaE5484',
          l2_hBridgeTokenName: 'Synth sBTC Hop Token',
          l2_hBridgeTokenSymbol: 'hsBTC',
          l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
          l2_swapLpTokenName: 'Hop sBTC LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-sBTC',
          liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
          liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
        }
      } else if (tokenSymbol === COMMON_SYMBOLS.USDC.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.USDC,
          l2_canonicalTokenAddress: '0x6D4dd09982853F08d9966aC3cA4Eb5885F16f2b2',
          l2_hBridgeTokenName: 'USD Coin Hop Token',
          l2_hBridgeTokenSymbol: 'hUSDC',
          l2_hBridgeTokenDecimals: 6,
          l2_swapLpTokenName: 'Hop USDC LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-USDC',
          liquidityProviderSendAmount: BigNumber.from('1000000000').toString(),
          liquidityProviderAmmAmount: BigNumber.from('500000000').toString()
        }
      } else if (tokenSymbol === COMMON_SYMBOLS.WBTC.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.WBTC,
          l2_canonicalTokenAddress: '0x90ac599445B07c8aa0FC82248f51f6558136203D',
          l2_hBridgeTokenName: 'Wrapped BTC Hop Token',
          l2_hBridgeTokenSymbol: 'hWBTC',
          l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
          l2_swapLpTokenName: 'Hop WBTC LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-WBTC',
          liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
          liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
        }
      } else if (tokenSymbol === COMMON_SYMBOLS.TST.toLowerCase()) {
        specificData = {
          l1_canonicalTokenAddress: l1CanonicalTokenAddresses.TST,
          l2_canonicalTokenAddress: '0xd9965dD7FD84246Bbca1ee4E3eE8f92D8e5cbE6F',
          l2_hBridgeTokenName: 'Test Coin Hop Token',
          l2_hBridgeTokenSymbol: 'TST',
          l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
          l2_swapLpTokenName: 'Hop TST LP Token',
          l2_swapLpTokenSymbol: 'HOP-LP-TST',
          liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
          liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
        }
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
