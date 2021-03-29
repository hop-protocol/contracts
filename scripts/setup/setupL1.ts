require('dotenv').config()

import { ethers, l2ethers as ovmEthers } from 'hardhat'
import { BigNumber, ContractFactory, Signer, Contract, providers } from 'ethers'

import {
  getContractFactories,
  sendChainSpecificBridgeDeposit,
  readConfigFile,
  waitAfterTransaction,
  Logger
} from '../shared/utils'
import { getMessengerWrapperDefaults } from '../../config/utils'
import { IGetMessengerWrapperDefaults } from '../../config/interfaces'
import {
  ALL_SUPPORTED_CHAIN_IDS,
  LIQUIDITY_PROVIDER_INITIAL_BALANCE,
  ZERO_ADDRESS
} from '../../config/constants'

import {
  getSetL1MessengerWrapperAddressMessage,
  executeCanonicalMessengerSendMessage,
  getAddSupportedChainIdsMessage,
  getSetAmmWrapperAddressMessage
} from '../../test/shared/contractFunctionWrappers'

const logger = Logger('setupL1')

interface Config {
  l1_chainId: string | BigNumber
  l2_chainId: string | BigNumber
  l1_tokenBridgeAddress: string
  l1_messengerAddress: string
  l1_canonicalTokenAddress: string
  l1_bridgeAddress: string
  l2_canonicalTokenAddress: string
  l2_bridgeAddress: string
  l2_ammWrapperAddress: string
}

