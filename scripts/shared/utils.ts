import { ContractFactory, Contract, BigNumber, Signer } from 'ethers'

import {
  isChainIdOptimism,
  isChainIdArbitrum
} from '../../config/utils'

import {
  ARB_CHAIN_ADDRESS,
  ALL_SUPPORTED_CHAIN_IDS
} from '../../config/constants'

export const verifyDeployment = async (name: string, contract: Contract, ethers) => {
  const isCodeAtAddress = (await ethers.provider.getCode(contract.address)).length > 50
  if (!isCodeAtAddress) {
    throw new Error('Did not deploy correctly')
  }
}

export const getContractFactories = async (chainId: BigNumber, signer: Signer, ethers: any, ovmEthers?: any) => {
  const L1_MockERC20: ContractFactory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20', { signer })
  const L1_Bridge: ContractFactory = await ethers.getContractFactory('contracts/bridges/L1_Bridge.sol:L1_Bridge', { signer })

  let L1_Messenger: ContractFactory
  let MessengerWrapper: ContractFactory
  let L2_MockERC20: ContractFactory
  let L2_Bridge: ContractFactory
  let UniswapFactory: ContractFactory
  let UniswapRouter: ContractFactory
  let UniswapPair: ContractFactory

  ;({ 
    L1_Messenger,
    MessengerWrapper,
    L2_MockERC20,
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair,
  } = await getNetworkSpecificFactories(chainId, signer, ethers, ovmEthers))

  return {
    L1_MockERC20,
    L1_Bridge,
    MessengerWrapper,
    L1_Messenger,
    L2_MockERC20,
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair,
  }
}

const getNetworkSpecificFactories = async (chainId: BigNumber, signer: Signer, ethers: any, ovmEthers: any) => {
  if (isChainIdOptimism(chainId)) {
    return getOptimismContractFactories(signer, ethers, ovmEthers)
  } else if (isChainIdArbitrum(chainId)) {
    return getArbitrumContractFactories(signer, ethers)
  } else {
    return {
      L1_Messenger: null,
      MessengerWrapper: null,
      L2_MockERC20: null,
      L2_Bridge: null,
      UniswapFactory: null,
      UniswapRouter: null,
      UniswapPair: null,
    }
  }
}

const getOptimismContractFactories = async (signer: Signer, ethers: any, ovmEthers: any) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory('contracts/test/Optimism/mockOVM_CrossDomainMessenger.sol:mockOVM_CrossDomainMessenger', { signer })
  const MessengerWrapper: ContractFactory = await ethers.getContractFactory('contracts/wrappers/OptimismMessengerWrapper.sol:OptimismMessengerWrapper', { signer })
  const L2_MockERC20: ContractFactory = await ovmEthers.getContractFactory('contracts/test/MockERC20.sol:MockERC20', { signer })
  const L2_Bridge: ContractFactory = await ovmEthers.getContractFactory('contracts/bridges/L2_OptimismBridge.sol:L2_OptimismBridge', { signer })
  const UniswapFactory: ContractFactory = await ovmEthers.getContractFactory('contracts/uniswap/optimism/OptimismUniswapFactory.sol:OptimismUniswapFactory', { signer })
  const UniswapRouter: ContractFactory = await ovmEthers.getContractFactory('contracts/uniswap/optimism/OptimismUniswapRouter.sol:OptimismUniswapRouter', { signer })
  const UniswapPair: ContractFactory = await ovmEthers.getContractFactory('contracts/uniswap/optimism/OptimismUniswapPair.sol:OptimismUniswapPair', { signer })

  return {
    L1_Messenger,
    MessengerWrapper,
    L2_MockERC20,
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair
  }
}

const getArbitrumContractFactories = async (signer: Signer, ethers: any) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory('contracts/test/Arbitrum/inbox/GlobalInbox.sol:GlobalInbox', { signer })
  const MessengerWrapper: ContractFactory = await ethers.getContractFactory('contracts/wrappers/ArbitrumMessengerWrapper.sol:ArbitrumMessengerWrapper', { signer })
  const L2_MockERC20: ContractFactory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20', { signer })
  const L2_Bridge: ContractFactory = await ethers.getContractFactory('contracts/bridges/L2_ArbitrumBridge.sol:L2_ArbitrumBridge', { signer })
  const UniswapFactory: ContractFactory = await ethers.getContractFactory('contracts/uniswap/arbitrum/ArbitrumUniswapFactory.sol:ArbitrumUniswapFactory', { signer })
  const UniswapRouter: ContractFactory = await ethers.getContractFactory('contracts/uniswap/arbitrum/ArbitrumUniswapRouter.sol:ArbitrumUniswapRouter', { signer })

  return {
    L1_Messenger,
    MessengerWrapper,
    L2_MockERC20,
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
    await l1_messenger.connect(sender).deposit(await sender.getAddress(), amount, true)
  }

  if (isChainIdArbitrum(chainId)) {
    await l1_messenger.connect(sender).depositERC20Message(ARB_CHAIN_ADDRESS, l1_canonicalToken.address, await sender.getAddress(), amount)
  }
}

export const addAllSupportedChainIds = async (l2_bridge: Contract) => {
  const allSupportedChainIds: string[] =  ALL_SUPPORTED_CHAIN_IDS

  for (let i = 0; i < allSupportedChainIds.length; i++) {
    await l2_bridge.addSupportedChainId(allSupportedChainIds[i])
  }
}
