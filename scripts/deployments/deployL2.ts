require('dotenv').config()

import { ContractFactory, Signer, Contract, BigNumber } from 'ethers'
import { ethers, l2ethers as ovmEthers } from 'hardhat'

import { getContractFactories, verifyDeployment, updateConfigFile, readConfigFile, waitAfterTransaction } from '../shared/utils'

import { isChainIdOptimism, isChainIdArbitrum, isChainIdXDai, getL2BridgeDefaults } from '../../config/utils'
import {
  ZERO_ADDRESS,
  CHAIN_IDS,
  DEFAULT_ETHERS_OVERRIDES as overrides
} from '../../config/constants'

interface Config {
  l1_chainId: string | BigNumber
  l2_chainId: string | BigNumber
  l1_bridgeAddress: string
  l2_canonicalTokenAddress: string
  l2_messengerAddress: string
  l2_hBridgeTokenName: string
  l2_hBridgeTokenSymbol: string
  l2_hBridgeTokenDecimals: number
}

export async function deployL2 (config: Config) {
  let {
    l1_chainId,
    l2_chainId,
    l1_bridgeAddress,
    l2_canonicalTokenAddress,
    l2_messengerAddress,
    l2_hBridgeTokenName,
    l2_hBridgeTokenSymbol,
    l2_hBridgeTokenDecimals
  } = config

  l1_chainId = BigNumber.from(l1_chainId)
  l2_chainId = BigNumber.from(l2_chainId)

  // Signers
  let accounts: Signer[]
  let owner: Signer
  let bonder: Signer

  // Factories
  let L1_Bridge: ContractFactory
  let L2_MockERC20: ContractFactory
  let L2_HopBridgeToken: ContractFactory
  let L2_Bridge: ContractFactory
  let L2_UniswapFactory: ContractFactory
  let L2_UniswapRouter: ContractFactory
  let L2_UniswapPair: ContractFactory
  let L2_UniswapWrapper: ContractFactory

  // Contracts
  let l1_bridge: Contract
  let l2_bridge: Contract
  let l2_canonicalToken: Contract
  let l2_hopBridgeToken: Contract
  let l2_uniswapFactory: Contract
  let l2_uniswapRouter: Contract
  let l2_uniswapPair: Contract
  let l2_uniswapWrapper: Contract

  // Instantiate the wallets
  accounts = await ethers.getSigners()
  owner = accounts[0]
  bonder = accounts[1]

  // Get the contract Factories
  ;({
    L1_Bridge,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_UniswapFactory,
    L2_UniswapRouter,
    L2_UniswapPair,
    L2_UniswapWrapper
  } = await getContractFactories(l2_chainId, owner, ethers, ovmEthers))

  // Attach already deployed contracts
  l1_bridge = L1_Bridge.attach(l1_bridgeAddress)
  l2_canonicalToken = L2_MockERC20.attach(l2_canonicalTokenAddress)

  /**
   * Deployments
   */

  l2_hopBridgeToken = await L2_HopBridgeToken.deploy(
    l2_hBridgeTokenName,
    l2_hBridgeTokenSymbol,
    l2_hBridgeTokenDecimals
  )
  await waitAfterTransaction(l2_hopBridgeToken)

  ;({ l2_uniswapFactory, l2_uniswapRouter } = await deployUniswap(
    ethers,
    owner,
    L2_UniswapFactory,
    L2_UniswapRouter,
    l2_uniswapFactory,
    l2_uniswapRouter
  ))

  ;({ l2_bridge } = await deployBridge(
    l2_chainId,
    l1_chainId,
    l2_chainId,
    ethers,
    owner,
    bonder,
    L2_Bridge,
    L2_UniswapWrapper,
    l1_bridge,
    l2_bridge,
    l2_hopBridgeToken,
    l2_canonicalToken,
    l2_uniswapRouter,
    l2_uniswapWrapper,
    l2_messengerAddress
  ))

  await deployNetworkSpecificContracts(
    l2_chainId,
    owner,
    ethers,
    L2_UniswapPair,
    l2_uniswapFactory,
    l2_uniswapPair
  )

  // Transfer ownership of the Hop Bridge Token to the L2 Bridge
  let transferOwnershipParams: any[] = [l2_bridge.address]
  if (isChainIdXDai(l2_chainId)) { transferOwnershipParams.push(overrides) }
  await l2_hopBridgeToken.transferOwnership(...transferOwnershipParams)
  await waitAfterTransaction()

  const l2_hopBridgeTokenAddress: string = l2_hopBridgeToken.address
  const l2_bridgeAddress: string = l2_bridge.address
  const l2_uniswapFactoryAddress: string = l2_uniswapFactory.address
  const l2_uniswapRouterAddress: string = l2_uniswapRouter.address

  console.log('L2 Deployments Complete')
  console.log('L2 Hop Bridge Token :', l2_hopBridgeTokenAddress)
  console.log('L2 Bridge           :', l2_bridgeAddress)
  console.log('L2 Uniswap Factory  :', l2_uniswapFactoryAddress)
  console.log('L2 Uniswap Router   :', l2_uniswapRouterAddress)

  updateConfigFile({
    l2_hopBridgeTokenAddress,
    l2_bridgeAddress,
    l2_uniswapFactoryAddress,
    l2_uniswapRouterAddress
  })

  return {
    l2_hopBridgeToken,
    l2_bridgeAddress,
    l2_uniswapFactoryAddress,
    l2_uniswapRouterAddress
  }
}

