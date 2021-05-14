import { NetworkData } from './types'
import { DEFAULT_NETWORK_DATA } from './defaultNetworkData'

import {
  CHAIN_IDS,
  ZERO_ADDRESS,
  L1_CANONICAL_TOKEN_ADDRESSES,
  L2_CANONICAL_TOKEN_ADDRESSES,
} from '../constants'

const l1ChainId: string = CHAIN_IDS.ETHEREUM.KOVAN.toString()

export const networkData: NetworkData = {
  sokol: {
    l2NetworkName: 'sokol',
    l1ChainId,
    l2ChainId: CHAIN_IDS.XDAI.SOKOL.toString(),
    l1MessengerAddress: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
    l2TokenBridgeAddress: '0x40CdfF886715A4012fAD0219D15C98bB149AeF0e',
    l2MessengerAddress: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
    l1TokenBridgeAddress: '0xA960d095470f7509955d5402e36d9DB984B5C8E2',
    l2MessengerProxyAddress:ZERO_ADDRESS,
    tokens: {
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.KOVAN.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.SOKOL.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      },
      sETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.KOVAN.sETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.SOKOL.sETH,
        ...DEFAULT_NETWORK_DATA.sETH
      },
      sBTC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.KOVAN.sBTC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.SOKOL.sBTC,
        ...DEFAULT_NETWORK_DATA.sBTC
      },
      USDC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.KOVAN.USDC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.SOKOL.USDC,
        ...DEFAULT_NETWORK_DATA.USDC
      },
      WBTC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.KOVAN.WBTC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.SOKOL.WBTC,
        ...DEFAULT_NETWORK_DATA.WBTC
      }
    }
  },
  arbitrum: {
    l2NetworkName: 'arbitrum',
    l1ChainId,
    l2ChainId: CHAIN_IDS.ARBITRUM.TESTNET_4.toString(),
    l1MessengerAddress: '0xD71d47AD1b63981E9dB8e4A78C0b30170da8a601',
    l2TokenBridgeAddress: '0xE49CCf3e19d847f8FF4d6962684A3242abF63f07',
    l2MessengerAddress: '0x0000000000000000000000000000000000000064',
    l1TokenBridgeAddress: '0x2948ac43e4aff448f6af0f7a11f18bb6062dd271',
    l2MessengerProxyAddress:ZERO_ADDRESS,
    tokens: {
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.KOVAN.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      }
    }
  },
  optimism: {
    l2NetworkName: 'optimism',
    l1ChainId,
    l2ChainId: CHAIN_IDS.OPTIMISM.HOP_TESTNET.toString(),
    l1MessengerAddress: '0x48062eD9b6488EC41c4CfbF2f568D7773819d8C9',
    l2TokenBridgeAddress: '0x82784078a7a8A1697BcCe5E07896C6a553846Bd5',
    l2MessengerAddress: '0x4200000000000000000000000000000000000007',
    l1TokenBridgeAddress: '0xf8099DD44375Fdbb70D286af0fFCd46bA4B193dF',
    l2MessengerProxyAddress:ZERO_ADDRESS,
    tokens: {
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.KOVAN.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM.KOVAN.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      },
      sETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.KOVAN.sETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM.KOVAN.sETH,
        ...DEFAULT_NETWORK_DATA.sETH
      },
      sBTC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.KOVAN.sBTC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM.KOVAN.sBTC,
        ...DEFAULT_NETWORK_DATA.sBTC
      },
      USDC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.KOVAN.USDC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM.KOVAN.USDC,
        ...DEFAULT_NETWORK_DATA.USDC
      },
      WBTC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.KOVAN.WBTC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM.KOVAN.WBTC,
        ...DEFAULT_NETWORK_DATA.WBTC
      }
    }
  }
}