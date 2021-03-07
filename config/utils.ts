import { BigNumber, utils as ethersUtils } from 'ethers'
import { IGetMessengerWrapperDefaults, IGetL2BridgeDefaults } from './interfaces'
import {
  CHAIN_IDS,
  DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT,
  ARB_CHAIN_ADDRESS,
  DEFAULT_MESSENGER_WRAPPER_SUB_MESSAGE_TYPE,
  DEFAULT_MESSENGER_WRAPPER_GAS_PRICE,
  DEFAULT_MESSENGER_WRAPPER_GAS_CALL_VALUE
} from './constants'

export const getMessengerWrapperDefaults = (
  chainId: BigNumber,
  l1BridgeAddress: string,
  l2BridgeAddress: string,
  l1MessengerAddress: string
): IGetMessengerWrapperDefaults[] => {
  let defaults: IGetMessengerWrapperDefaults[] = []

  let additionalData = []
  let gasLimit: number

  if (isChainIdArbitrum(chainId)) {
    gasLimit = DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT

    additionalData.push(
      ARB_CHAIN_ADDRESS,
      DEFAULT_MESSENGER_WRAPPER_SUB_MESSAGE_TYPE,
      DEFAULT_MESSENGER_WRAPPER_GAS_PRICE,
      DEFAULT_MESSENGER_WRAPPER_GAS_CALL_VALUE
    )
  } else if (isChainIdOptimism(chainId)) {
    gasLimit = DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT
  } else if (isChainIdXDai(chainId)) {
    gasLimit = 1000000

    additionalData.push(
      chainId.toString()
    )
  }

  defaults.push(
    l1BridgeAddress,
    l2BridgeAddress,
    gasLimit,
    l1MessengerAddress
  )

  if (additionalData.length !== 0) {
    defaults.push(...additionalData)
  }

  return defaults
}

export const getL2BridgeDefaults = (
  isProdDeployment: boolean,
  chainId: BigNumber,
  l2MessengerAddress: string,
  governanceAddress: string,
  l2HopBridgeTokenAddress: string,
  l2CanonicalTokenAddress: string,
  l1BridgeAddress: string,
  supportedChainIds: string[],
  bonderAddresses: string[],
  l1ChainId: BigNumber
): IGetL2BridgeDefaults[] => {
  let defaults: IGetL2BridgeDefaults[] = []

  let additionalData = []

  if (!isProdDeployment) {
    defaults.push(chainId)
  }

  if (isChainIdArbitrum(chainId)) {
  } else if (isChainIdOptimism(chainId)) {
    const defaultGasLimit = DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT
    additionalData.push(defaultGasLimit)
  } else if (isChainIdXDai(chainId)) {
    const l1ChainIdBytes32 = ethersUtils.formatBytes32String(l1ChainId.toString())
    additionalData.push(l1ChainIdBytes32)
  }

  defaults.push(
    l2MessengerAddress,
    governanceAddress,
    l2HopBridgeTokenAddress,
    l2CanonicalTokenAddress,
    l1BridgeAddress,
    supportedChainIds,
    bonderAddresses
  )

  if (additionalData.length !== 0) {
    defaults.push(...additionalData)
  }

  return defaults
}

export const isChainIdOptimism = (chainId: BigNumber): boolean => {
  if (
    chainId.eq(CHAIN_IDS.OPTIMISM.TESTNET_1) ||
    chainId.eq(CHAIN_IDS.OPTIMISM.SYNTHETIX_DEMO) ||
    chainId.eq(CHAIN_IDS.OPTIMISM.HOP_TESTNET)
  ) {
    return true
  }

  return false
}

export const isChainIdArbitrum = (chainId: BigNumber): boolean => {
  if (
    chainId.eq(CHAIN_IDS.ARBITRUM.TESTNET_2) ||
    chainId.eq(CHAIN_IDS.ARBITRUM.TESTNET_3)
  ) {
    return true
  }

  return false
}

export const isChainIdXDai = (chainId: BigNumber): boolean => {
  if (
    chainId.eq(CHAIN_IDS.XDAI.SOKOL)
  ) {
    return true
  }

  return false
}

// Create an array of strings for each supported chain ID
export const getAllSupportedChainIds = (obj: any): string[] =>
  obj && obj instanceof Object
    ? Object.values(obj)
        .map(getAllSupportedChainIds)
        .reduce((a: string[], b: any) => a.concat(b), [] as any[])
        .filter((a: any) => typeof a === 'string')
    : [obj]

