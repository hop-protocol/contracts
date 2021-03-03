require('dotenv').config()

import { ContractFactory, Signer, Contract, BigNumber, utils as ethersUtils } from 'ethers'
import { network, ethers, l2ethers as ovmEthers } from 'hardhat'

import { getContractFactories, verifyDeployment, updateConfigFile, readConfigFile } from '../shared/utils'

import { isChainIdOptimism, isChainIdArbitrum, isChainIdXDai } from '../../config/utils'
import {
  ZERO_ADDRESS,
  CHAIN_IDS,
  DEFAULT_H_TOKEN_NAME,
  DEFAULT_H_TOKEN_SYMBOL,
  DEFAULT_H_TOKEN_DECIMALS
} from '../../config/constants'

interface Config {
  l1_bridgeAddress: string
  l2_canonicalTokenAddress: string
  l2_messengerAddress: string
}

export async function deployL2 (config: Config) {
  // Network setup
  const chainId: BigNumber = BigNumber.from(network.config.chainId)
  const l1ChainId: BigNumber = CHAIN_IDS.ETHEREUM.KOVAN

  // Addresses
  const {
    l1_bridgeAddress,
    l2_canonicalTokenAddress,
    l2_messengerAddress,
  } = config

  // Variables
  const l2_hTokenName: string = DEFAULT_H_TOKEN_NAME
  const l2_hTokenSymbol: string = DEFAULT_H_TOKEN_SYMBOL
  const l2_hTokenDecimals: number = 18

  if (
    !l1_bridgeAddress ||
    !l2_canonicalTokenAddress ||
    !l2_messengerAddress ||
    !l2_hTokenName ||
    !l2_hTokenSymbol ||
    !l2_hTokenDecimals
  ) {
    throw new Error('Addresses must be defined')
  }

  // Signers
  let accounts: Signer[]
  let owner: Signer
  let bonder: Signer

  // Factories
  let L1_Bridge: ContractFactory
  let L2_MockERC20: ContractFactory
  let L2_Bridge: ContractFactory
  let L2_UniswapFactory: ContractFactory
  let L2_UniswapRouter: ContractFactory
  let L2_UniswapPair: ContractFactory

  // Contracts
  let l1_bridge: Contract
  let l2_bridge: Contract
  let l2_canonicalToken: Contract
  let l2_uniswapFactory: Contract
  let l2_uniswapRouter: Contract
  let l2_uniswapPair: Contract

  // Instantiate the wallets
  accounts = await ethers.getSigners()
  owner = accounts[0]
  bonder = accounts[1]

  // Get the contract Factories
  ;({
    L1_Bridge,
    L2_MockERC20,
    L2_Bridge,
    L2_UniswapFactory,
    L2_UniswapRouter,
    L2_UniswapPair
  } = await getContractFactories(chainId, owner, ethers, ovmEthers))

  // Attach already deployed contracts
  l1_bridge = L1_Bridge.attach(l1_bridgeAddress)
  l2_canonicalToken = L2_MockERC20.attach(l2_canonicalTokenAddress)

  /**
   * Deployments
   */
  ;({ l2_uniswapFactory, l2_uniswapRouter } = await deployUniswap(
    ethers,
    owner,
    L2_UniswapFactory,
    L2_UniswapRouter,
    l2_uniswapFactory,
    l2_uniswapRouter
  ))

  ;({ l2_bridge } = await deployBridge(
    chainId,
    l1ChainId,
    ethers,
    owner,
    bonder,
    L2_Bridge,
    l1_bridge,
    l2_bridge,
    l2_canonicalToken,
    l2_uniswapRouter,
    l2_messengerAddress,
    l2_hTokenName,
    l2_hTokenSymbol,
    l2_hTokenDecimals
  ))

  await deployNetworkSpecificContracts(
    chainId,
    owner,
    ethers,
    L2_UniswapPair,
    l2_uniswapFactory,
    l2_uniswapPair
  )

  const l2_bridgeAddress = l2_bridge.address
  const l2_uniswapFactoryAddress = l2_uniswapFactory.address
  const l2_uniswapRouterAddress = l2_uniswapRouter.address

  console.log('Deployments Complete')
  console.log('L2 Bridge           :', l2_bridgeAddress)
  console.log('L2 Uniswap Factory  :', l2_uniswapFactoryAddress)
  console.log('L2 Uniswap Router   :', l2_uniswapRouterAddress)

  updateConfigFile({
    l2_bridgeAddress,
    l2_uniswapFactoryAddress,
    l2_uniswapRouterAddress
  })

  return {
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
  await l2_uniswapFactory.deployed()
  await verifyDeployment(l2_uniswapFactory, ethers)

  l2_uniswapRouter = await L2_UniswapRouter.connect(owner).deploy(
    l2_uniswapFactory.address,
    ZERO_ADDRESS
  )
  await l2_uniswapRouter.deployed()
  await verifyDeployment(l2_uniswapRouter, ethers)

  return {
    l2_uniswapFactory,
    l2_uniswapRouter
  }
}

const deployBridge = async (
  chainId: BigNumber,
  l1ChainId: BigNumber,
  ethers: any,
  owner: Signer,
  bonder: Signer,
  L2_Bridge: ContractFactory,
  l1_bridge: Contract,
  l2_bridge: Contract,
  l2_canonicalToken: Contract,
  l2_uniswapRouter: Contract,
  l2_messengerAddress: string,
  l2_hTokenName: string,
  l2_hTokenSymbol: string,
  l2_hTokenDecimals: number
) => {
  // NOTE: Adding more CHAIN_IDs here will push the OVM deployment over the contract size limit
  //       If additional CHAIN_IDs must be added, do so after the deployment.
  const l2BridgeDeploymentParams = [
    l2_messengerAddress,
    await owner.getAddress(),
    l2_canonicalToken.address,
    l1_bridge.address,
    [CHAIN_IDS.ETHEREUM.MAINNET],
    [await bonder.getAddress()],
    l2_uniswapRouter.address,
    l2_hTokenName,
    l2_hTokenSymbol,
    l2_hTokenDecimals
  ]

  if (isChainIdXDai(chainId)) {
    l2BridgeDeploymentParams.push(ethersUtils.formatBytes32String(l1ChainId.toString()))
  }

  l2_bridge = await L2_Bridge.connect(owner).deploy(...l2BridgeDeploymentParams)
  await l2_bridge.deployed()
  await verifyDeployment(l2_bridge, ethers)

  return {
    l2_bridge
  }
}

const deployNetworkSpecificContracts = async (
  chainId: BigNumber,
  owner: Signer,
  ethers: any,
  L2_UniswapPair: ContractFactory,
  l2_uniswapFactory: Contract,
  l2_uniswapPair: Contract
) => {
  if (isChainIdXDai(chainId)) {
    // No network specific deployments
  }

  if (isChainIdArbitrum(chainId)) {
    // No network specific deployments
  }

  if (isChainIdOptimism(chainId)) {
    l2_uniswapPair = await L2_UniswapPair.connect(owner).deploy(
      l2_uniswapFactory.address
    )
    l2_uniswapPair.deployed()
    verifyDeployment(l2_uniswapPair, ethers)

    await l2_uniswapFactory.connect(owner).setPair(l2_uniswapPair.address)
    const realPair = await l2_uniswapFactory.realPair()
    if (l2_uniswapPair.address !== realPair) {
      throw new Error('Pair did not get set on the factory.')
    }
  }
}

if (require.main === module) {
  const {
    l1_bridgeAddress,
    l2_canonicalTokenAddress,
    l2_messengerAddress,
  } = readConfigFile()
  deployL2({
    l1_bridgeAddress,
    l2_canonicalTokenAddress,
    l2_messengerAddress,
  })
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
}
