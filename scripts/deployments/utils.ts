import { ContractFactory, Contract, BigNumber, Signer } from 'ethers'
import { CHAIN_IDS } from '../../test/shared/constants'

export const verifyDeployment = async (name: string, contract: Contract, ethers) => {
  const isCodeAtAddress = (await ethers.provider.getCode(contract.address)).length > 100
  if (!isCodeAtAddress) {
    throw new Error('Did not deploy correctly')
  }
}

export const getContractFactories = async (chainId: BigNumber, ethers: any, signer: Signer) => {
  const MockERC20: ContractFactory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20', { signer })
  const L1_Bridge: ContractFactory = await ethers.getContractFactory('contracts/bridges/L1_Bridge.sol:L1_Bridge', { signer })
  const MessengerWrapper: ContractFactory = await ethers.getContractFactory('contracts/wrappers/OptimismMessengerWrapper.sol:OptimismMessengerWrapper', { signer })

  let L2_Bridge: ContractFactory
  let UniswapFactory: ContractFactory
  let UniswapRouter: ContractFactory
  let UniswapPair: ContractFactory

  ;({ 
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair,
  } = await getNetworkSpecificFactories(chainId, ethers, signer))

  return {
    MockERC20,
    L1_Bridge,
    MessengerWrapper,
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair,
  }
}

const getNetworkSpecificFactories = async (chainId: BigNumber, ethers: any, signer: Signer) => {
  const isOptimism: boolean = isChainIdOptimism(chainId)
  if (isOptimism) {
    return getOptimismContractFactories(ethers, signer)
  }

  const isArbitrum: boolean = isChainIdArbitrum(chainId)
  if (isArbitrum) {
    return getArbitrumContractFactories(ethers, signer)
  }

}

const getOptimismContractFactories = async (ethers: any, signer: Signer) => {
  const L2_Bridge: ContractFactory = await ethers.getContractFactory('contracts/bridges/L2_OptimismBridge.sol:L2_OptimismBridge', { signer })
  const UniswapFactory: ContractFactory = await ethers.getContractFactory('contracts/test/UniswapFactoryFlat.sol:UniswapV2Factory', { signer })
  const UniswapRouter: ContractFactory = await ethers.getContractFactory('contracts/test/UniswapRouterFlat.sol:UniswapV2Router02', { signer })
  const UniswapPair: ContractFactory = await ethers.getContractFactory('contracts/test/UniswapPairV2OVM/UniswapV2Pair.sol:UniswapV2Pair', { signer })

  return {
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair,
  }
}

const getArbitrumContractFactories = async (ethers: any, signer: Signer) => {
  const L2_Bridge: ContractFactory = await ethers.getContractFactory('contracts/bridges/L2_ArbitrumBridge.sol:L2_ArbitrumBridge', { signer })
  const UniswapFactory: ContractFactory = await ethers.getContractFactory('@uniswap/v2-core/contracts/UniswapV2Factory.sol:UniswapV2Factory', { signer })
  const UniswapRouter: ContractFactory = await ethers.getContractFactory('contracts/uniswap/UniswapV2Router02.sol:UniswapV2Router02', { signer })
  const UniswapPair: ContractFactory = await ethers.getContractFactory('contracts/test/UniswapPairV2OVM/UniswapV2Pair.sol:UniswapV2Pair', { signer })

  return {
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair,
  }
}


export const getValidEthersObject = (chainId: BigNumber, evmEthers: any, ovmEthers: any) => {
  const isOptimism: boolean = isChainIdOptimism(chainId)
  return isOptimism ? ovmEthers : evmEthers
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