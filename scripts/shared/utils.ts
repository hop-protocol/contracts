import path from 'path'
import fs from 'fs'
import { ContractFactory, Contract, BigNumber, Signer } from 'ethers'

import { isChainIdOptimism, isChainIdArbitrum, isChainIdXDai } from '../../config/utils'

import {
  ARB_CHAIN_ADDRESS,
  ALL_SUPPORTED_CHAIN_IDS
} from '../../config/constants'

export const verifyDeployment = async (contract: Contract, ethers) => {
  const isCodeAtAddress =
    (await ethers.provider.getCode(contract.address)).length > 50
  if (!isCodeAtAddress) {
    throw new Error('Did not deploy correctly')
  }
}

export const getContractFactories = async (
  chainId: BigNumber,
  signer: Signer,
  ethers: any,
  ovmEthers?: any
) => {
  const L1_MockERC20: ContractFactory = await ethers.getContractFactory(
    'contracts/test/MockERC20.sol:MockERC20',
    { signer }
  )
  const L1_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L1_ERC20_Bridge.sol:L1_ERC20_Bridge',
    { signer }
  )

  let L1_Messenger: ContractFactory
  let L1_MessengerWrapper: ContractFactory
  let L2_MockERC20: ContractFactory
  let L2_HopBridgeToken: ContractFactory
  let L2_Bridge: ContractFactory
  let L2_UniswapFactory: ContractFactory
  let L2_UniswapRouter: ContractFactory
  let L2_UniswapPair: ContractFactory
  ;({
    L1_Messenger,
    L1_MessengerWrapper,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_UniswapFactory,
    L2_UniswapRouter,
    L2_UniswapPair
  } = await getNetworkSpecificFactories(chainId, signer, ethers, ovmEthers))

  return {
    L1_MockERC20,
    L1_Bridge,
    L1_MessengerWrapper,
    L1_Messenger,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_UniswapFactory,
    L2_UniswapRouter,
    L2_UniswapPair
  }
}

const getNetworkSpecificFactories = async (
  chainId: BigNumber,
  signer: Signer,
  ethers: any,
  ovmEthers: any
) => {
  if (isChainIdOptimism(chainId)) {
    return getOptimismContractFactories(signer, ethers, ovmEthers)
  } else if (isChainIdArbitrum(chainId)) {
    return getArbitrumContractFactories(signer, ethers)
  } else if (isChainIdXDai(chainId)) {
    return getXDaiContractFactories(signer, ethers)
  } else {
    return {
      L1_Messenger: null,
      L1_MessengerWrapper: null,
      L2_MockERC20: null,
      L2_HopBridgeToken: null,
      L2_Bridge: null,
      L2_UniswapFactory: null,
      L2_UniswapRouter: null,
      L2_UniswapPair: null
    }
  }
}

const getOptimismContractFactories = async (
  signer: Signer,
  ethers: any,
  ovmEthers: any
) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/optimism/mockOVM_CrossDomainMessenger.sol:mockOVM_CrossDomainMessenger',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/OptimismMessengerWrapper.sol:OptimismMessengerWrapper',
    { signer }
  )
  const L2_MockERC20: ContractFactory = await ovmEthers.getContractFactory(
    'contracts/test/MockERC20.sol:MockERC20',
    { signer }
  )
  const L2_HopBridgeToken: ContractFactory = await ovmEthers.getContractFactory(
    'contracts/bridges/HopBridgeToken.sol:HopBridgeToken',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ovmEthers.getContractFactory(
    'contracts/bridges/L2_OptimismBridge.sol:L2_OptimismBridge',
    { signer }
  )
  const L2_UniswapFactory: ContractFactory = await ovmEthers.getContractFactory(
    'contracts/uniswap/optimism/OptimismUniswapFactory.sol:OptimismUniswapFactory',
    { signer }
  )
  const L2_UniswapRouter: ContractFactory = await ovmEthers.getContractFactory(
    'contracts/uniswap/optimism/OptimismUniswapRouter.sol:OptimismUniswapRouter',
    { signer }
  )
  const L2_UniswapPair: ContractFactory = await ovmEthers.getContractFactory(
    'contracts/uniswap/optimism/OptimismUniswapPair.sol:OptimismUniswapPair',
    { signer }
  )

  return {
    L1_Messenger,
    L1_MessengerWrapper,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_UniswapFactory,
    L2_UniswapRouter,
    L2_UniswapPair
  }
}

