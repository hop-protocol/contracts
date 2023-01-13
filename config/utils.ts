import { BigNumber, utils as ethersUtils } from 'ethers'
import {
  IGetL2BridgeDefaults
} from './interfaces'
import {
  CHAIN_IDS,
  CHAIN_IDS_TO_ACTIVATE,
  DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT,
  DEFAULT_L2_BRIDGE_GAS_LIMIT,
  CHECKPOINT_MANAGER_ADDRESSES,
  FX_ROOT_ADDRESSES,
  FX_CHILD_ADDRESSES,
  POLYGON_RPC_ENDPOINTS,
  AMB_PROXY_ADDRESSES,
  DEFAULT_MAX_SUBMISSION_COST,
  DEFAULT_MAX_GAS,
  DEFAULT_GAS_PRICE_BID
} from './constants'

export interface Overrides {
  gasLimit?: number
  gasPrice?: number
}

export const getMessengerWrapperDefaults = (
  l1ChainId: BigNumber,
  l2ChainId: BigNumber,
  l1BridgeAddress: string,
  l2BridgeAddress: string,
  l1MessengerAddress: string,
  fxChildTunnelAddress: string,
  fxRootAddress: string = undefined
): any[] => {
  // Ending data to return
  let data: any = []

  // Defaults for most chains
  let defaults: any[] = [
    l1BridgeAddress,
    l2BridgeAddress,
    l1MessengerAddress
  ]

  if (isChainIdArbitrum(l2ChainId) || isChainIdNova(l2ChainId)) {
    data.push(
      ...defaults
    )
  } else if (isChainIdOptimism(l2ChainId)) {
    const gasLimit: number = DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT

    data.push(
      ...defaults,
      gasLimit
    )
  } else if (isChainIdXDai(l2ChainId)) {
    const gasLimit: number = 1000000
    const ambAddress: string = getXDaiAmbAddresses(l1ChainId)

    data.push(
      ...defaults,
      gasLimit,
      l2ChainId.toString(),
      ambAddress
    )
  } else if (isChainIdPolygon(l2ChainId)) {
    const checkpointManager: string = getPolygonCheckpointManagerAddress(l1ChainId)
    fxRootAddress = fxRootAddress || getPolygonFxRootAddress(l1ChainId)

    data.push(
      l1BridgeAddress,
      checkpointManager,
      fxRootAddress,
      fxChildTunnelAddress
    )
  } else if (isChainIdConsensys(l2ChainId)) {
    // TODO Consensys
  }

  return data
}

export const getL2BridgeDefaults = (
  chainId: BigNumber,
  l2MessengerAddress: string,
  l2MessengerProxyAddress: string,
  governanceAddress: string,
  l2HopBridgeTokenAddress: string,
  l1BridgeAddress: string,
  activeChainIds: BigNumber[],
  bonderAddresses: string[],
  l1ChainId: BigNumber
): IGetL2BridgeDefaults[] => {
  let defaults: IGetL2BridgeDefaults[] = []

  let actualL2MessengerAddress: string = l2MessengerAddress
  let additionalData = []

  if (isChainIdArbitrum(chainId) || isChainIdNova(chainId)) {
    governanceAddress = generateArbitrumAliasAddress(governanceAddress)
  } else if (isChainIdOptimism(chainId)) {
    const defaultGasLimit = DEFAULT_L2_BRIDGE_GAS_LIMIT
    additionalData.push(defaultGasLimit)
  } else if (isChainIdXDai(chainId)) {
    additionalData.push(
      l1ChainId,
      DEFAULT_L2_BRIDGE_GAS_LIMIT
    )
  } else if (isChainIdPolygon(chainId)) {
    actualL2MessengerAddress = l2MessengerProxyAddress
  } else if (isChainIdConsensys(chainId)) {
    // TODO: Consensys
  }

  defaults.push(
    actualL2MessengerAddress,
    governanceAddress,
    l2HopBridgeTokenAddress,
    l1BridgeAddress,
    activeChainIds,
    bonderAddresses
  )

  if (additionalData.length !== 0) {
    defaults.push(...additionalData)
  }

  return defaults
}

export const isChainIdOptimism = (chainId: BigNumber): boolean => {
  if (
    chainId.eq(CHAIN_IDS.OPTIMISM.OPTIMISM_TESTNET) ||
    chainId.eq(CHAIN_IDS.OPTIMISM.OPTIMISM_MAINNET)
  ) {
    return true
  }

  return false
}

export const isChainIdArbitrum = (chainId: BigNumber): boolean => {
  if (
    chainId.eq(CHAIN_IDS.ARBITRUM.ARBITRUM_TESTNET) ||
    chainId.eq(CHAIN_IDS.ARBITRUM.ARBITRUM_MAINNET)
  ) {
    return true
  }

  return false
}

export const isChainIdNova = (chainId: BigNumber): boolean => {
  if (
    chainId.eq(CHAIN_IDS.NOVA.NOVA_MAINNET)
  ) {
    return true
  }

  return false
}

export const isChainIdXDai = (chainId: BigNumber): boolean => {
  if (
      chainId.eq(CHAIN_IDS.XDAI.XDAI)
  ) {
    return true
  }

  return false
}

export const isChainIdPolygon = (chainId: BigNumber): boolean => {
  if (
    chainId.eq(CHAIN_IDS.POLYGON.MUMBAI) ||
    chainId.eq(CHAIN_IDS.POLYGON.POLYGON)
  ) {
    return true
  }

  return false
}

