import { NetworkData } from './types'
import { DEFAULT_NETWORK_DATA } from './defaultNetworkData'

import {
  CHAIN_IDS,
  ZERO_ADDRESS,
  L1_CANONICAL_TOKEN_ADDRESSES,
  L2_CANONICAL_TOKEN_ADDRESSES
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
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.HOP,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.MUMBAI.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      },
      USDT: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.USDT,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.MUMBAI.USDT,
        ...DEFAULT_NETWORK_DATA.USDT
      },
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.MUMBAI.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      },
      UNI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.UNI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.MUMBAI.UNI,
        ...DEFAULT_NETWORK_DATA.UNI
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
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_TESTNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.HOP,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_TESTNET.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      },
      USDT: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.USDT,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_TESTNET.USDT,
        ...DEFAULT_NETWORK_DATA.USDT
      },
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_TESTNET.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      },
      UNI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.UNI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_TESTNET.UNI,
        ...DEFAULT_NETWORK_DATA.UNI
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
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_TESTNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.HOP,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_TESTNET.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      },
      USDT: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.USDT,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_TESTNET.USDT,
        ...DEFAULT_NETWORK_DATA.USDT
      },
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_TESTNET.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      },
      UNI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.UNI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_TESTNET.UNI,
        ...DEFAULT_NETWORK_DATA.UNI
      },
    }
  },
  linea: {
    l2NetworkName: 'linea',
    l1ChainId,
    l2ChainId: CHAIN_IDS.LINEA.LINEA_TESTNET.toString(),
    l1MessengerAddress: '0x70BaD09280FD342D02fe64119779BC1f0791BAC2',
    l2TokenBridgeAddress: '0x0000000000000000000000000000000000000000',
    l2MessengerAddress: '0xC499a572640B64eA1C8c194c43Bc3E19940719dC',
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.ETH,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.LINEA_TESTNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.HOP,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.LINEA_TESTNET.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      },
      USDT: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.USDT,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.LINEA_TESTNET.USDT,
        ...DEFAULT_NETWORK_DATA.USDT
      },
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.LINEA_TESTNET.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      },
      UNI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.UNI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.LINEA_TESTNET.UNI,
        ...DEFAULT_NETWORK_DATA.UNI
      },
      USDC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.USDC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.LINEA_TESTNET.USDC,
        ...DEFAULT_NETWORK_DATA.USDC
      },
    }
  },
  zksync: {
    l2NetworkName: 'zksync',
    l1ChainId,
    l2ChainId: CHAIN_IDS.ZKSYNC.ZKSYNC_TESTNET.toString(),
    l1MessengerAddress: 'TODO', // TODO: zksync
    l2TokenBridgeAddress: '0x0000000000000000000000000000000000000000',
    l2MessengerAddress: 'TODO', // TODO: zksync
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.ETH,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.ZKSYNC_TESTNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      }
    }
  },
  base: {
    l2NetworkName: 'base',
    l1ChainId,
    l2ChainId: CHAIN_IDS.BASE.BASE_TESTNET.toString(),
    l1MessengerAddress: '0x8e5693140eA606bcEB98761d9beB1BC87383706D',
    l2TokenBridgeAddress: '0x4200000000000000000000000000000000000010',
    l2MessengerAddress: '0x4200000000000000000000000000000000000007',
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.ETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.BASE_TESTNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      USDT: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.USDT,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.BASE_TESTNET.USDT,
        ...DEFAULT_NETWORK_DATA.USDT
      },
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.BASE_TESTNET.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      },
      UNI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.UNI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.BASE_TESTNET.UNI,
        ...DEFAULT_NETWORK_DATA.UNI
      },
    }
  },
  scroll: {
    l2NetworkName: 'scroll',
    l1ChainId,
    l2ChainId: CHAIN_IDS.SCROLL.SCROLL_TESTNET.toString(),
    l1MessengerAddress: '0x5260e38080BFe97e6C4925d9209eCc5f964373b6',
    l2TokenBridgeAddress: '0x0000000000000000000000000000000000000000',
    l2MessengerAddress: '0xb75d7e84517e1504C151B270255B087Fd746D34C',
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.ETH,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.SCROLL_TESTNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      }
    }
  },
  polygonzk: {
    l2NetworkName: 'polygonzk',
    l1ChainId,
    l2ChainId: CHAIN_IDS.POLYGONZK.POLYGONZK_TESTNET.toString(),
    l1MessengerAddress: '0xF6BEEeBB578e214CA9E23B0e9683454Ff88Ed2A7',
    l2TokenBridgeAddress: '0x0000000000000000000000000000000000000000',
    l2MessengerAddress: '0xF6BEEeBB578e214CA9E23B0e9683454Ff88Ed2A7',
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.GOERLI.ETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.POLYGONZK_TESTNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      }
    }
  }
}