const getArbitrumContractFactories = async (signer: Signer, ethers: any) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/arbitrum/inbox/GlobalInbox.sol:GlobalInbox',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/ArbitrumMessengerWrapper.sol:ArbitrumMessengerWrapper',
    { signer }
  )
  const L2_MockERC20: ContractFactory = await ethers.getContractFactory(
    'contracts/test/MockERC20.sol:MockERC20',
    { signer }
  )
  const L2_HopBridgeToken: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/HopBridgeToken.sol:HopBridgeToken',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_ArbitrumBridge.sol:L2_ArbitrumBridge',
    { signer }
  )
  const L2_UniswapFactory: ContractFactory = await ethers.getContractFactory(
    'contracts/uniswap/arbitrum/ArbitrumUniswapFactory.sol:ArbitrumUniswapFactory',
    { signer }
  )
  const L2_UniswapRouter: ContractFactory = await ethers.getContractFactory(
    'contracts/uniswap/arbitrum/ArbitrumUniswapRouter.sol:ArbitrumUniswapRouter',
    { signer }
  )

  return {
    L1_Messenger,
    L1_MessengerWrapper,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_UniswapFactory,
    L2_UniswapRouter,
    L2_UniswapPair: null
  }
}

const getXDaiContractFactories = async (signer: Signer, ethers: any) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/xDai/ArbitraryMessageBridge.sol:ArbitraryMessageBridge',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/XDaiMessengerWrapper.sol:XDaiMessengerWrapper',
    { signer }
  )
  const L2_MockERC20: ContractFactory = await ethers.getContractFactory(
    'contracts/test/MockERC20.sol:MockERC20',
    { signer }
  )
  const L2_HopBridgeToken: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/HopBridgeToken.sol:HopBridgeToken',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_XDaiBridge.sol:L2_XDaiBridge',
    { signer }
  )
  const L2_UniswapFactory: ContractFactory = await ethers.getContractFactory(
    'contracts/uniswap/xdai/XDaiUniswapFactory.sol:XDaiUniswapFactory',
    { signer }
  )
  const L2_UniswapRouter: ContractFactory = await ethers.getContractFactory(
    'contracts/uniswap/xdai/XDaiUniswapRouter.sol:XDaiUniswapRouter',
    { signer }
  )

  return {
    L1_Messenger,
    L1_MessengerWrapper,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_UniswapFactory,
    L2_UniswapRouter,
    L2_UniswapPair: null
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
    await l1_messenger
      .connect(sender)
      .deposit(await sender.getAddress(), amount, true)
  }

  if (isChainIdArbitrum(chainId)) {
    await l1_messenger
      .connect(sender)
      .depositERC20Message(
        ARB_CHAIN_ADDRESS,
        l1_canonicalToken.address,
        await sender.getAddress(),
        amount
      )
  }

  if (isChainIdXDai(chainId)) {
    await l1_messenger
      .connect(sender)
      .relayTokens(l1_canonicalToken.address, amount)
  }
}

export const addAllSupportedChainIds = async (l2_bridge: Contract) => {
  const allSupportedChainIds: string[] = ALL_SUPPORTED_CHAIN_IDS
  await l2_bridge.addSupportedChainIds(allSupportedChainIds)
}

const configFilepath = path.resolve(__dirname, '../deploy_config.json')

export const updateConfigFile = (newData: any) => {
  const data = readConfigFile()
  fs.writeFileSync(configFilepath, JSON.stringify({ ...data, ...newData}, null, 2))
}

export const readConfigFile = () => {
  let data: any = {
    l1_canonicalTokenAddress: '',
    l1_messengerAddress: '',
    l1_bridgeAddres: '',
    l2_canonicalTokenAddress: '',
    l2_messengerAddres: '',
    l2_uniswapRouterAddress: ''
  }
  if (fs.existsSync(configFilepath)) {
    data = JSON.parse(fs.readFileSync(configFilepath, 'utf8'))
  }
  return data
}
