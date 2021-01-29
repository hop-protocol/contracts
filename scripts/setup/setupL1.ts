require('dotenv').config()

import { network, ethers } from 'hardhat'
import { BigNumber, ContractFactory, Signer, Wallet, Contract } from 'ethers'
import { LIQUIDITY_PROVIDER_INITIAL_BALANCE, CHAIN_IDS } from '../../../test/shared/constants'
import { getContractFactories, sendChainSpecificBridgeDeposit } from '../utils'

const USER_INITIAL_BALANCE = BigNumber.from('500000000000000000000')
const LARGE_APPROVAL = BigNumber.from('999999999999999999999999999999999999')

async function setupL1 () {

  // Network setup
  const chainId: BigNumber = BigNumber.from(network.config.chainId)

  // Target L2
  const l2ChainId: BigNumber = // TODO
  if (!l2ChainId) {
    throw new Error('Target L2 chain ID must be defined')
  }

  // Addresses
  const l1_messengerAddress: string = ''
  const l1_canonicalTokenAddress: string = ''
  const l1_bridgeAddress: string = ''
  const messengerWrapperAddress: string = ''

  if (!l1_messengerAddress || !l1_canonicalTokenAddress || !l1_bridgeAddress || !messengerWrapperAddress) {
    throw new Error('Addresses must be defined')
  }

  // Signers
  let accounts: Signer[]
  let bonder: Signer

  // Factories
  let MockERC20: ContractFactory
  let L1_Bridge: ContractFactory
  let MessengerWrapper: ContractFactory
  let L1_Messenger: ContractFactory

  // Contracts
  let l1_canonicalToken: Contract
  let messengerWrapper: Contract
  let l1_bridge: Contract
  let l1_messenger: Contract
  
  // Instantiate the wallets
  accounts = await ethers.getSigners()
  bonder = accounts[0]

  // Get the contract Factories
  ;({ 
    MockERC20,
    L1_Bridge,
    L1_Messenger,
    MessengerWrapper
  } = await getContractFactories(l2ChainId, ethers, bonder))

  // Attach already deployed contracts
  l1_messenger = L1_Messenger.attach(l1_messengerAddress)
  l1_canonicalToken = MockERC20.attach(l1_canonicalTokenAddress)
  l1_bridge = L1_Bridge.attach(l1_bridgeAddress)
  messengerWrapper = MessengerWrapper.attach(messengerWrapperAddress)

  /**
   * Setup
   */

  // Set up the L1 bridge
  await l1_bridge.setCrossDomainMessengerWrapper(l2ChainId, messengerWrapper.address)

  // Get canonical token to L2
  await l1_canonicalToken.mint(await bonder.getAddress(), LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await l1_canonicalToken.approve(l1_messenger.address, LARGE_APPROVAL)
  await sendChainSpecificBridgeDeposit(
    chainId,
    bonder,
    LIQUIDITY_PROVIDER_INITIAL_BALANCE,
    l1_messenger,
    l1_canonicalToken
  )

  // Get hop token on L2
  await l1_canonicalToken.mint(await bonder.getAddress(), LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await l1_canonicalToken.approve(l1_bridge.address, LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  await l1_bridge.sendToL2(l2ChainId, await bonder.getAddress(), LIQUIDITY_PROVIDER_INITIAL_BALANCE)

  // TODO: Do we need to add DAI to bonder on L1 to match this direct L2 mint?
}

/* tslint:disable-next-line */
(async () => {
  await setupL1()
})()