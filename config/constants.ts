import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'

export const CHAIN_IDS: any = {
  ETHEREUM: {
    MAINNET: BigNumber.from('1'),
    GOERLI: BigNumber.from('5'),
    KOVAN: BigNumber.from('42')
  },
  OPTIMISM: {
    SYNTHETIX_DEMO: BigNumber.from('10'),
    TESTNET_1: BigNumber.from('420'),
    HOP_TESTNET: BigNumber.from('69')
  },
  ARBITRUM: {
    TESTNET_2: BigNumber.from('152709604825713'),
    TESTNET_3: BigNumber.from('79377087078960'),
    TESTNET_4: BigNumber.from('212984383488152')
  },
  XDAI: {
    XDAI: BigNumber.from('100'),
    SOKOL: BigNumber.from('77')
  },
  POLYGON: {
    POLYGON: BigNumber.from('137'),
    MUMBAI: BigNumber.from('80001')
  }
}

export const ALL_SUPPORTED_CHAIN_IDS: string[] = (Object.values(
  CHAIN_IDS
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
export const DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT: number = 8000000
export const DEFAULT_MESSENGER_WRAPPER_GAS_PRICE: number = 0
export const DEFAULT_MESSENGER_WRAPPER_CALL_VALUE: number = 0

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

export const DEFAULT_ETHERS_OVERRIDES = {
  gasLimit: 2500000
}

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
  MAINNET: 'https://polygon.rpc.hop.exchange',
  GOERLI: 'https://mumbai.rpc.hop.exchange'
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

export const ERC20_PREDICATE_ADDRESSES: any = {
  MAINNET: '0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf',
  GOERLI: '0xdD6596F2029e6233DEFfaCa316e6A95217d4Dc34'
}

export const ERC20_MINTABLE_PREDICATE_ADDRESSES: any = {
  MAINNET: '0x9923263fA127b3d1484cFD649df8f1831c2A74e4',
  GOERLI: '0x37c3bfC05d5ebF9EBb3FF80ce0bd0133Bf221BC8'
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
  MAINNET: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
  KOVAN: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560'
}

export const L1_CANONICAL_TOKEN_ADDRESSES: any = {
  MAINNET: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  GOERLI: {
    DAI: '0xC61bA16e864eFbd06a9fe30Aab39D18B8F63710a',
    sETH: '0x5D13179c5fa40b87D53Ff67ca26245D3D5B2F872',
    sBTC: '0x12a3a66720dD925fa93f7C895bC20Ca9560AdFe7',
    USDC: '0x98339D8C260052B7ad81c28c16C0b98420f2B46a',
    WBTC: '0xCB784a097f33231f2D3a1E22B236a9D2c878555d'
  },
  KOVAN: {
    DAI: '0x436e3FfB93A4763575E5C0F6b3c97D5489E050da',
    sETH: '0x7EE6109672c07Dcf97435C8238835EFF5D6E89FD',
    sBTC: '0x7a4f56B0Dd21d730604A266245a0067b97605DAE',
    USDC: '0xA46d09fd4B7961aE16D33122660f43726cB1Ff36',
    WBTC: '0x1E1a556D2166A006e662864D376e8DD249087150'
  }
}

export const L2_CANONICAL_TOKEN_ADDRESSES: any = {
  POLYGON: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
  },
  MUMBAI: {
    DAI: '0xb224913CE3851b0a0d7C0FB461eEF40f2e31ddb8',
    sETH: '0x61F00BD6995A087F84BCcA62dCC835905f2a9207',
    sBTC: '0xe5BEd2355E575b32B0e151EA6577Dfe05FaE5484',
    USDC: '0x6D4dd09982853F08d9966aC3cA4Eb5885F16f2b2',
    WBTC: '0x90ac599445B07c8aa0FC82248f51f6558136203D'
  },
  XDAI: {
    USDC: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83'
  },
  SOKOL: {
    DAI: '0x6D2d8B29d92cab87a273e872FcC4650A64116283',
    sETH: '0xeC3B005D2BF47f505F1A0cD68eEb7Ea439D6daF6',
    sBTC: '0x696ED254EC9bD27328d5ef81905042913260eccd',
    USDC: '0x3b0977b9e563F63F219019616BBD12cB1cdFF527',
    WBTC: '0x94490EF228D4aBD189694f86D1684D972431380b'
  },
  OPTIMISM: {
    KOVAN: {
      DAI: '0xFB6528eFbEe8B900CeBf2c4Cf709b1EF36D46A60',
      sETH: 'TODO',
      sBTC: 'TODO',
      USDC: '0x3b8e53B3aB8E01Fb57D0c9E893bC4d655AA67d84',
      WBTC: 'TODO'
    },
    GOERLI: {
      // TODO
    }
  },
  ARBITRUM: {
    DAI: '0xFa226E8B73Acaafeb29fEcd601afBEC8b1208986'
  }
}

export const COMMON_SYMBOLS: { [key: string]: string } = {
  DAI: 'DAI',
  sETH: 'sETH',
  sBTC: 'sBTC',
  USDC: 'USDC',
  WBTC: 'WBTC',
  TST: 'TST'
}

export const GAS_PRICE_MULTIPLIERS: { [key: string]: number } = {
  MAINNET: 1.5,
  TESTNET: 10
}
