import '@nomiclabs/hardhat-waffle'
import { ethers } from 'hardhat'
import { BigNumber, Contract } from 'ethers'
import Transfer from '../../lib/Transfer'

import { getL2SpecificArtifact } from './utils'
import { IFixture } from './interfaces'

import {
  getMessengerWrapperDefaults,
  getL2ConnectorDefaults,
  isChainIdPolygon
} from '../../config/utils'
import {
  IGetL2BridgeDefaults
} from '../../config/interfaces'
import {
  CHAIN_IDS,
  DEFAULT_DEADLINE,
  DEFAULT_BONDER_FEE,
  TRANSFER_AMOUNT,
  ALL_SUPPORTED_CHAIN_IDS,
  DEFAULT_H_BRIDGE_TOKEN_NAME,
  DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
  DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
  DEFAULT_SWAP_DECIMALS,
  DEFAULT_SWAP_LP_TOKEN_NAME,
  DEFAULT_SWAP_LP_TOKEN_SYMBOL,
  DEFAULT_SWAP_A,
  DEFAULT_SWAP_FEE,
  DEFAULT_SWAP_ADMIN_FEE,
  DEFAULT_SWAP_WITHDRAWAL_FEE,
  ZERO_ADDRESS
} from '../../config/constants'

export async function fixture (
  l1ChainId: BigNumber,
  l2ChainId: BigNumber,
  l1AlreadySetOpts: any = {}
): Promise<IFixture> {
  const {
    l2_connectorArtifact,
    l1_messengerArtifact,
    l1_messengerWrapperArtifact
  } = getL2SpecificArtifact(l2ChainId)
  const accounts = await ethers.getSigners()
  const [
    user,
    liquidityProvider,
    bonder,
    challenger,
    governance,
    relayer,
    otherUser
  ] = accounts

  // Factories
  const L1_CanonicalBridge = await ethers.getContractFactory(
    'contracts/test/Mock_L1_CanonicalBridge.sol:Mock_L1_CanonicalBridge'
  )
  const L1_Bridge = await ethers.getContractFactory(
    'contracts/test/Mock_L1_Bridge.sol:Mock_L1_Bridge'
  )
  const L2_Bridge = await ethers.getContractFactory(
    'contracts/test/Mock_L2_Bridge.sol:Mock_L2_Bridge'
  )
  const L2_Connector = await ethers.getContractFactory(
    `contracts/connectors/${l2_connectorArtifact}`
  )
  const L1_Messenger = await ethers.getContractFactory(
    l1_messengerArtifact
  )
  const L1_MessengerWrapper = await ethers.getContractFactory(
    l1_messengerWrapperArtifact
  )
  const L1_Registry = await ethers.getContractFactory(
    'contracts/bridges/BonderRegistry.sol:BonderRegistry'
  )
  const L2_HopBridgeToken = await ethers.getContractFactory(
    'contracts/bridges/HopBridgeToken.sol:HopBridgeToken'
  )
  const L2_Messenger = await ethers.getContractFactory(
    'contracts/test/Mock_L2_Messenger.sol:Mock_L2_Messenger'
  )

  const FxRoot = await ethers.getContractFactory(
    'contracts/test/MockFxRoot.sol:MockFxRoot'
  )

  const FxChild = await ethers.getContractFactory(
    'contracts/test/MockFxChild.sol:MockFxChild'
  )

  const MathUtils = await ethers.getContractFactory('MathUtils')
  const mathUtils = await MathUtils.deploy()
  await mathUtils.deployed()

  const SwapUtils = await ethers.getContractFactory(
    'SwapUtils',
    {
      libraries: {
        'MathUtils': mathUtils.address
      }
    }
  )
  const swapUtils = await SwapUtils.deploy()
  await swapUtils.deployed()

  const L2_Swap = await ethers.getContractFactory(
    'Swap',
    {
      libraries: {
        'SwapUtils': swapUtils.address
      }
    }
  )

  const L2_AmmWrapper = await ethers.getContractFactory('L2_AmmWrapper')

  // Mock Factories
  const MockERC20 = await ethers.getContractFactory(
    'contracts/test/MockERC20.sol:MockERC20'
  )
  const MockAccounting = await ethers.getContractFactory(
    'contracts/test/Mock_Accounting.sol:Mock_Accounting'
  )
  const MockBridge = await ethers.getContractFactory(
    'contracts/test/Mock_Bridge.sol:Mock_Bridge'
  )

  // Deploy canonical tokens
  let l1_canonicalToken: Contract
  if (l1AlreadySetOpts?.l1CanonicalTokenAddress) {
    l1_canonicalToken = MockERC20.attach(
      l1AlreadySetOpts.l1CanonicalTokenAddress
    )
  } else {
    l1_canonicalToken = await MockERC20.deploy('Dai Stable Token', 'DAI')
  }
  const l2_canonicalToken = await MockERC20.deploy(
    'L2 Dai Stable Token',
    'L2DAI'
  )

  // Deploy canonical messengers
  const l1_messenger = await L1_Messenger.deploy(l1_canonicalToken.address)
  const l2_messenger = await L2_Messenger.deploy(l2_canonicalToken.address)

  // Deploy Polygon-specific messengers
  const stateSender: string = l1_messenger.address
  const fxRoot = await FxRoot.deploy(stateSender)
  const fxChild = await FxChild.deploy()

  // Deploy canonical bridges
  const l1_canonicalBridge = await L1_CanonicalBridge.deploy(
    l1_canonicalToken.address,
    l1_messenger.address
  )

  // Deploy registry
  const l1_registry = await L1_Registry.connect(governance).deploy([await bonder.getAddress()])

  // Deploy Hop L1 contracts
  let l1_bridge: Contract
  if (l1AlreadySetOpts?.l1BridgeAddress) {
    l1_bridge = L1_Bridge.attach(l1AlreadySetOpts.l1BridgeAddress)
  } else {
    l1_bridge = await L1_Bridge.connect(governance).deploy(l1_registry.address, l1_canonicalToken.address)
  }

  // Deploy Hop bridge token
  const l2_hopBridgeToken = await L2_HopBridgeToken.deploy(
    DEFAULT_H_BRIDGE_TOKEN_NAME,
    DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
    DEFAULT_H_BRIDGE_TOKEN_DECIMALS
  )

  // NOTE: Deployments of the Mock bridge require the first param to be the L2 Chain Id
  const l2_bridge = await L2_Bridge.connect(governance).deploy(
    l2ChainId,
    l2_hopBridgeToken.address,
    ALL_SUPPORTED_CHAIN_IDS,
    l1_registry.address
  )

  // Deploy Messenger Wrapper
  const fxChildTunnelAddress: string = ZERO_ADDRESS
  const messengerWrapperDefaults:any[] = getMessengerWrapperDefaults(
    l1ChainId,
    l2ChainId,
    l1_bridge.address,
    l2_bridge.address,
    l1_messenger.address,
    fxChildTunnelAddress,
    fxRoot.address
  )
  const l1_messengerWrapper = await L1_MessengerWrapper.deploy(
    ...messengerWrapperDefaults
  )

  const l2ConnectorDefaults = getL2ConnectorDefaults(
    l2ChainId,
    l1_messengerWrapper.address,
    l2_bridge.address,
    l2_messenger.address,
    l1ChainId,
    fxChild.address
  )
  const l2_bridgeConnector: Contract = await L2_Connector.deploy(
    ...l2ConnectorDefaults
  )

  if (!isChainIdPolygon(l2ChainId)) {
    await l1_messengerWrapper.setXDomainAddress(l2_bridgeConnector.address)
    await l2_bridgeConnector.setXDomainAddress(l1_messengerWrapper.address)
  }

  // Deploy AMM contracts
  const l2_swap = await L2_Swap.deploy()
  await l2_swap.initialize(
    [l2_hopBridgeToken.address, l2_canonicalToken.address],
    DEFAULT_SWAP_DECIMALS,
    DEFAULT_SWAP_LP_TOKEN_NAME,
    DEFAULT_SWAP_LP_TOKEN_SYMBOL,
    DEFAULT_SWAP_A,
    DEFAULT_SWAP_FEE,
    DEFAULT_SWAP_ADMIN_FEE,
    DEFAULT_SWAP_WITHDRAWAL_FEE
  )

  // TODO: automate this
  const l2CanonicalTokenName = await l2_canonicalToken.symbol()
  const l2CanonicalTokenIsEth: boolean = l2CanonicalTokenName === 'WETH'
  const l2_ammWrapper = await L2_AmmWrapper.deploy(
    l2_bridge.address,
    l2_canonicalToken.address,
    l2CanonicalTokenIsEth,
    l2_hopBridgeToken.address,
    l2_swap.address
  )

  // Mocks
  const mockAccounting = await MockAccounting.deploy(l1_registry.address)

  const mockBridge = await MockBridge.deploy(l1_registry.address)

  // Transfers
  const genericTransfer = {
    amount: TRANSFER_AMOUNT,
    transferNonce: 0,
    bonderFee: DEFAULT_BONDER_FEE,
    tokenIndex: BigNumber.from('0'),
    amountOutMin: BigNumber.from('0'),
    destinationTokenIndex: BigNumber.from('0'),
    destinationAmountOutMin: BigNumber.from('0'),
    destinationDeadline: BigNumber.from('0'),
    amountAfterSwap: BigNumber.from('0'),
    bonder
  }

  const transfers: Transfer[] = [
    new Transfer({
      chainId: CHAIN_IDS.ETHEREUM.MAINNET,
      sender: user,
      recipient: user,
      deadline: BigNumber.from('0'),
      ...genericTransfer
    }),
    new Transfer({
      chainId: CHAIN_IDS.OPTIMISM.OPTIMISM_MAINNET,
      sender: user,
      recipient: user,
      tokenIndex: BigNumber.from('1'),
      deadline: DEFAULT_DEADLINE,
      ...genericTransfer
    }),
    new Transfer({
      chainId: CHAIN_IDS.ETHEREUM.MAINNET,
      sender: user,
      recipient: user,
      deadline: BigNumber.from('0'),
      ...genericTransfer
    }),
    new Transfer({
      chainId: CHAIN_IDS.OPTIMISM.OPTIMISM_MAINNET,
      sender: user,
      recipient: user,
      tokenIndex: BigNumber.from('1'),
      deadline: DEFAULT_DEADLINE,
      ...genericTransfer
    })
  ]

  return {
    l1ChainId,
    l2ChainId,
    accounts,
    user,
    liquidityProvider,
    bonder,
    challenger,
    governance,
    relayer,
    otherUser,
    L1_CanonicalBridge,
    L1_Bridge,
    L2_HopBridgeToken,
    L2_Bridge,
    MockERC20,
    L1_MessengerWrapper,
    L1_Messenger,
    L2_Messenger,
    L2_Connector,
    L2_Swap,
    L2_AmmWrapper,
    FxRoot,
    FxChild,
    MockAccounting,
    MockBridge,
    l1_canonicalToken,
    l1_canonicalBridge,
    l1_messenger,
    l1_messengerWrapper,
    l1_bridge,
    l1_registry,
    l2_messenger,
    l2_bridgeConnector,
    l2_hopBridgeToken,
    l2_bridge,
    l2_canonicalToken,
    l2_swap,
    l2_ammWrapper,
    fxRoot,
    fxChild,
    mockAccounting,
    mockBridge,
    transfers
  }
}
