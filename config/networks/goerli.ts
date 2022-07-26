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
    }
  },
  optimism: {
    l2NetworkName: 'optimism',
    l1ChainId,
    l2ChainId: CHAIN_IDS.OPTIMISM.OPTIMISM_TESTNET.toString(),
    l1MessengerAddress: 'TODO',
    l2TokenBridgeAddress: 'TODO',
    l2MessengerAddress: 'TODO',
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.ETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_TESTNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
    }
  },
  arbitrum: {
    l2NetworkName: 'arbitrum',
    l1ChainId,
    l2ChainId: CHAIN_IDS.ARBITRUM.ARBITRUM_TESTNET.toString(),
    l1MessengerAddress: 'TODO',
    l2TokenBridgeAddress: ZERO_ADDRESS,
    l2MessengerAddress: '0x0000000000000000000000000000000000000064',
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.ETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_TESTNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      }
    }
  },
}