const deployUniswap = async (
  ethers: any,
  owner: Signer,
  L2_UniswapFactory: ContractFactory,
  L2_UniswapRouter: ContractFactory,
  l2_uniswapFactory: Contract,
  l2_uniswapRouter: Contract
) => {
  l2_uniswapFactory = await L2_UniswapFactory.connect(owner).deploy(
    await owner.getAddress()
  )
  await waitAfterTransaction(l2_uniswapFactory)
  await verifyDeployment(l2_uniswapFactory, ethers)

  l2_uniswapRouter = await L2_UniswapRouter.connect(owner).deploy(
    l2_uniswapFactory.address,
    ZERO_ADDRESS
  )
  await waitAfterTransaction(l2_uniswapRouter)
  await verifyDeployment(l2_uniswapRouter, ethers)

  return {
    l2_uniswapFactory,
    l2_uniswapRouter
  }
}

const deployBridge = async (
  chainId: BigNumber,
  l1ChainId: BigNumber,
  l2ChainId: BigNumber,
  ethers: any,
  owner: Signer,
  bonder: Signer,
  L2_Bridge: ContractFactory,
  L2_UniswapWrapper: ContractFactory,
  l1_bridge: Contract,
  l2_bridge: Contract,
  l2_hopBridgeToken: Contract,
  l2_canonicalToken: Contract,
  l2_uniswapRouter: Contract,
  l2_uniswapWrapper: Contract,
  l2_messengerAddress: string
) => {
  // NOTE: Adding more CHAIN_IDs here will push the OVM deployment over the contract size limit
  //       If additional CHAIN_IDs must be added, do so after the deployment.
  const isProdDeployment: boolean = true
  const l2BridgeDeploymentParams = getL2BridgeDefaults (
    isProdDeployment,
    chainId,
    l2_messengerAddress,
    await owner.getAddress(),
    l2_hopBridgeToken.address,
    l2_canonicalToken.address,
    l1_bridge.address,
    [CHAIN_IDS.ETHEREUM.MAINNET.toString()],
    [await bonder.getAddress()],
    l1ChainId
  )

  l2_bridge = await L2_Bridge.connect(owner).deploy(...l2BridgeDeploymentParams)
  await waitAfterTransaction(l2_bridge)
  await verifyDeployment(l2_bridge, ethers)

  // TODO: l2CanonicalTokenIsEth should be 'smart'
  const l2CanonicalTokenIsEth: boolean = false
  l2_uniswapWrapper = await L2_UniswapWrapper.connect(owner).deploy(
    l2_bridge.address,
    l2_canonicalToken.address,
    l2CanonicalTokenIsEth,
    l2_hopBridgeToken.address,
    l2_uniswapRouter.address
  )
  await waitAfterTransaction(l2_uniswapWrapper)

  let setUniswapWrapperParams: any[] = [l2_uniswapWrapper.address]
  if (isChainIdXDai(l2ChainId)) { setUniswapWrapperParams.push(overrides) }
  await l2_bridge.setUniswapWrapper(...setUniswapWrapperParams)
  await waitAfterTransaction()

  return {
    l2_bridge,
    l2_uniswapWrapper
  }
}

const deployNetworkSpecificContracts = async (
  l2ChainId: BigNumber,
  owner: Signer,
  ethers: any,
  L2_UniswapPair: ContractFactory,
  l2_uniswapFactory: Contract,
  l2_uniswapPair: Contract
) => {
  if (isChainIdXDai(l2ChainId)) {
    // No network specific deployments
  }

  if (isChainIdArbitrum(l2ChainId)) {
    // No network specific deployments
  }

  if (isChainIdOptimism(l2ChainId)) {
    l2_uniswapPair = await L2_UniswapPair.connect(owner).deploy(
      l2_uniswapFactory.address
    )
    await waitAfterTransaction(l2_uniswapPair)
    verifyDeployment(l2_uniswapPair, ethers)

    let setPairParams: any[] = [l2_uniswapPair]
    if (isChainIdXDai(l2ChainId)) { setPairParams.push(overrides) }
    await l2_uniswapFactory.connect(owner).setPair(l2_uniswapPair.address)
    await waitAfterTransaction()
    const realPair = await l2_uniswapFactory.realPair()
    if (l2_uniswapPair.address !== realPair) {
      throw new Error('Pair did not get set on the factory.')
    }
  }
}

if (require.main === module) {
  const {
    l1_chainId,
    l2_chainId,
    l1_bridgeAddress,
    l2_canonicalTokenAddress,
    l2_messengerAddress,
    l2_hBridgeTokenName,
    l2_hBridgeTokenSymbol,
    l2_hBridgeTokenDecimals
  } = readConfigFile()
  deployL2({
    l1_chainId,
    l2_chainId,
    l1_bridgeAddress,
    l2_canonicalTokenAddress,
    l2_messengerAddress,
    l2_hBridgeTokenName,
    l2_hBridgeTokenSymbol,
    l2_hBridgeTokenDecimals
  })
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
}
