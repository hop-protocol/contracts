import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { getAllSupportedChainIds } from './utils'

export const CHAIN_IDS = {
  ETHEREUM: {
    MAINNET: BigNumber.from('1'),
    GOERLI: BigNumber.from('5'),
    KOVAN: BigNumber.from('42'),
  },
  OPTIMISM: {
    SYNTHETIX_DEMO: BigNumber.from('10'),
    TESTNET_1: BigNumber.from('420'),
    HOP_TESTNET: BigNumber.from('69'),
  },
  ARBITRUM: {
    TESTNET_2: BigNumber.from('152709604825713'),
    TESTNET_3: BigNumber.from('79377087078960')
  }
}

export const ALL_SUPPORTED_CHAIN_IDS: string[] = getAllSupportedChainIds(CHAIN_IDS)

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ONE_ADDRESS = '0x0000000000000000000000000000000000000001'
export const MAX_APPROVAL = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
export const ARB_CHAIN_ADDRESS = '0x2e8aF9f74046D3E55202Fcfb893348316B142230'

export const DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT = 8000000
export const DEFAULT_MESSENGER_WRAPPER_GAS_PRICE = 0
export const DEFAULT_MESSENGER_WRAPPER_GAS_CALL_VALUE = 0
export const DEFAULT_MESSENGER_WRAPPER_SUB_MESSAGE_TYPE = '0x01'

export const DEFAULT_AMOUNT_OUT_MIN = 0
export const DEFAULT_DEADLINE = 9999999999

export const USER_INITIAL_BALANCE = BigNumber.from(parseEther('10'))
export const LIQUIDITY_PROVIDER_INITIAL_BALANCE = BigNumber.from(parseEther('1000'))
export const LIQUIDITY_PROVIDER_UNISWAP_AMOUNT = LIQUIDITY_PROVIDER_INITIAL_BALANCE.div(2)
export const BONDER_INITIAL_BALANCE = BigNumber.from(parseEther('1000'))
export const CHALLENGER_INITIAL_BALANCE = BigNumber.from(parseEther('1'))

export const TRANSFER_AMOUNT = BigNumber.from(parseEther('10'))
export const RELAYER_FEE = BigNumber.from(parseEther('1'))

export const UNISWAP_LP_MINIMUM_LIQUIDITY = BigNumber.from('1000')