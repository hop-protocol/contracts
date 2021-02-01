require('dotenv').config()

import {
  network,
  ethers,
  ethers as ovmEthers
} from 'hardhat'
import { BigNumber, ContractFactory, Signer, Contract } from 'ethers'

import { getContractFactories, sendChainSpecificBridgeDeposit } from '../shared/utils'

import { getMessengerWrapperDefaults } from '../../config/utils'
import { IGetMessengerWrapperDefaults } from '../../config/interfaces'
import { CHAIN_IDS, LIQUIDITY_PROVIDER_INITIAL_BALANCE } from '../../config/constants'

// NOTE: Transactions sometimes get stuck during this script. Ensure that each transaction has been made.

async function setupL1 () {

  // Network setup
  const chainId: BigNumber = BigNumber.from(network.config.chainId)

  // Target L2
  const l2ChainId: BigNumber = BigNumber.from('0')
  if (l2ChainId.eq(0)) {
    throw new Error('Target L2 chain ID must be defined')
  }

  // Addresses
  const l1_messengerAddress: string = ''
  const l1_canonicalTokenAddress: string = ''
  const l1_bridgeAddress: string = ''
  const l2_bridgeAddress: string = ''

  if (!l1_messengerAddress || !l1_canonicalTokenAddress || !l1_bridgeAddress || !l2_bridgeAddress) {
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
  } = await getContractFactories(l2ChainId, owner, ethers, ovmEthers))

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
    l2ChainId,
    l1_bridge.address,
    l2_bridge.address,
    l1_messenger.address
  )
  l1_messengerWrapper = await L1_MessengerWrapper.connect(owner).deploy(...messengerWrapperDefaults)
  await l1_messengerWrapper.deployed()

  // Set up the L1 bridge
  await l1_bridge.setCrossDomainMessengerWrapper(l2ChainId, l1_messengerWrapper.address)

  // Get canonical token to L2
  await l1_canonicalToken.connect(owner).mint(await liquidityProvider.getAddress(), LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await l1_canonicalToken.connect(liquidityProvider).approve(l1_messenger.address, LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await sendChainSpecificBridgeDeposit(
    chainId,
    liquidityProvider,
    LIQUIDITY_PROVIDER_INITIAL_BALANCE,
    l1_messenger,
    l1_canonicalToken
  )

  // Get hop token on L2
  // NOTE: If there is no watcher set up, this transaction will never make it to L2
  await l1_canonicalToken.connect(owner).mint(await liquidityProvider.getAddress(), LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await l1_canonicalToken.connect(liquidityProvider).approve(l1_bridge.address, LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await l1_bridge.connect(liquidityProvider).sendToL2(l2ChainId, await liquidityProvider.getAddress(), LIQUIDITY_PROVIDER_INITIAL_BALANCE)
}

/* tslint:disable-next-line */
(async () => {
  await setupL1()
})()