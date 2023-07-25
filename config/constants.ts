require('dotenv').config()

import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'

export const CHAIN_IDS: any = {
  ETHEREUM: {
    MAINNET: BigNumber.from('1'),
    GOERLI: BigNumber.from('5')
  },
  OPTIMISM: {
    OPTIMISM_TESTNET: BigNumber.from('420'),
    OPTIMISM_MAINNET: BigNumber.from('10')
  },
  ARBITRUM: {
    ARBITRUM_TESTNET: BigNumber.from('421613'),
    ARBITRUM_MAINNET: BigNumber.from('42161')
  },
  XDAI: {
    XDAI: BigNumber.from('100')
  },
  POLYGON: {
    POLYGON: BigNumber.from('137'),
    MUMBAI: BigNumber.from('80001')
  },
  NOVA: {
    NOVA_MAINNET: BigNumber.from('42170')
  },
  CONSENSYS: {
    CONSENSYS_TESTNET: BigNumber.from('59140')
  },
  ZKSYNC: {
    ZKSYNC_TESTNET: BigNumber.from('280')
  },
  BASE: {
    BASE_MAINNET: BigNumber.from('8453'),
    BASE_TESTNET: BigNumber.from('84531')
  },
  SCROLL: {
    SCROLL_TESTNET: BigNumber.from('534353')
  },
  POLYGONZK: {
    POLYGONZK_MAINNET: BigNumber.from('1101'),
    POLYGONZK_TESTNET: BigNumber.from('1442')
  },
}

export const CHAIN_IDS_TO_ACTIVATE: any = {
  MAINNET: {
    ETHEREUM: {
      MAINNET: BigNumber.from('1')
    },
    XDAI: {
      XDAI: BigNumber.from('100')
    },
    POLYGON: {
      POLYGON: BigNumber.from('137')
    },
    OPTIMISM: {
      OPTIMISM_MAINNET: BigNumber.from('10')
    },
    ARBITRUM: {
      ARBITRUM_MAINNET: BigNumber.from('42161')
    },
    NOVA: {
      NOVA_MAINNET: BigNumber.from('42170')
    },
    BASE: {
      BASE_MAINNET: BigNumber.from('8453')
    },
    POLYGONZK: {
      POLYGONZK_MAINNET: BigNumber.from('1101')
    }
  },
  TESTNET: {
    ETHEREUM: {
      MAINNET: BigNumber.from('5')
    },
    POLYGON: {
      MUMBAI: BigNumber.from('80001')
    },
    OPTIMISM: {
      OPTIMISM_TESTNET: BigNumber.from('420')
    },
    ARBITRUM: {
      ARBITRUM_TESTNET: BigNumber.from('421613')
    },
    CONSENSYS: {
      CONSENSYS_TESTNET: BigNumber.from('59140')
    },
    ZKSYNC: {
      ZKSYNC_TESTNET: BigNumber.from('280')
    },
    BASE: {
      BASE_TESTNET: BigNumber.from('84531')
    },
    SCROLL: {
      SCROLL_TESTNET: BigNumber.from('534353')
    },
    POLYGONZK: {
      POLYGONZK_TESTNET: BigNumber.from('1442')
    }
  }
}

export const ALL_SUPPORTED_CHAIN_IDS: BigNumber[] = (Object.values(
  CHAIN_IDS_TO_ACTIVATE
) as any[]).reduce((a: any[], b: any) => [...a, ...Object.values(b)], [])

export const ZERO_ADDRESS: string = '0x0000000000000000000000000000000000000000'
export const ONE_ADDRESS: string = '0x0000000000000000000000000000000000000001'
export const DEAD_ADDRESS: string = '0x000000000000000000000000000000000000dEaD'
export const ARBITRARY_ROOT_HASH: string =
  '0x7465737400000000000000000000000000000000000000000000000000000000'
export const ARBITRARY_TRANSFER_NONCE: string =
  '0x7465737400000000000000000000000000000000000000000000000000000000'
export const MAX_APPROVAL: BigNumber = BigNumber.from(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
)

