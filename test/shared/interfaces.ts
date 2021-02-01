import { ContractFactory, Signer, Contract } from 'ethers'
import Transfer from '../../lib/Transfer'

export interface IFixture {
  // Users
  accounts: Signer[]
  user: Signer
  liquidityProvider: Signer
  bonder: Signer
  challenger: Signer
  governance: Signer
  relayer: Signer
  otherAccount: Signer

  // Factories
  L1_CanonicalBridge: ContractFactory
  L1_Bridge: ContractFactory
  L2_Bridge: ContractFactory
  L1_Messenger: ContractFactory
  L1_MessengerWrapper: ContractFactory
  L2_Messenger: ContractFactory
  L2_UniswapRouter: ContractFactory
  L2_UniswapFactory: ContractFactory

  // Mock Factories
  MockERC20: ContractFactory
  MockAccounting: ContractFactory
  MockBridge: ContractFactory

  // L1
  l1_canonicalBridge: Contract
  l1_canonicalToken: Contract
  l1_messenger: Contract
  l1_bridge: Contract
  l1_messengerWrapper: Contract
  
  // L2
  l2_canonicalToken: Contract
  l2_messenger: Contract
  l2_bridge: Contract
  l2_uniswapFactory: Contract
  l2_uniswapRouter: Contract

  // Mocks
  accounting: Contract
  bridge: Contract

  // Other
  transfers: Transfer[]
}