export async function setupL1 (config: Config) {
  logger.log('setup L1')

  let {
    l1_chainId,
    l2_chainId,
    l1_tokenBridgeAddress,
    l1_messengerAddress,
    l1_canonicalTokenAddress,
    l1_bridgeAddress,
    l2_canonicalTokenAddress,
    l2_bridgeAddress,
    l2_ammWrapperAddress
  } = config

  logger.log(`config:
            l1_chainId: ${l1_chainId}
            l2_chainId: ${l2_chainId}
            l1_messengerAddress: ${l1_messengerAddress}
            l1_tokenBridgeAddress: ${l1_tokenBridgeAddress}
            l1_canonicalTokenAddress: ${l1_canonicalTokenAddress}
            l1_bridgeAddress: ${l1_bridgeAddress}
            l2_canonicalTokenAddress: ${l2_canonicalTokenAddress}
            l2_bridgeAddress: ${l2_bridgeAddress}
            l2_ammWrapperAddress: ${l2_ammWrapperAddress}`)

  l1_chainId = BigNumber.from(l1_chainId)
  l2_chainId = BigNumber.from(l2_chainId)

  // Signers
  let accounts: Signer[]
  let owner: Signer
  let liquidityProvider: Signer
  let governance: Signer

  // Factories
  let L1_MockERC20: ContractFactory
  let L1_TokenBridge: ContractFactory
  let L1_Bridge: ContractFactory
  let L1_MessengerWrapper: ContractFactory
  let L1_Messenger: ContractFactory
  let L2_Bridge: ContractFactory

  // Contracts
  let l1_canonicalToken: Contract
  let l1_tokenBridge: Contract
  let l1_messengerWrapper: Contract
  let l1_bridge: Contract
  let l1_messenger: Contract
  let l2_canonicalToken: Contract
  let l2_bridge: Contract

  // Instantiate the wallets
  accounts = await ethers.getSigners()
  owner = accounts[0]
  liquidityProvider = accounts[2]
  governance = owner

  logger.log('owner:', await owner.getAddress())
  logger.log('liquidity provider:', await liquidityProvider.getAddress())
  logger.log('governance:', await governance.getAddress())

  // Transaction
  let tx: providers.TransactionResponse

  logger.log('getting contract factories')
  // Get the contract Factories
  ;({
    L1_MockERC20,
    L1_TokenBridge,
    L1_Bridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge
  } = await getContractFactories(l2_chainId, owner, ethers, ovmEthers))

  logger.log('attaching deployed contracts')
  // Attach already deployed contracts
  l1_tokenBridge = L1_TokenBridge.attach(l1_tokenBridgeAddress)
  l1_messenger = L1_Messenger.attach(l1_messengerAddress)
  l1_canonicalToken = L1_MockERC20.attach(l1_canonicalTokenAddress)
  l2_canonicalToken = L1_MockERC20.attach(l2_canonicalTokenAddress)
  l1_bridge = L1_Bridge.attach(l1_bridgeAddress)
  l2_bridge = L2_Bridge.attach(l2_bridgeAddress)

  /**
   * Setup
   */

  // Deploy messenger wrapper
  const messengerWrapperDefaults: IGetMessengerWrapperDefaults[] = getMessengerWrapperDefaults(
    l2_chainId,
    l1_bridge.address,
    l2_bridge.address,
    l1_messenger.address
  )

  logger.log('deploying L1 messenger wrapper')
  l1_messengerWrapper = await L1_MessengerWrapper.connect(owner).deploy(
    ...messengerWrapperDefaults
  )
  await waitAfterTransaction(l1_messengerWrapper)

  logger.log('setting cross domain messenger wrapper on L1 bridge')
  // Set up the L1 bridge
  tx = await l1_bridge.setCrossDomainMessengerWrapper(
    l2_chainId,
    l1_messengerWrapper.address
  )
  await tx.wait()
  await waitAfterTransaction()

  // Set up L2 Bridge state (through the L1 Canonical Messenger)
  let setL1MessengerWrapperAddressParams: string = l1_messengerWrapper.address
  let message: string = getSetL1MessengerWrapperAddressMessage(
    setL1MessengerWrapperAddressParams
  )

  logger.log('setting L1 messenger wrapper address on L2 bridge')
  await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2_chainId
  )
  await waitAfterTransaction()

  let addSupportedChainIdsParams: any[] = ALL_SUPPORTED_CHAIN_IDS
  message = getAddSupportedChainIdsMessage(addSupportedChainIdsParams)

  logger.log('setting supported chain IDs on L2 bridge')
  logger.log(
    'chain IDs:',
    ALL_SUPPORTED_CHAIN_IDS.map(v => v.toString()).join(', ')
  )
  await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2_chainId
  )
  await waitAfterTransaction()

  message = getSetAmmWrapperAddressMessage(l2_ammWrapperAddress)

  logger.log('setting amm wrapper address on L2 bridge')
  await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2_chainId
  )
  await waitAfterTransaction()

  logger.log('minting L1 canonical token')
  // Get canonical token to L2
  // NOTE: If this is not the self-mintable testnet DAI, comment this line out
  tx = await l1_canonicalToken
    .connect(owner)
    .mint(
      await liquidityProvider.getAddress(),
      LIQUIDITY_PROVIDER_INITIAL_BALANCE
    )
  await tx.wait()
  await waitAfterTransaction()

  logger.log('approving L1 canonical token')
  tx = await l1_canonicalToken
    .connect(liquidityProvider)
    .approve(l1_tokenBridge.address, LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await tx.wait()
  await waitAfterTransaction()

  logger.log('sending chain specific bridge deposit')
  await sendChainSpecificBridgeDeposit(
    l2_chainId,
    liquidityProvider,
    LIQUIDITY_PROVIDER_INITIAL_BALANCE,
    l1_tokenBridge,
    l1_canonicalToken,
    l2_canonicalToken
  )
  await waitAfterTransaction()

  logger.log('minting L1 canonical token')
  // Get hop token on L2
  // NOTE: If this is not the self-mintable testnet DAI, comment this line out
  tx = await l1_canonicalToken
    .connect(owner)
    .mint(
      await liquidityProvider.getAddress(),
      LIQUIDITY_PROVIDER_INITIAL_BALANCE
    )
  await tx.wait()
  await waitAfterTransaction()

  logger.log('approving L1 canonical token')
  tx = await l1_canonicalToken
    .connect(liquidityProvider)
    .approve(l1_bridge.address, LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await tx.wait()
  await waitAfterTransaction()

  const amountOutMin: BigNumber = BigNumber.from('0')
  const deadline: BigNumber = BigNumber.from('0')
  const relayerFee: BigNumber = BigNumber.from('0')

  logger.log('sending token to L2')
  tx = await l1_bridge
    .connect(liquidityProvider)
    .sendToL2(
      l2_chainId,
      await liquidityProvider.getAddress(),
      LIQUIDITY_PROVIDER_INITIAL_BALANCE,
      amountOutMin,
      deadline,
      relayerFee
    )
  await tx.wait()
  await waitAfterTransaction()

  logger.log('L1 Setup Complete')
}

if (require.main === module) {
  const {
    l1_chainId,
    l2_chainId,
    l1_tokenBridgeAddress,
    l1_messengerAddress,
    l1_canonicalTokenAddress,
    l1_bridgeAddress,
    l2_canonicalTokenAddress,
    l2_bridgeAddress,
    l2_ammWrapperAddress
  } = readConfigFile()
  setupL1({
    l1_chainId,
    l2_chainId,
    l1_tokenBridgeAddress,
    l1_messengerAddress,
    l1_canonicalTokenAddress,
    l2_canonicalTokenAddress,
    l1_bridgeAddress,
    l2_bridgeAddress,
    l2_ammWrapperAddress
  })
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      logger.error(error)
      process.exit(1)
    })
}
