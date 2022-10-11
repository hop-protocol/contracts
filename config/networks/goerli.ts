import { NetworkData } from './types'
import { DEFAULT_NETWORK_DATA } from './defaultNetworkData'

import {
  CHAIN_IDS,
  ZERO_ADDRESS,
  L1_CANONICAL_TOKEN_ADDRESSES,
  L2_CANONICAL_TOKEN_ADDRESSES,
} from '../constants'

const l1ChainId: string = CHAIN_IDS.ETHEREUM.GOERLI.toString()

export const networkData: NetworkData = {
  mumbai: {
    l2NetworkName: 'mumbai',
    l1ChainId,
    l2ChainId: CHAIN_IDS.POLYGON.MUMBAI.toString(),
    l1MessengerAddress: ZERO_ADDRESS,
    l2TokenBridgeAddress: ZERO_ADDRESS,
    l2MessengerAddress: ZERO_ADDRESS,
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.ETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.MUMBAI.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      USDC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.USDC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.MUMBAI.USDC,
        ...DEFAULT_NETWORK_DATA.USDC
      },
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.HOP,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.MUMBAI.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      },
    }
  },
  optimism: {
    l2NetworkName: 'optimism',
    l1ChainId,
    l2ChainId: CHAIN_IDS.OPTIMISM.OPTIMISM_TESTNET.toString(),
    l1MessengerAddress: '0x5086d1eEF304eb5284A0f6720f79403b4e9bE294',
    l2TokenBridgeAddress: '0x4200000000000000000000000000000000000010',
    l2MessengerAddress: '0x4200000000000000000000000000000000000007',
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.ETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_TESTNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      USDC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.USDC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_TESTNET.USDC,
        ...DEFAULT_NETWORK_DATA.USDC
      },
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.HOP,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_TESTNET.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      },
    }
  },
  arbitrum: {
    l2NetworkName: 'arbitrum',
    l1ChainId,
    l2ChainId: CHAIN_IDS.ARBITRUM.ARBITRUM_TESTNET.toString(),
    l1MessengerAddress: '0x6BEbC4925716945D46F0Ec336D5C2564F419682C',
    l2TokenBridgeAddress: ZERO_ADDRESS,
    l2MessengerAddress: '0x0000000000000000000000000000000000000064',
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.ETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_TESTNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      USDC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.USDC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_TESTNET.USDC,
        ...DEFAULT_NETWORK_DATA.USDC
      },
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.HOP,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_TESTNET.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      },
    }
  },
}