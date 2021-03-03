require('dotenv').config()

import { network, ethers, ethers as ovmEthers } from 'hardhat'
import { BigNumber, ContractFactory, Signer, Contract } from 'ethers'

import {
  getContractFactories,
  sendChainSpecificBridgeDeposit,
  readConfigFile
} from '../shared/utils'

import { getMessengerWrapperDefaults } from '../../config/utils'
import { IGetMessengerWrapperDefaults } from '../../config/interfaces'
import {
  LIQUIDITY_PROVIDER_INITIAL_BALANCE
} from '../../config/constants'

// NOTE: Transactions sometimes get stuck during this script. Ensure that each transaction has been made.

interface Config {
  l2_chainId: string | BigNumber
  l1_messengerAddress: string
  l1_canonicalTokenAddress: string
  l1_bridgeAddress: string
  l2_bridgeAddress: string
}

export async function setupL1 (config: Config) {
  // Network setup
  const chainId: BigNumber = BigNumber.from(network.config.chainId)

  // Addresses
  let {
    l2_chainId,
    l1_messengerAddress,
    l1_canonicalTokenAddress,
    l1_bridgeAddress,
    l2_bridgeAddress
  } = config

  l2_chainId = BigNumber.from(l2_chainId)

  if (
    !l2_chainId ||
    !l1_messengerAddress ||
    !l1_canonicalTokenAddress ||
    !l1_bridgeAddress ||
    !l2_bridgeAddress
  ) {
    throw new Error('Addresses must be defined')
  }

  // Signers
  let accounts: Signer[]
  let owner: Signer
  let liquidityProvider: Signer

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
  await l1_messengerWrapper.deployed()

  // Set up the L1 bridge
  await l1_bridge.setCrossDomainMessengerWrapper(
    l2_chainId,
    l1_messengerWrapper.address
  )

  // Get canonical token to L2
  // NOTE: If this is not the self-mintable testnet DAI, comment this line out
  await l1_canonicalToken
    .connect(owner)
    .mint(
      await liquidityProvider.getAddress(),
      LIQUIDITY_PROVIDER_INITIAL_BALANCE
    )
  await l1_canonicalToken
    .connect(liquidityProvider)
    .approve(l1_messenger.address, LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await sendChainSpecificBridgeDeposit(
    chainId,
    liquidityProvider,
    LIQUIDITY_PROVIDER_INITIAL_BALANCE,
    l1_messenger,
    l1_canonicalToken
  )

  // Get hop token on L2
  // NOTE: If this is not the self-mintable testnet DAI, comment this line out
  await l1_canonicalToken
    .connect(owner)
    .mint(
      await liquidityProvider.getAddress(),
      LIQUIDITY_PROVIDER_INITIAL_BALANCE
    )
  await l1_canonicalToken
    .connect(liquidityProvider)
    .approve(l1_bridge.address, LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await l1_bridge
    .connect(liquidityProvider)
    .sendToL2(
      l2_chainId,
      await liquidityProvider.getAddress(),
      LIQUIDITY_PROVIDER_INITIAL_BALANCE
    )

  console.log('L1 Setup Complete')
}

if (require.main === module) {
  const {
    l2_chainId,
    l1_messengerAddress,
    l1_canonicalTokenAddress,
    l1_bridgeAddress,
    l2_bridgeAddress
  } = readConfigFile()
  setupL1({
    l2_chainId,
    l1_messengerAddress,
    l1_canonicalTokenAddress,
    l1_bridgeAddress,
    l2_bridgeAddress,
  })
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
}
