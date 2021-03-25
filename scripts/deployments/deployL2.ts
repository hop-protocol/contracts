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
  let L2_Swap: ContractFactory
  let L2_AmmWrapper: ContractFactory

  // Contracts
  let l1_bridge: Contract
  let l2_bridge: Contract
  let l2_canonicalToken: Contract
  let l2_hopBridgeToken: Contract
  let l2_swap: Contract
  let l2_ammWrapper: Contract

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
    L2_Swap,
    L2_AmmWrapper
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

  logger.log('deploying L2 swap contract')
  ;({ l2_swap } = await deployAmm(
    ethers,
    l2_chainId,
    l2_canonicalToken,
    l2_hopBridgeToken,
    L2_Swap
  ))

  logger.log('deploying L2 bridge and L2 amm wrapper')
  ;({ l2_bridge, l2_ammWrapper } = await deployBridge(
    l2_chainId,
    l1_chainId,
    ethers,
    owner,
    bonder,
    L2_Bridge,
    L2_AmmWrapper,
    l1_bridge,
    l2_bridge,
    l2_hopBridgeToken,
    l2_canonicalToken,
    l2_swap,
    l2_ammWrapper,
    l2_messengerAddress
  ))

  logger.log('deploying network specific contracts')

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
  const l2_swapAddress: string = l2_swap.address
  const l2_ammWrapperAddress: string = l2_ammWrapper.address

  logger.log('L2 Deployments Complete')
  logger.log('L2 Hop Bridge Token :', l2_hopBridgeTokenAddress)
  logger.log('L2 Bridge           :', l2_bridgeAddress)
  logger.log('L2 Swap  :', l2_swapAddress)
  logger.log('L2 Amm Wrapper  :', l2_ammWrapperAddress)

  updateConfigFile({
    l2_hopBridgeTokenAddress,
    l2_bridgeAddress,
    l2_swapAddress,
    l2_ammWrapperAddress
  })

  return {
    l2_hopBridgeToken,
    l2_bridgeAddress,
    l2_swapAddress
  }
}

const deployAmm = async (
  ethers: any,
  l2_chainId: BigNumber,
  l2_canonicalToken: Contract,
  l2_hopBridgeToken: Contract,
  L2_Swap: ContractFactory,
) => {

  let decimalParams: any[] = []

  if (isChainIdXDai(l2_chainId)) {
    decimalParams.push(overrides)
  }

  const l2_canonicalTokenDecimals = await l2_canonicalToken.decimals(...decimalParams)
  const l2_hopBridgeTokenDecimals = await l2_hopBridgeToken.decimals(...decimalParams)

  // Deploy AMM contracts

  const l2_swap = await L2_Swap.deploy()
  await waitAfterTransaction(l2_swap, ethers)

  console.log('### deployed')

  let initializeParams: any[] = [
    [l2_canonicalToken.address, l2_hopBridgeToken.address],
    [l2_canonicalTokenDecimals, l2_hopBridgeTokenDecimals],
    'Hop DAI LP Token',
    'HOP-LP-DAI',
    '200',
    '4000000',
    '0',
    '0'
  ]

  if (isChainIdXDai(l2_chainId)) {
    initializeParams.push(overrides)
  }

  // ToDo: Pass in true token name and symbol
  const tx = await l2_swap.initialize(...initializeParams)
  await tx.wait()
  await waitAfterTransaction()

  console.log('### initialized')

  return {
    l2_swap
  }
}

const deployBridge = async (
  chainId: BigNumber,
  l1ChainId: BigNumber,
  ethers: any,
  owner: Signer,
  bonder: Signer,
  L2_Bridge: ContractFactory,
  L2_AmmWrapper: ContractFactory,
  l1_bridge: Contract,
  l2_bridge: Contract,
  l2_hopBridgeToken: Contract,
  l2_canonicalToken: Contract,
  l2_swap: Contract,
  l2_ammWrapper: Contract,
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
  l2_ammWrapper = await L2_AmmWrapper.connect(owner).deploy(
    l2_bridge.address,
    l2_canonicalToken.address,
    l2CanonicalTokenIsEth,
    l2_hopBridgeToken.address,
    l2_swap.address
  )
  await waitAfterTransaction(l2_ammWrapper, ethers)

  return {
    l2_bridge,
    l2_ammWrapper
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
