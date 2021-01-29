import { ContractFactory, Contract, BigNumber, Signer } from 'ethers'
import { CHAIN_IDS, ARB_CHAIN_ADDRESS } from '../test/shared/constants'

export const verifyDeployment = async (name: string, contract: Contract, ethers) => {
  const isCodeAtAddress = (await ethers.provider.getCode(contract.address)).length > 50
  if (!isCodeAtAddress) {
    throw new Error('Did not deploy correctly')
  }
}

export const getContractFactories = async (chainId: BigNumber, ethers: any, signer: Signer) => {
  const MockERC20: ContractFactory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20', { signer })
  const L1_Bridge: ContractFactory = await ethers.getContractFactory('contracts/bridges/L1_Bridge.sol:L1_Bridge', { signer })
  const MessengerWrapper: ContractFactory = await ethers.getContractFactory('contracts/wrappers/OptimismMessengerWrapper.sol:OptimismMessengerWrapper', { signer })

  let L1_Messenger: ContractFactory
  let L2_Bridge: ContractFactory
  let UniswapFactory: ContractFactory
  let UniswapRouter: ContractFactory
  let UniswapPair: ContractFactory

  ;({ 
    L1_Messenger,
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair,
  } = await getNetworkSpecificFactories(chainId, ethers, signer))

  return {
    MockERC20,
    L1_Bridge,
    MessengerWrapper,
    L1_Messenger,
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
  const L1_Messenger: ContractFactory = await ethers.getContractFactory('contracts/interfaces/optimism/messengers/iOVM_L1CrossDomainMessenger.sol:iOVM_L1CrossDomainMessenger', { signer })
  const L2_Bridge: ContractFactory = await ethers.getContractFactory('contracts/bridges/L2_OptimismBridge.sol:L2_OptimismBridge', { signer })
  const UniswapFactory: ContractFactory = await ethers.getContractFactory('contracts/test/UniswapFactoryFlat.sol:UniswapV2Factory', { signer })
  const UniswapRouter: ContractFactory = await ethers.getContractFactory('contracts/test/UniswapRouterFlat.sol:UniswapV2Router02', { signer })
  const UniswapPair: ContractFactory = await ethers.getContractFactory('contracts/test/UniswapPairV2OVM/UniswapV2Pair.sol:UniswapV2Pair', { signer })

  return {
    L1_Messenger,
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair,
  }
}

const getArbitrumContractFactories = async (ethers: any, signer: Signer) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory('contracts/test/Arbitrum/GlobalInbox.sol:GlobalInbox', { signer })
  const L2_Bridge: ContractFactory = await ethers.getContractFactory('contracts/bridges/L2_ArbitrumBridge.sol:L2_ArbitrumBridge', { signer })
  const UniswapFactory: ContractFactory = await ethers.getContractFactory('@uniswap/v2-core/contracts/UniswapV2Factory.sol:UniswapV2Factory', { signer })
  const UniswapRouter: ContractFactory = await ethers.getContractFactory('contracts/uniswap/UniswapV2Router02.sol:UniswapV2Router02', { signer })
  const UniswapPair: ContractFactory = await ethers.getContractFactory('contracts/test/UniswapPairV2OVM/UniswapV2Pair.sol:UniswapV2Pair', { signer })

  return {
    L1_Messenger,
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair,
  }
}

export const sendChainSpecificBridgeDeposit = async (
  chainId: BigNumber,
  sender: Signer,
  amount: BigNumber,
  l1_messenger: Contract,
  l1_canonicalToken: Contract
) => {
  if (isChainIdOptimism(chainId)) {
    await l1_messenger.deposit(await sender.getAddress(), amount, true)
  }

  if (isChainIdArbitrum(chainId)) {
    await l1_messenger.depositERC20Message(ARB_CHAIN_ADDRESS, l1_canonicalToken.address, await sender.getAddress(), amount)
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