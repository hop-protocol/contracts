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
export const DEFAULT_ADMIN_ROLE_HASH: string = '0x0000000000000000000000000000000000000000000000000000000000000000'
export const ARBITRARY_ROOT_HASH: string =
  '0x7465737400000000000000000000000000000000000000000000000000000000'
export const ARBITRARY_TRANSFER_NONCE: string =
  '0x7465737400000000000000000000000000000000000000000000000000000000'
export const MAX_APPROVAL: BigNumber = BigNumber.from(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
)

export const DEFAULT_L2_BRIDGE_GAS_LIMIT: number = 250000
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

export const STATE_SENDER_ADDRESSES: any = {
  MAINNET: '0x28e4F3a7f651294B9564800b2D01f35189A5bFbE',
  GOERLI: '0xEAa852323826C71cd7920C3b4c007184234c3945'
}

export const CHECKPOINT_MANAGER_ADDRESSES: any = {
  MAINNET: '0x86E4Dc95c7FBdBf52e33D563BbDB00823894C287',
  GOERLI: '0x2890bA17EfE978480615e330ecB65333b880928e'
}

export const ERC20_PREDICATE_ADDRESSES: any = {
  MAINNET: '0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf',
  GOERLI: '0xdD6596F2029e6233DEFfaCa316e6A95217d4Dc34'
}

export const COMMON_SYMBOLS: { [key: string]: string } = {
  DAI: 'DAI',
  sETH: 'sETH',
  sBTC: 'sBTC',
  USDC: 'USDC',
  WBTC: 'WBTC',
  TST: 'TST'
}
