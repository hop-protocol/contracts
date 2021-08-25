import { NetworkData } from './types'
import { DEFAULT_NETWORK_DATA } from './defaultNetworkData'

import {
  CHAIN_IDS,
  ZERO_ADDRESS,
  L1_CANONICAL_TOKEN_ADDRESSES,
  L2_CANONICAL_TOKEN_ADDRESSES,
} from '../constants'

const l1ChainId: string = CHAIN_IDS.ETHEREUM.MAINNET.toString()

export const networkData: NetworkData = {
  polygon: {
    l2NetworkName: 'polygon',
    l1ChainId,
    l2ChainId: CHAIN_IDS.POLYGON.POLYGON.toString(),
    l1MessengerAddress: ZERO_ADDRESS,
    l2TokenBridgeAddress: ZERO_ADDRESS,
    l2MessengerAddress: ZERO_ADDRESS,
    tokens: {
      USDC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.USDC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.POLYGON.USDC,
        ...DEFAULT_NETWORK_DATA.USDC
      },
      USDT: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.USDT,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.POLYGON.USDT,
        ...DEFAULT_NETWORK_DATA.USDT
      },
      MATIC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.MATIC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.POLYGON.MATIC,
        ...DEFAULT_NETWORK_DATA.MATIC
      },
    }
  },
  xdai: {
    l2NetworkName: 'xdai',
    l1ChainId,
    l2ChainId: CHAIN_IDS.XDAI.XDAI.toString(),
    l1MessengerAddress: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
    l2TokenBridgeAddress: '0xf6A78083ca3e2a662D6dd1703c939c8aCE2e268d',
    l2MessengerAddress: '0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59',
    tokens: {
      USDC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.USDC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.XDAI.USDC,
        ...DEFAULT_NETWORK_DATA.USDC
      },
      USDT: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.USDT,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.XDAI.USDT,
        ...DEFAULT_NETWORK_DATA.USDT
      },
      MATIC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.MATIC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.XDAI.MATIC,
        ...DEFAULT_NETWORK_DATA.MATIC
      },
    }
  },
  optimism: {
    l2NetworkName: 'optimism',
    l1ChainId,
    l2ChainId: CHAIN_IDS.OPTIMISM.OPTIMISM_MAINNET.toString(),
    l1MessengerAddress: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
    l2TokenBridgeAddress: '0x4200000000000000000000000000000000000010',
    l2MessengerAddress: '0x4200000000000000000000000000000000000007',
    tokens: {
      USDC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.USDC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.USDC,
        ...DEFAULT_NETWORK_DATA.USDC
      },
      USDT: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.USDT,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.USDT,
        ...DEFAULT_NETWORK_DATA.USDT
      },
      MATIC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.MATIC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.MATIC,
        ...DEFAULT_NETWORK_DATA.MATIC
      },
    }
  }
}