export const isChainIdConsensys = (chainId: BigNumber): boolean => {
  if (
    chainId.eq(CHAIN_IDS.CONSENSYS.CONSENSYS_TESTNET)
  ) {
    return true
  }

  return false
}

export const isChainIdMainnet = (chainId: BigNumber): boolean => {
  if (
    chainId.eq(CHAIN_IDS.ETHEREUM.MAINNET)
  ) {
    return true
  }

  return false
}

export const isChainIdGoerli = (chainId: BigNumber): boolean => {
  if (
    chainId.eq(CHAIN_IDS.ETHEREUM.GOERLI)
  ) {
    return true
  }

  return false
}

export const isChainIdL1 = (chainId: BigNumber): boolean => {
  if (
    isChainIdMainnet(chainId) ||
    isChainIdGoerli(chainId)
  ) {
    return true
  }

  return false
}

export const isChainIdTestnet = (chainId: BigNumber): boolean => {
  if (
    chainId.eq(CHAIN_IDS.ETHEREUM.GOERLI) ||
    chainId.eq(CHAIN_IDS.POLYGON.MUMBAI) ||
    chainId.eq(CHAIN_IDS.ARBITRUM.ARBITRUM_TESTNET) ||
    chainId.eq(CHAIN_IDS.OPTIMISM.OPTIMISM_TESTNET) ||
    chainId.eq(CHAIN_IDS.CONSENSYS.CONSENSYS_TESTNET)
  ) {
    return true
  }

  return false
}

export const getXDaiAmbAddresses = (l1ChainId: BigNumber): string => {
  if (isChainIdMainnet(l1ChainId)) {
    return AMB_PROXY_ADDRESSES.MAINNET
  } else {
    throw new Error('Invalid Chain ID')
  }
}

// Create an array of strings for each supported chain ID
export const getAllActiveChainIds = (obj: any): string[] =>
  obj && obj instanceof Object
    ? Object.values(obj)
        .map(getAllActiveChainIds)
        .reduce((a: string[], b: any) => a.concat(b), [] as any[])
        .filter((a: any) => typeof a === 'string')
    : [obj]

export const getPolygonRpcEndpoint = (l1ChainId: BigNumber): string => {
  if (isChainIdMainnet(l1ChainId)) {
    return POLYGON_RPC_ENDPOINTS.MAINNET
  } else if (isChainIdGoerli(l1ChainId)) {
    return POLYGON_RPC_ENDPOINTS.GOERLI
  } else {
    throw new Error('Invalid Chain ID')
  }
}

export const getPolygonCheckpointManagerAddress = (l1ChainId: BigNumber): string => {
  if (isChainIdMainnet(l1ChainId)) {
    return CHECKPOINT_MANAGER_ADDRESSES.MAINNET
  } else if (isChainIdGoerli(l1ChainId)) {
    return CHECKPOINT_MANAGER_ADDRESSES.GOERLI
  } else {
    throw new Error('Invalid Chain ID')
  }
}

export const getPolygonFxRootAddress = (l1ChainId: BigNumber): string => {
  if (isChainIdMainnet(l1ChainId)) {
    return FX_ROOT_ADDRESSES.MAINNET
  } else if (isChainIdGoerli(l1ChainId)) {
    return FX_ROOT_ADDRESSES.GOERLI
  } else {
    throw new Error('Invalid Chain ID')
  }
}

export const getPolygonFxChildAddress = (l1ChainId: BigNumber): string => {
  if (isChainIdMainnet(l1ChainId)) {
    return FX_CHILD_ADDRESSES.MAINNET
  } else if (isChainIdGoerli(l1ChainId)) {
    return FX_CHILD_ADDRESSES.GOERLI
  } else {
    throw new Error('Invalid Chain ID')
  }
}

export const generateArbitrumAliasAddress = (address: string): string => {
  const addressBn: BigNumber = BigNumber.from(address)
  const aliasMask: string = '0x1111000000000000000000000000000000001111'
  const aliasMaskBn: BigNumber = BigNumber.from(aliasMask)
  const boundary: BigNumber = BigNumber.from('0x10000000000000000000000000000000000000000')
  return ((addressBn.add(aliasMaskBn)).mod(boundary)).toHexString()
}

export const getTxOverridesPerChain = (l2ChainId: BigNumber): Overrides => {
  if (isChainIdOptimism(l2ChainId) || isChainIdArbitrum(l2ChainId) || isChainIdNova(l2ChainId)) {
    return {}
  } else if (isChainIdXDai(l2ChainId)) {
    return {
      gasLimit: 4_500_000
    }
  } else if (isChainIdPolygon(l2ChainId)) {
    return {
      // For Mumbai, a gasPrice any lower than this will not get mined
      gasPrice: 100_000_000_000,
      // A polygon transactions require this much gas
      gasLimit: 4_500_000
    }
  }
}

export const getActiveChainIds = (chainId: BigNumber): BigNumber[] => {
  const network = isChainIdTestnet(chainId) ? 'TESTNET' : 'MAINNET'
  const chainIds = CHAIN_IDS_TO_ACTIVATE[network]
  const allActiveChainIds: BigNumber[] = (Object.values(
    chainIds
  ) as any[]).reduce((a: any[], b: any) => [...a, ...Object.values(b)], [])

  return allActiveChainIds.filter(activeChainId => activeChainId.toString() !== chainId.toString())
}