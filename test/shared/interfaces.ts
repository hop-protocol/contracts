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
  otherUser: Signer

  // Factories
  L1_CanonicalBridge: ContractFactory
  L1_Bridge: ContractFactory
  L2_Bridge: ContractFactory
  L1_Messenger: ContractFactory
  L1_MessengerWrapper: ContractFactory
  L2_Messenger: ContractFactory
  L2_HopBridgeToken: ContractFactory
  L2_Swap: ContractFactory
  L2_AmmWrapper: ContractFactory

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
  l2_hopBridgeToken: Contract
  l2_bridge: Contract
  l2_swap: Contract
  l2_ammWrapper: Contract

  // Mocks
  mockAccounting: Contract
  mockBridge: Contract

  // Other
  transfers: Transfer[]
}
