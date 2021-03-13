require('dotenv').config()

import { ethers, ethers as ovmEthers } from 'hardhat'
import { BigNumber, ContractFactory, Signer, Contract } from 'ethers'

import {
  getContractFactories,
  sendChainSpecificBridgeDeposit,
  readConfigFile,
  waitAfterTransaction,
} from '../shared/utils'
import { getMessengerWrapperDefaults } from '../../config/utils'
import { IGetMessengerWrapperDefaults } from '../../config/interfaces'
import {
  ALL_SUPPORTED_CHAIN_IDS,
  LIQUIDITY_PROVIDER_INITIAL_BALANCE,
  ZERO_ADDRESS,
  DEFAULT_ETHERS_OVERRIDES as overrides
} from '../../config/constants'

import {
  getSetL1MessengerWrapperAddressMessage,
  executeCanonicalBridgeSendMessage,
  getAddSupportedChainIdsMessage,
  getSetUniswapWrapperAddressMessage
} from '../../test/shared/contractFunctionWrappers'

// NOTE: Transactions sometimes get stuck during this script. Ensure that each transaction has been made.

interface Config {
  l1_chainId: string | BigNumber
  l2_chainId: string | BigNumber
  l1_messengerAddress: string
  l1_canonicalTokenAddress: string
  l1_bridgeAddress: string
  l2_bridgeAddress: string
  l2_uniswapWrapperAddress: string
}

export async function setupL1 (config: Config) {
  let {
    l1_chainId,
    l2_chainId,
    l1_messengerAddress,
    l1_canonicalTokenAddress,
    l1_bridgeAddress,
    l2_bridgeAddress,
    l2_uniswapWrapperAddress
  } = config

  l1_chainId = BigNumber.from(l1_chainId)
  l2_chainId = BigNumber.from(l2_chainId)

  // Signers
  let accounts: Signer[]
  let owner: Signer
  let liquidityProvider: Signer
  let governance: Signer

  // Factories
  let L1_MockERC20: ContractFactory
  let L1_Bridge: ContractFactory
  let L1_MessengerWrapper: ContractFactory
  let L1_Messenger: ContractFactory
  let L2_Bridge: ContractFactory

  // Contracts
  let l1_canonicalToken: Contract
  let l1_messengerWrapper: Contract
  let l1_bridge: Contract
  let l1_messenger: Contract
  let l2_bridge: Contract

  // Instantiate the wallets
  accounts = await ethers.getSigners()
  owner = accounts[0]
  liquidityProvider = accounts[2]
  governance = owner

  // Get the contract Factories
  ;({
    L1_MockERC20,
    L1_Bridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge
  } = await getContractFactories(l2_chainId, owner, ethers, ovmEthers))

  // Attach already deployed contracts
  l1_messenger = L1_Messenger.attach(l1_messengerAddress)
  l1_canonicalToken = L1_MockERC20.attach(l1_canonicalTokenAddress)
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
  l1_messengerWrapper = await L1_MessengerWrapper.connect(owner).deploy(
    ...messengerWrapperDefaults
  )
  await waitAfterTransaction(l1_messengerWrapper)

  // Set up the L1 bridge
  await l1_bridge.setCrossDomainMessengerWrapper(
    l2_chainId,
    l1_messengerWrapper.address
  )
  await waitAfterTransaction()

  // Set up L2 Bridge state (through the L1 Canonical Messenger)
  let setL1MessengerWrapperAddressParams: string = l1_messengerWrapper.address
  let message: string = getSetL1MessengerWrapperAddressMessage(setL1MessengerWrapperAddressParams)
  await executeCanonicalBridgeSendMessage(
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
  await executeCanonicalBridgeSendMessage(
    l1_messenger,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2_chainId
  )
  await waitAfterTransaction()

  message = getSetUniswapWrapperAddressMessage(l2_uniswapWrapperAddress)
  await executeCanonicalBridgeSendMessage(
    l1_messenger,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2_chainId
  )
  await waitAfterTransaction()

  // Get canonical token to L2
  // NOTE: If this is not the self-mintable testnet DAI, comment this line out
  await l1_canonicalToken
    .connect(owner)
    .mint(
      await liquidityProvider.getAddress(),
      LIQUIDITY_PROVIDER_INITIAL_BALANCE
    )
  await waitAfterTransaction()
  await l1_canonicalToken
    .connect(liquidityProvider)
    .approve(l1_messenger.address, LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await waitAfterTransaction()
  await sendChainSpecificBridgeDeposit(
    l1_chainId,
    liquidityProvider,
    LIQUIDITY_PROVIDER_INITIAL_BALANCE,
    l1_messenger,
    l1_canonicalToken
  )
  await waitAfterTransaction()

  // Get hop token on L2
  // NOTE: If this is not the self-mintable testnet DAI, comment this line out
  await l1_canonicalToken
    .connect(owner)
    .mint(
      await liquidityProvider.getAddress(),
      LIQUIDITY_PROVIDER_INITIAL_BALANCE
    )
  await waitAfterTransaction()
  await l1_canonicalToken
    .connect(liquidityProvider)
    .approve(l1_bridge.address, LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await waitAfterTransaction()

  const amountOutMin: BigNumber = BigNumber.from('0')
  const deadline: BigNumber = BigNumber.from('0')
  const relayerFee: BigNumber = BigNumber.from('0')
  await l1_bridge
    .connect(liquidityProvider)
    .sendToL2(
      l2_chainId,
      await liquidityProvider.getAddress(),
      LIQUIDITY_PROVIDER_INITIAL_BALANCE,
      amountOutMin,
      deadline,
      relayerFee
    )
  await waitAfterTransaction()

  console.log('L1 Setup Complete')
}

if (require.main === module) {
  const {
    l1_chainId,
    l2_chainId,
    l1_messengerAddress,
    l1_canonicalTokenAddress,
    l1_bridgeAddress,
    l2_bridgeAddress,
    l2_uniswapWrapperAddress
  } = readConfigFile()
  setupL1({
    l1_chainId,
    l2_chainId,
    l1_messengerAddress,
    l1_canonicalTokenAddress,
    l1_bridgeAddress,
    l2_bridgeAddress,
    l2_uniswapWrapperAddress
  })
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
}
