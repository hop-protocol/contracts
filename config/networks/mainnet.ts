import { NetworkData } from './types'
import { DEFAULT_NETWORK_DATA } from './defaultNetworkData'

import {
  CHAIN_IDS,
  ZERO_ADDRESS,
  L1_CANONICAL_TOKEN_ADDRESSES,
  L2_CANONICAL_TOKEN_ADDRESSES
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
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.POLYGON.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      },
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.ETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.POLYGON.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      WBTC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.WBTC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.POLYGON.WBTC,
        ...DEFAULT_NETWORK_DATA.WBTC
      },
      FRAX: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.FRAX,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.POLYGON.FRAX,
        ...DEFAULT_NETWORK_DATA.FRAX
      },
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.HOP,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.POLYGON.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      }
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
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.DAI,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.XDAI.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      },
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.ETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.XDAI.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      WBTC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.WBTC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.XDAI.WBTC,
        ...DEFAULT_NETWORK_DATA.WBTC
      },
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.HOP,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.XDAI.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      }
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
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.USDC,
        ...DEFAULT_NETWORK_DATA.USDC
      },
      USDT: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.USDT,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.USDT,
        ...DEFAULT_NETWORK_DATA.USDT
      },
      MATIC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.MATIC,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.MATIC,
        ...DEFAULT_NETWORK_DATA.MATIC
      },
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.DAI,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      },
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.ETH,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      WBTC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.WBTC,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.WBTC,
        ...DEFAULT_NETWORK_DATA.WBTC
      },
      FRAX: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.FRAX,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.FRAX,
        ...DEFAULT_NETWORK_DATA.FRAX
      },
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.HOP,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      },
      SNX: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.SNX,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.SNX,
        ...DEFAULT_NETWORK_DATA.SNX
      },
      sUSD: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.sUSD,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.sUSD,
        ...DEFAULT_NETWORK_DATA.sUSD
      },
      rETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.rETH,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.OPTIMISM_MAINNET.rETH,
        ...DEFAULT_NETWORK_DATA.rETH
      }
    }
  },
  arbitrum: {
    l2NetworkName: 'arbitrum',
    l1ChainId,
    l2ChainId: CHAIN_IDS.ARBITRUM.ARBITRUM_MAINNET.toString(),
    l1MessengerAddress: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    l2TokenBridgeAddress: ZERO_ADDRESS,
    l2MessengerAddress: '0x0000000000000000000000000000000000000064',
    tokens: {
      USDC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.USDC,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_MAINNET.USDC,
        ...DEFAULT_NETWORK_DATA.USDC
      },
      USDT: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.USDT,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_MAINNET.USDT,
        ...DEFAULT_NETWORK_DATA.USDT
      },
      DAI: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.DAI,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_MAINNET.DAI,
        ...DEFAULT_NETWORK_DATA.DAI
      },
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.ETH,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_MAINNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      WBTC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.WBTC,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_MAINNET.WBTC,
        ...DEFAULT_NETWORK_DATA.WBTC
      },
      FRAX: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.FRAX,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_MAINNET.FRAX,
        ...DEFAULT_NETWORK_DATA.FRAX
      },
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.HOP,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_MAINNET.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      },
      rETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.rETH,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_MAINNET.rETH,
        ...DEFAULT_NETWORK_DATA.rETH
      },
      MAGIC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.MAGIC,
        l2CanonicalTokenAddress:
          L2_CANONICAL_TOKEN_ADDRESSES.ARBITRUM_MAINNET.MAGIC,
        ...DEFAULT_NETWORK_DATA.MAGIC
      }
    }
  },
  nova: {
    l2NetworkName: 'nova',
    l1ChainId,
    l2ChainId: CHAIN_IDS.NOVA.NOVA_MAINNET.toString(),
    l1MessengerAddress: '0xc4448b71118c9071Bcb9734A0EAc55D18A153949',
    l2TokenBridgeAddress: ZERO_ADDRESS,
    l2MessengerAddress: '0x0000000000000000000000000000000000000064',
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.ETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.NOVA_MAINNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      MAGIC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.MAGIC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.NOVA_MAINNET.MAGIC,
        ...DEFAULT_NETWORK_DATA.MAGIC
      },
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.HOP,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.NOVA_MAINNET.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      }
    }
  },
  polygonzk: {
    l2NetworkName: 'polygonzk',
    l1ChainId,
    l2ChainId: CHAIN_IDS.POLYGONZK.POLYGONZK_MAINNET.toString(),
    l1MessengerAddress: '0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe',
    l2TokenBridgeAddress: ZERO_ADDRESS,
    l2MessengerAddress: '0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe',
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.ETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.POLYGONZK_MAINNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      }
    }
  },
  base: {
    l2NetworkName: 'base',
    l1ChainId,
    l2ChainId: CHAIN_IDS.BASE.BASE_MAINNET.toString(),
    l1MessengerAddress: '0x866E82a600A1414e583f7F13623F1aC5d58b0Afa',
    l2TokenBridgeAddress: ZERO_ADDRESS,
    l2MessengerAddress: '0x4200000000000000000000000000000000000007',
    tokens: {
      ETH: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.ETH,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.BASE_MAINNET.ETH,
        ...DEFAULT_NETWORK_DATA.ETH
      },
      USDC: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.USDC,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.BASE_MAINNET.USDC,
        ...DEFAULT_NETWORK_DATA.USDC
      },
      HOP: {
        l1CanonicalTokenAddress: L1_CANONICAL_TOKEN_ADDRESSES.MAINNET.HOP,
        l2CanonicalTokenAddress: L2_CANONICAL_TOKEN_ADDRESSES.BASE_MAINNET.HOP,
        ...DEFAULT_NETWORK_DATA.HOP
      },
    }
  }
}
