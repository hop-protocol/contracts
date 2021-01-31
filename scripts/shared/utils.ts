import { ContractFactory, Contract, BigNumber, Signer } from 'ethers'

import {
  isChainIdOptimism,
  isChainIdArbitrum
} from '../../config/utils'

import {
  ARB_CHAIN_ADDRESS
} from '../../config/constants'

export const verifyDeployment = async (name: string, contract: Contract, ethers) => {
  const isCodeAtAddress = (await ethers.provider.getCode(contract.address)).length > 50
  if (!isCodeAtAddress) {
    throw new Error('Did not deploy correctly')
  }
}

export const getContractFactories = async (chainId: BigNumber, ethers: any, signer: Signer) => {
  const MockERC20: ContractFactory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20', { signer })
  const L1_Bridge: ContractFactory = await ethers.getContractFactory('contracts/bridges/L1_Bridge.sol:L1_Bridge', { signer })

  let L1_Messenger: ContractFactory
  let MessengerWrapper: ContractFactory
  let L2_Bridge: ContractFactory
  let UniswapFactory: ContractFactory
  let UniswapRouter: ContractFactory
  let UniswapPair: ContractFactory

  ;({ 
    L1_Messenger,
    MessengerWrapper,
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
  if (isChainIdOptimism(chainId)) {
    return getOptimismContractFactories(ethers, signer)
  } else if (isChainIdArbitrum(chainId)) {
    return getArbitrumContractFactories(ethers, signer)
  } else {
    return {
      L1_Messenger: null,
      MessengerWrapper: null,
      L2_Bridge: null,
      UniswapFactory: null,
      UniswapRouter: null,
      UniswapPair: null,
    }
  }
}

const getOptimismContractFactories = async (ethers: any, signer: Signer) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory('contracts/test/Optimism/mockOVM_CrossDomainMessenger.sol:mockOVM_CrossDomainMessenger', { signer })
  const MessengerWrapper: ContractFactory = await ethers.getContractFactory('contracts/wrappers/OptimismMessengerWrapper.sol:OptimismMessengerWrapper', { signer })
  const L2_Bridge: ContractFactory = await ethers.getContractFactory('contracts/bridges/L2_OptimismBridge.sol:L2_OptimismBridge', { signer })
  const UniswapFactory: ContractFactory = await ethers.getContractFactory('contracts/uniswap/optimism/OptimismUniswapFactory.sol:OptimismUniswapFactory', { signer })
  const UniswapRouter: ContractFactory = await ethers.getContractFactory('contracts/uniswap/optimism/OptimismUniswapRouter.sol:OptimismUniswapRouter', { signer })
  const UniswapPair: ContractFactory = await ethers.getContractFactory('contracts/uniswap/optimism/OptimismUniswapPair.sol:OptimismUniswapPair', { signer })

  return {
    L1_Messenger,
    MessengerWrapper,
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair,
  }
}

const getArbitrumContractFactories = async (ethers: any, signer: Signer) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory('contracts/test/Arbitrum/inbox/GlobalInbox.sol:GlobalInbox', { signer })
  const MessengerWrapper: ContractFactory = await ethers.getContractFactory('contracts/wrappers/ArbitrumMessengerWrapper.sol:ArbitrumMessengerWrapper', { signer })
  const L2_Bridge: ContractFactory = await ethers.getContractFactory('contracts/bridges/L2_ArbitrumBridge.sol:L2_ArbitrumBridge', { signer })
  const UniswapFactory: ContractFactory = await ethers.getContractFactory('contracts/uniswap/arbitrum/ArbitrumUniswapFactory.sol:ArbitrumUniswapFactory', { signer })
  const UniswapRouter: ContractFactory = await ethers.getContractFactory('contracts/uniswap/arbitrum/ArbitrumUniswapRouter.sol:ArbitrumUniswapRouter', { signer })

  return {
    L1_Messenger,
    MessengerWrapper,
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair: null
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