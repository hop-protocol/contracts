import { NetworkData } from './types'
import { DEFAULT_NETWORK_DATA } from './defaultNetworkData'

import {
  CHAIN_IDS,
  L1_CANONICAL_TOKEN_ADDRESSES,
  L2_CANONICAL_TOKEN_ADDRESSES,
  ZERO_ADDRESS
} from '../constants'

const l1ChainId: string = CHAIN_IDS.ETHEREUM.RINKEBY.toString()

export const networkData: NetworkData = {
  arbitrum: {
    l2NetworkName: 'arbitrum',
    l1ChainId,
    l2ChainId: CHAIN_IDS.ARBITRUM.ARBITRUM_TESTNET.toString(),
    l1MessengerAddress: '0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e',
    l2TokenBridgeAddress: ZERO_ADDRESS,
    l2MessengerAddress: '0x0000000000000000000000000000000000000064',
    tokens: {
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.RINKEBY.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      }
    }
  }
}