export const DEFAULT_L2_BRIDGE_GAS_LIMIT: number = 500000
export const DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT: number = 150000
export const DEFAULT_OPTIMISM_MESSENGER_WRAPPER_GAS_LIMIT: number = 150000
export const DEFAULT_MESSENGER_WRAPPER_GAS_PRICE: number = 0
export const DEFAULT_MESSENGER_WRAPPER_CALL_VALUE: number = 0

export const DEFAULT_MAX_GAS: number = 5000000
export const DEFAULT_GAS_PRICE_BID: number = 100000000000

export const DEFAULT_AMOUNT_OUT_MIN: number = 0
export const DEFAULT_DEADLINE: BigNumber = BigNumber.from('9999999999')

export const MAX_NUM_SENDS_BEFORE_COMMIT: number = 100

export const USER_INITIAL_BALANCE: BigNumber = BigNumber.from(parseEther('10'))
export const LIQUIDITY_PROVIDER_INITIAL_BALANCE: BigNumber = BigNumber.from(
  parseEther('1000')
)
export const LIQUIDITY_PROVIDER_AMM_AMOUNT: BigNumber = LIQUIDITY_PROVIDER_INITIAL_BALANCE.div(
  2
)

export const BONDER_INITIAL_BALANCE: BigNumber = BigNumber.from(
  parseEther('10000')
)
export const INITIAL_BONDED_AMOUNT: BigNumber = BONDER_INITIAL_BALANCE.div(5)
export const CHALLENGER_INITIAL_BALANCE: BigNumber = BigNumber.from(
  parseEther('1')
)
export const RELAYER_INITIAL_BALANCE: BigNumber = BigNumber.from(
  parseEther('10')
)

export const TRANSFER_AMOUNT: BigNumber = BigNumber.from(parseEther('5'))
export const DEFAULT_BONDER_FEE: BigNumber = BigNumber.from(parseEther('1'))
export const DEFAULT_RELAYER_FEE: BigNumber = BigNumber.from(parseEther('0'))

export const AMM_LP_MINIMUM_LIQUIDITY: BigNumber = BigNumber.from('1000')

export const DEFAULT_H_BRIDGE_TOKEN_NAME = 'DAI Hop Token'
export const DEFAULT_H_BRIDGE_TOKEN_SYMBOL = 'hDAI'
export const DEFAULT_H_BRIDGE_TOKEN_DECIMALS = 18

export const SECONDS_IN_A_MINUTE: number = 60
export const SECONDS_IN_AN_HOUR: number = 60 * SECONDS_IN_A_MINUTE
export const SECONDS_IN_A_DAY: number = 24 * SECONDS_IN_AN_HOUR
export const SECONDS_IN_A_WEEK: number = 7 * SECONDS_IN_A_DAY
export const DEFAULT_TIME_TO_WAIT: number = 0
export const TIMESTAMP_VARIANCE: number = 1000000

export const C_TO_H_SWAP_INDICES: string[] = ['0', '1']
export const H_TO_C_SWAP_INDICES: string[] = ['1', '0']

export const DEFAULT_SWAP_DECIMALS: string[] = ['18', '18']
export const DEFAULT_SWAP_LP_TOKEN_NAME: string = 'Hop DAI LP Token'
export const DEFAULT_SWAP_LP_TOKEN_SYMBOL: string = 'HOP-LP-DAI'
export const DEFAULT_SWAP_A: string = '200'
export const DEFAULT_SWAP_FEE: string = '4000000'
export const DEFAULT_SWAP_ADMIN_FEE: string = '0'
export const DEFAULT_SWAP_WITHDRAWAL_FEE: string = '0'

export const POLYGON_RPC_ENDPOINTS: any = {
  MAINNET: process.env.RPC_ENDPOINT_POLYGON,
  GOERLI: process.env.RPC_ENDPOINT_MUMBAI
}

export const FX_ROOT_ADDRESSES: any = {
  MAINNET: '0xfe5e5D361b2ad62c541bAb87C45a0B9B018389a2',
  GOERLI: '0x3d1d3E34f7fB6D26245E6640E1c50710eFFf15bA'
}

