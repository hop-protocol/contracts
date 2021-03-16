require('dotenv').config()

import { ethers, l2ethers as ovmEthers } from 'hardhat'
import { ContractFactory, Signer, Contract, BigNumber, providers } from 'ethers'

import {
  getContractFactories,
  updateConfigFile,
  readConfigFile,
  waitAfterTransaction,
  Logger
} from '../shared/utils'

import {
  isChainIdOptimism,
  isChainIdArbitrum,
  isChainIdXDai,
  getL2BridgeDefaults
} from '../../config/utils'
import {
  ZERO_ADDRESS,
  CHAIN_IDS,
  DEFAULT_ETHERS_OVERRIDES as overrides
} from '../../config/constants'

const logger = Logger('deployL2')

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
  logger.log('deploy L2')

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

  logger.log(`config:
            l1_chainId: ${l1_chainId}
            l2_chainId: ${l2_chainId}
            l1_bridgeAddress: ${l1_bridgeAddress}
            l2_canonicalTokenAddress: ${l2_canonicalTokenAddress}
            l2_messengerAddress: ${l2_messengerAddress}
            l2_hBridgeTokenName: ${l2_hBridgeTokenName}
            l2_hBridgeTokenSymbol: ${l2_hBridgeTokenSymbol}
            l2_hBridgeTokenDecimals: ${l2_hBridgeTokenDecimals}`)

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

  logger.log('owner:', await owner.getAddress())
  logger.log('bonder:', await bonder.getAddress())

  // Transaction
  let tx: providers.TransactionResponse

  logger.log('getting contract factories')
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

  logger.log('attaching deployed contracts')
  // Attach already deployed contracts
  l1_bridge = L1_Bridge.attach(l1_bridgeAddress)
  l2_canonicalToken = L2_MockERC20.attach(l2_canonicalTokenAddress)

  /**
   * Deployments
   */

  logger.log('deploying L2 hop bridge token')
  l2_hopBridgeToken = await L2_HopBridgeToken.deploy(
    l2_hBridgeTokenName,
    l2_hBridgeTokenSymbol,
    l2_hBridgeTokenDecimals
  )
  await waitAfterTransaction(l2_hopBridgeToken, ethers)

  logger.log('deploying L2 uniswap factory and L2 uniswap router')
  ;({ l2_uniswapFactory, l2_uniswapRouter } = await deployUniswap(
    ethers,
    owner,
    L2_UniswapFactory,
    L2_UniswapRouter,
    l2_uniswapFactory,
    l2_uniswapRouter
  ))

  logger.log('deploying L2 bridge and L2 uniswap wrapper')
  ;({ l2_bridge, l2_uniswapWrapper } = await deployBridge(
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

  logger.log('deploying network specific contracts')
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
  if (isChainIdXDai(l2_chainId)) {
    transferOwnershipParams.push(overrides)
  }

  logger.log('transferring ownership of L2 hop bridge token')
  tx = await l2_hopBridgeToken.transferOwnership(...transferOwnershipParams)
  await tx.wait()
  await waitAfterTransaction()

  const l2_hopBridgeTokenAddress: string = l2_hopBridgeToken.address
  const l2_bridgeAddress: string = l2_bridge.address
  const l2_uniswapFactoryAddress: string = l2_uniswapFactory.address
  const l2_uniswapRouterAddress: string = l2_uniswapRouter.address
  const l2_uniswapWrapperAddress: string = l2_uniswapWrapper.address

  logger.log('L2 Deployments Complete')
  logger.log('L2 Hop Bridge Token :', l2_hopBridgeTokenAddress)
  logger.log('L2 Bridge           :', l2_bridgeAddress)
  logger.log('L2 Uniswap Factory  :', l2_uniswapFactoryAddress)
  logger.log('L2 Uniswap Router   :', l2_uniswapRouterAddress)
  logger.log('L2 Uniswap Wrapper  :', l2_uniswapWrapperAddress)

  updateConfigFile({
    l2_hopBridgeTokenAddress,
    l2_bridgeAddress,
    l2_uniswapFactoryAddress,
    l2_uniswapRouterAddress,
    l2_uniswapWrapperAddress
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
  await waitAfterTransaction(l2_uniswapFactory, ethers)

  l2_uniswapRouter = await L2_UniswapRouter.connect(owner).deploy(
    l2_uniswapFactory.address,
    ZERO_ADDRESS
  )
  await waitAfterTransaction(l2_uniswapRouter, ethers)

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
  const l2BridgeDeploymentParams = getL2BridgeDefaults(
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
  await waitAfterTransaction(l2_bridge, ethers)

  const l2CanonicalTokenName = await l2_canonicalToken.symbol(overrides)
  const l2CanonicalTokenIsEth: boolean = l2CanonicalTokenName === 'WETH'
  l2_uniswapWrapper = await L2_UniswapWrapper.connect(owner).deploy(
    l2_bridge.address,
    l2_canonicalToken.address,
    l2CanonicalTokenIsEth,
    l2_hopBridgeToken.address,
    l2_uniswapRouter.address
  )
  await waitAfterTransaction(l2_uniswapWrapper, ethers)

  let setUniswapWrapperParams: any[] = [l2_uniswapWrapper.address]
  if (isChainIdXDai(l2ChainId)) {
    setUniswapWrapperParams.push(overrides)
  }
  const tx = await l2_bridge.setUniswapWrapper(...setUniswapWrapperParams)
  await tx.wait()
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
    await waitAfterTransaction(l2_uniswapPair, ethers)

    let setPairParams: any[] = [l2_uniswapPair]
    if (isChainIdXDai(l2ChainId)) {
      setPairParams.push(overrides)
    }
    const tx = await l2_uniswapFactory
      .connect(owner)
      .setPair(l2_uniswapPair.address)
    await tx.wait()
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
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      logger.error(error)
      process.exit(1)
    })
}
