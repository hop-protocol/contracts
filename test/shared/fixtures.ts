import '@nomiclabs/hardhat-waffle'
import { ethers } from 'hardhat'
import { BigNumber, Contract } from 'ethers'
import Transfer from '../../lib/Transfer'

import { getL2SpecificArtifact } from './utils'
import { IFixture } from './interfaces'

import {
  getMessengerWrapperDefaults,
  getL2BridgeDefaults
} from '../../config/utils'
import { IGetL2BridgeDefaults } from '../../config/interfaces'
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
  DEFAULT_SWAP_WITHDRAWAL_FEE
} from '../../config/constants'

export async function fixture (
  l1ChainId: BigNumber,
  l2ChainId: BigNumber,
  l1AlreadySetOpts: any = {}
): Promise<IFixture> {
  const {
    l2_bridgeArtifact,
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
    'contracts/test/Mock_L1_ERC20_Bridge.sol:Mock_L1_ERC20_Bridge'
  )
  const L2_Bridge = await ethers.getContractFactory(
    `contracts/test/${l2_bridgeArtifact}`
  )
  const L1_Messenger = await ethers.getContractFactory(l1_messengerArtifact)
  const L1_MessengerWrapper = await ethers.getContractFactory(
    l1_messengerWrapperArtifact
  )
  const L2_HopBridgeToken = await ethers.getContractFactory(
    'contracts/bridges/HopBridgeToken.sol:HopBridgeToken'
  )
  const L2_Messenger = await ethers.getContractFactory(
    'contracts/test/Mock_L2_Messenger.sol:Mock_L2_Messenger'
  )
  const L2_MessengerProxy = await ethers.getContractFactory(
    'contracts/bridges/L2_PolygonMessengerProxy.sol:L2_PolygonMessengerProxy'
  )
  const L2_PolygonZkEvmMessengerProxy = await ethers.getContractFactory(
    'contracts/bridges/L2_PolygonZkEvmMessengerProxy.sol:L2_PolygonZkEvmMessengerProxy'
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

  const SwapUtils = await ethers.getContractFactory('SwapUtils', {
    libraries: {
      MathUtils: mathUtils.address
    }
  })
  const swapUtils = await SwapUtils.deploy()
  await swapUtils.deployed()

  const L2_Swap = await ethers.getContractFactory('Swap', {
    libraries: {
      SwapUtils: swapUtils.address
    }
  })

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

  // Deploy Hop L1 contracts
  let l1_bridge: Contract
  if (l1AlreadySetOpts?.l1BridgeAddress) {
    l1_bridge = L1_Bridge.attach(l1AlreadySetOpts.l1BridgeAddress)
  } else {
    l1_bridge = await L1_Bridge.deploy(
      l1_canonicalToken.address,
      [await bonder.getAddress()],
      await governance.getAddress()
    )
  }

  // Deploy Hop bridge token
  const l2_hopBridgeToken = await L2_HopBridgeToken.deploy(
    DEFAULT_H_BRIDGE_TOKEN_NAME,
    DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
    DEFAULT_H_BRIDGE_TOKEN_DECIMALS
  )

  // Deploy Messenger Proxy
  const l2_messengerProxy: Contract = await L2_MessengerProxy.deploy(
    fxChild.address
  )

  // Deploy Hop L2 contracts
  let supportedChainIds: BigNumber[] = ALL_SUPPORTED_CHAIN_IDS
  supportedChainIds = supportedChainIds.filter(
    chainId => chainId.toString() !== l2ChainId.toString()
  )
  let l2BridgeDefaults: IGetL2BridgeDefaults[] = getL2BridgeDefaults(
    l2ChainId,
    l2_messenger.address,
    l2_messengerProxy.address,
    await governance.getAddress(),
    l2_hopBridgeToken.address,
    l1_bridge.address,
    supportedChainIds,
    [await bonder.getAddress()],
    l1ChainId
  )
  // NOTE: Deployments of the Mock bridge require the first param to be the L2 Chain Id
  const l2_bridge = await L2_Bridge.deploy(l2ChainId, ...l2BridgeDefaults)

  // Deploy Messenger Wrapper
  const fxChildTunnelAddress: string = l2_messengerProxy.address
  const messengerWrapperDefaults: any[] = getMessengerWrapperDefaults(
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

  // Deploy AMM contracts
  const l2_swap = await L2_Swap.deploy()
  await l2_swap.initialize(
    [l2_canonicalToken.address, l2_hopBridgeToken.address],
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
  const mockAccounting = await MockAccounting.deploy([
    await bonder.getAddress()
  ])
  const mockBridge = await MockBridge.deploy([await bonder.getAddress()])

  // Transfers
  const genericTransfer = {
    amount: TRANSFER_AMOUNT,
    transferNonce: 0,
    bonderFee: DEFAULT_BONDER_FEE,
    amountOutMin: BigNumber.from('0'),
    destinationAmountOutMin: BigNumber.from('0'),
    destinationDeadline: BigNumber.from('0'),
    amountAfterSwap: BigNumber.from('0')
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
      chainId: CHAIN_IDS.ARBITRUM.ARBITRUM_TESTNET,
      sender: user,
      recipient: user,
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
      chainId: CHAIN_IDS.ARBITRUM.ARBITRUM_TESTNET,
      sender: user,
      recipient: user,
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
    L2_MessengerProxy,
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
    l2_messenger,
    l2_messengerProxy,
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