export const FX_CHILD_ADDRESSES: any = {
  MAINNET: '0x8397259c983751DAf40400790063935a11afa28a',
  GOERLI: '0xCf73231F28B7331BBe3124B907840A94851f9f11'
}

export const CHECKPOINT_MANAGER_ADDRESSES: any = {
  MAINNET: '0x86e4dc95c7fbdbf52e33d563bbdb00823894c287',
  GOERLI: '0x2890bA17EfE978480615e330ecB65333b880928e'
}

export const ERC721_MINTABLE_PREDICATE_ADDRESSES: any = {
  MAINNET: '0x932532aA4c0174b8453839A6E44eE09Cc615F2b7',
  GOERLI: '0x56E14C4C1748a818a5564D33cF774c59EB3eDF59'
}

export const ERC1155_MINTABLE_PREDICATE_ADDRESSES: any = {
  MAINNET: '0x2d641867411650cd05dB93B59964536b1ED5b1B7',
  GOERLI: '0x72d6066F486bd0052eefB9114B66ae40e0A6031a'
}

export const AMB_PROXY_ADDRESSES: any = {
  MAINNET: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e'
}

export const L1_CANONICAL_TOKEN_ADDRESSES: any = {
  MAINNET: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    MATIC: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    ETH: '0x0000000000000000000000000000000000000000',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    FRAX: '0x853d955aCEf822Db058eb8505911ED77F175b99e',
    HOP: '0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC',
    SNX: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F',
    sUSD: '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51',
    rETH: '0xae78736Cd615f374D3085123A210448E74Fc6393',
    MAGIC: '0xB0c7a3Ba49C7a6EaBa6cD4a96C55a1391070Ac9A',
  },
  GOERLI: {
    ETH: '0x0000000000000000000000000000000000000000',
    HOP: '0x38aF6928BF1Fd6B3c768752e716C49eb8206e20c', // Omnichain
    USDT: '0xfad6367E97217cC51b4cd838Cc086831f81d38C2', // Omnichain
    DAI: '0xb93cba7013f4557cDFB590fD152d24Ef4063485f', // Omnichain
    UNI: '0x41E5E6045f91B61AACC99edca0967D518fB44CFB', // Omnichain
    USDC: '0x07865c6e87b9f70255377e024ace6630c1eaa37f', // Circle
  }
}

