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
    l1TokenBridgeAddress: '0xA0c68C638235ee32657e8f720a23ceC1bFc77C77',
    l2MessengerProxyAddress:ZERO_ADDRESS,
    tokens: {
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.POLYGON.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      },
    }
  },
  XDAI: {
    l2NetworkName: 'xdai',
    l1ChainId,
    l2ChainId: CHAIN_IDS.XDAI.XDAI.toString(),
    l1MessengerAddress: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
    l2TokenBridgeAddress: '0xf6A78083ca3e2a662D6dd1703c939c8aCE2e268d',
    l2MessengerAddress: '0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59',
    l1TokenBridgeAddress: '0x88ad09518695c6c3712AC10a214bE5109a655671',
    l2MessengerProxyAddress:ZERO_ADDRESS,
    tokens: {
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.XDAI.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      }
    }
  }
}