export const L2_CANONICAL_TOKEN_ADDRESSES: any = {
  POLYGON: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    MATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    ETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    FRAX: '0x45c32fA6DF82ead1e2EF74d17b76547EDdFaFF89',
    HOP: '0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC'
  },
  XDAI: {
    USDC: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
    USDT: '0x4ECaBa5870353805a9F068101A40E0f32ed605C6',
    MATIC: '0x7122d7661c4564b7C6Cd4878B06766489a6028A2',
    DAI: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
    ETH: '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
    WBTC: '0x8e5bBbb09Ed1ebdE8674Cda39A0c169401db4252',
    HOP: '0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC'
  },
  OPTIMISM_MAINNET: {
    USDC: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    ETH: '0x4200000000000000000000000000000000000006',
    WBTC: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
    FRAX: '0x2E3D870790dC77A83DD1d18184Acc7439A53f475',
    HOP: '0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC',
    SNX: '0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4',
    sUSD: '0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9',
    rETH: '0x9Bcef72be871e61ED4fBbc7630889beE758eb81D'
  },
  ARBITRUM_MAINNET: {
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    ETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    FRAX: '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F',
    HOP: '0xc5102fE9359FD9a28f877a67E36B0F050d81a3CC',
    rETH: '0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8',
    MAGIC: '0x539bdE0d7Dbd336b79148AA742883198BBF60342'
  },
  MUMBAI: {
    ETH: '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa', // Canonical deployment
    HOP: '0x6F03052743CD99ce1b29265E377e320CD24Eb632', // Omnichain
    USDT: '0xF86c14f015AcFb14a88C0d3eB51b51e4637ABa3c', // Omnichain
    DAI: '0xaC9BABf20eF2338D7F4a152Af43bedDC80C6ae2a', // Omnichain
    UNI: '0x70A772DDc3413e3456e5A3b2C30cB749C9577d1F', // Omnichain
  },
  OPTIMISM_TESTNET: {
    ETH: '0xDc38c5aF436B9652225f92c370A011C673FA7Ba5', // Our deployment
    HOP: '0x579F3d41C6C9EA61001A960f475683C021dFd571', // Omnichain
    USDT: '0x33ceb27b39d2Bb7D2e61F7564d3Df29344020417', // Omnichain
    DAI: '0x91f8490eC27cbB1b2FaEdd29c2eC23011d7355FB', // Omnichain
    UNI: '0x4b95e110178d51ef406c225462748a3f739d99da', // Omnichain
  },
  ARBITRUM_TESTNET: {
    ETH: '0xcb5ddfb8d0038247dc0beeecaa7f3457befcb77c', // Our deployment
    HOP: '0x1990BC6dfe2ef605Bfc08f5A23564dB75642Ad73', // Omnichain
    USDT: '0x30bD2A2fD99372B53C6a226751a4b65D48941866', // Omnichain
    DAI: '0x76AB3512f3bfa0f5a9E10E584b44ca2dA9fE248d', // Omnichain
    UNI: '0x6B8B75C66D808Ab236d8A7996636521a12E374D8', // Omnichain
  },
  NOVA_MAINNET: {
    ETH: '0x722E8BdD2ce80A4422E880164f2079488e115365',
    MAGIC: '0xe8936ac97A85d708d5312D52C30c18d4533b8A9c'
  },
  CONSENSYS_TESTNET: {
    ETH: '0x2C1b868d6596a18e32E61B901E4060C872647b6C', // Canonical deployment
    HOP: '0x6F03052743CD99ce1b29265E377e320CD24Eb632', // Omnichain
    USDT: '0x1990BC6dfe2ef605Bfc08f5A23564dB75642Ad73', // Omnichain
    DAI: '0x8741Ba6225A6BF91f9D73531A98A89807857a2B3', // Omnichain
    UNI: '0x7823E8DCC8bfc23EA3AC899EB86921f90e80F499', // Omnichain
    USDC: '0xf56dc6695cF1f5c364eDEbC7Dc7077ac9B586068', // Linea
  },
  ZKSYNC_TESTNET: {
    ETH: '0xE4c2573bD4125270b356444B2F551c3406baC6a2' // Our deployment
  },
  BASE_TESTNET: {
    ETH: '0x4200000000000000000000000000000000000006', // Canonical deployment
    HOP: '0x0ce6c85cF43553DE10FC56cecA0aef6Ff0DD444d', // Omnichain
    USDT: '0xC1985d7a3429cDC85E59E2E4Fcc805b857e6Ee2E', // Omnichain
    DAI: '0x0a6b1904369fE59E002ad0713ae89d4E3dF5A7Cf', // Omnichain
    UNI: '0xD063875762e760Ee787b11F6Af624058b4841A5a', // Omnichain
  },
  SCROLL_TESTNET: {
    ETH: '0x5300000000000000000000000000000000000004' // Canonical deployment
  },
  POLYGONZK_MAINNET: {
    ETH: '0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9'
  },
  POLYGONZK_TESTNET: {
    ETH: '0x0EEFEe679a77dC411579e520ef7535d526cED1d6' // Our deployment
  },
  BASE_MAINNET: {
    ETH: '0x4200000000000000000000000000000000000006'
  },
}

export const GAS_PRICE_MULTIPLIERS: { [key: string]: number } = {
  MAINNET: 1.3,
  TESTNET: 10
}

export const HOP_DAO_ADDRESS = '0xeeA8422a08258e73c139Fc32a25e10410c14bd7a'
export const CONSENSYS_ZK_EVM_MESSAGE_FEE = '10000000000000000'
export const ZKSYNC_MESSAGE_FEE = 'TODO' // TODO: zksync
export const SCROLL_ZK_EVM_MESSAGE_FEE = '10000000000000000' // TODO

export const DefaultChallengePeriod: string = '86400'
