import { ethers } from 'hardhat'
import {
  BigNumber,
  BigNumberish,
  BytesLike,
  Contract,
  Signer,
  utils as ethersUtils
} from 'ethers'
import { expect } from 'chai'
import MerkleTree from '../../lib/MerkleTree'
import {
  USER_INITIAL_BALANCE,
  LIQUIDITY_PROVIDER_INITIAL_BALANCE,
  LIQUIDITY_PROVIDER_AMM_AMOUNT,
  BONDER_INITIAL_BALANCE,
  INITIAL_BONDED_AMOUNT,
  DEFAULT_DEADLINE,
  CHALLENGER_INITIAL_BALANCE,
  DEFAULT_RELAYER_FEE
} from '../../config/constants'

import {
  executeCanonicalMessengerSendMessage,
  executeCanonicalBridgeSendTokens,
  executeL1BridgeSendToL2,
  getSetL1BridgeAddressMessage,
  getSetL1MessengerWrapperAddressMessage,
  getSetAmmWrapperAddressMessage
} from './contractFunctionWrappers'

import { IFixture } from './interfaces'

import {
  isChainIdOptimism,
  isChainIdArbitrum,
  isChainIdXDai
} from '../../config/utils'

/**
 * Initialization functions
 */

export const setUpDefaults = async (
  fixture: IFixture,
  l2ChainId: BigNumber
) => {
  const setUpL1AndL2BridgesOpts = {
    messengerWrapperChainId: l2ChainId
  }

  const distributeCanonicalTokensOpts = {
    userInitialBalance: USER_INITIAL_BALANCE,
    liquidityProviderInitialBalance: LIQUIDITY_PROVIDER_INITIAL_BALANCE,
    bonderInitialBalance: BONDER_INITIAL_BALANCE,
    challengerInitialBalance: CHALLENGER_INITIAL_BALANCE
  }

  const setUpBonderStakeOpts = {
    l2ChainId: l2ChainId,
    bondAmount: INITIAL_BONDED_AMOUNT,
    amountOutMin: BigNumber.from('0'),
    deadline: BigNumber.from('0'),
    relayerFee: DEFAULT_RELAYER_FEE
  }

  const setUpL2AmmMarketOpts = {
    l2ChainId: l2ChainId,
    liquidityProviderBalance: LIQUIDITY_PROVIDER_AMM_AMOUNT,
    amountOutMin: BigNumber.from('0'),
    deadline: BigNumber.from('0'),
    relayerFee: DEFAULT_RELAYER_FEE
  }

  await setUpL2HopBridgeToken(fixture)
  await setUpL1AndL2Messengers(fixture)
  await setUpL1AndL2Bridges(fixture, setUpL1AndL2BridgesOpts)
  await distributeCanonicalTokens(fixture, distributeCanonicalTokensOpts)
  await setUpBonderStake(fixture, setUpBonderStakeOpts)
  await setUpL2AmmMarket(fixture, setUpL2AmmMarketOpts)
}

export const setUpL2HopBridgeToken = async (fixture: IFixture) => {
  const { l2_hopBridgeToken, l2_bridge } = fixture

  await l2_hopBridgeToken.transferOwnership(l2_bridge.address)
}

export const setUpL1AndL2Messengers = async (fixture: IFixture) => {
  const { l1_messenger, l2_messenger } = fixture

  // Set up L1
  await l1_messenger.setTargetMessenger(l2_messenger.address)

  // Set up L2
  await l2_messenger.setTargetMessenger(l1_messenger.address)
}

export const setUpL1AndL2Bridges = async (fixture: IFixture, opts: any) => {
  const {
    governance,
    l1_messenger,
    l1_bridge,
    l1_messengerWrapper,
    l2_bridge,
    l2_messenger,
    l2_ammWrapper
  } = fixture

  const { messengerWrapperChainId } = opts

  // Set up L1
  await l1_bridge.connect(governance).setCrossDomainMessengerWrapper(
    messengerWrapperChainId,
    l1_messengerWrapper.address
  )

  // Set up L2
  let message: string = getSetL1BridgeAddressMessage(l1_bridge)
  await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l2_bridge,
    l2_messenger,
    governance,
    message
  )

  message = getSetL1MessengerWrapperAddressMessage(l1_messengerWrapper)
  await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l2_bridge,
    l2_messenger,
    governance,
    message
  )

  message = getSetAmmWrapperAddressMessage(l2_ammWrapper)
  await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l2_bridge,
    l2_messenger,
    governance,
    message
  )
}

export const distributeCanonicalTokens = async (
  fixture: IFixture,
  opts: any
) => {
  const {
    l1_canonicalToken,
    user,
    liquidityProvider,
    bonder,
    challenger
  } = fixture

  const {
    userInitialBalance,
    liquidityProviderInitialBalance,
    bonderInitialBalance,
    challengerInitialBalance
  } = opts

  await l1_canonicalToken.mint(await user.getAddress(), userInitialBalance)
  await l1_canonicalToken.mint(
    await liquidityProvider.getAddress(),
    liquidityProviderInitialBalance
  )
  await l1_canonicalToken.mint(await bonder.getAddress(), bonderInitialBalance)
  await l1_canonicalToken.mint(
    await challenger.getAddress(),
    challengerInitialBalance
  )
}

export const setUpBonderStake = async (fixture: IFixture, opts: any) => {
  const {
    bonder,
    l1_bridge,
    l1_canonicalToken,
    l2_hopBridgeToken,
    l2_canonicalToken,
    l2_bridge,
    l2_messenger,
    l2_swap
  } = fixture

  const { l2ChainId, bondAmount, amountOutMin, deadline, relayerFee } = opts

  // Stake on L1
  await l1_canonicalToken.connect(bonder).approve(l1_bridge.address, bondAmount)
  await l1_bridge.connect(bonder).stake(await bonder.getAddress(), bondAmount)

  // Stake on L2
  await executeL1BridgeSendToL2(
    l1_canonicalToken,
    l1_bridge,
    l2_hopBridgeToken,
    l2_canonicalToken,
    l2_messenger,
    l2_swap,
    bonder,
    bonder,
    bonder,
    bondAmount,
    amountOutMin,
    deadline,
    relayerFee,
    l2ChainId
  )

  await l2_hopBridgeToken.connect(bonder).approve(l2_bridge.address, bondAmount)
  await l2_bridge.connect(bonder).stake(await bonder.getAddress(), bondAmount)
}

export const setUpL2AmmMarket = async (fixture: IFixture, opts: any) => {
  const {
    l1_bridge,
    l1_canonicalToken,
    l1_canonicalBridge,
    l2_hopBridgeToken,
    l2_messenger,
    liquidityProvider,
    l2_swap,
    l2_canonicalToken
  } = fixture

  const {
    l2ChainId,
    liquidityProviderBalance,
    amountOutMin,
    deadline,
    relayerFee
  } = opts

  // liquidityProvider moves funds across the canonical bridge
  await executeCanonicalBridgeSendTokens(
    l1_canonicalToken,
    l1_canonicalBridge,
    l2_canonicalToken,
    l2_messenger,
    liquidityProvider,
    liquidityProviderBalance
  )

  // liquidityProvider moves funds across the Hop liquidity bridge
  await executeL1BridgeSendToL2(
    l1_canonicalToken,
    l1_bridge,
    l2_hopBridgeToken,
    l2_canonicalToken,
    l2_messenger,
    l2_swap,
    liquidityProvider,
    liquidityProvider,
    liquidityProvider,
    liquidityProviderBalance,
    amountOutMin,
    deadline,
    relayerFee,
    l2ChainId
  )

  // liquidityProvider adds liquidity to the pool on L2
  await l2_canonicalToken
    .connect(liquidityProvider)
    .approve(l2_swap.address, liquidityProviderBalance)
  await l2_hopBridgeToken
    .connect(liquidityProvider)
    .approve(l2_swap.address, liquidityProviderBalance)
  await l2_swap
    .connect(liquidityProvider)
    .addLiquidity(
      [liquidityProviderBalance, liquidityProviderBalance],
      '0',
      DEFAULT_DEADLINE
    )
  await expectBalanceOf(l2_canonicalToken, liquidityProvider, '0')
  await expectBalanceOf(l2_hopBridgeToken, liquidityProvider, '0')

  const ERC20 = await ethers.getContractFactory('@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20')

  const swapStorage = await l2_swap.swapStorage()
  const lpTokenAddress = swapStorage.lpToken
  const lpToken = ERC20.attach(lpTokenAddress)

  const lpTokenTotalBalance: BigNumber = await lpToken.totalSupply()
  await expectBalanceOf(
    lpToken,
    liquidityProvider,
    lpTokenTotalBalance
  )
  await expectBalanceOf(
    l2_canonicalToken,
    l2_swap,
    liquidityProviderBalance
  )
  await expectBalanceOf(
    l2_hopBridgeToken,
    l2_swap,
    liquidityProviderBalance
  )
}

/**
 * General functions
 */

export const expectBalanceOf = async (
  token: Contract,
  account: Signer | Contract,
  expectedBalance: BigNumberish
) => {
  const accountAddress: string =
    account instanceof Signer ? await account.getAddress() : account.address
  const balance: BigNumber = await token.balanceOf(accountAddress)
  expect(balance.toString()).to.eq(BigNumber.from(expectedBalance).toString())
}

export const getL2SpecificArtifact = (chainId: BigNumber) => {
  let l2_bridgeArtifact: string
  let l1_messengerWrapperArtifact: string

  if (isChainIdOptimism(chainId)) {
    l2_bridgeArtifact = 'Mock_L2_OptimismBridge.sol:Mock_L2_OptimismBridge'
    l1_messengerWrapperArtifact =
      'OptimismMessengerWrapper.sol:OptimismMessengerWrapper'
  } else if (isChainIdArbitrum(chainId)) {
    l2_bridgeArtifact = 'Mock_L2_ArbitrumBridge.sol:Mock_L2_ArbitrumBridge'
    l1_messengerWrapperArtifact =
      'ArbitrumMessengerWrapper.sol:ArbitrumMessengerWrapper'
  } else if (isChainIdXDai(chainId)) {
    l2_bridgeArtifact = 'Mock_L2_XDaiBridge.sol:Mock_L2_XDaiBridge'
    l1_messengerWrapperArtifact =
      'XDaiMessengerWrapper.sol:XDaiMessengerWrapper'
  }

  return {
    l2_bridgeArtifact,
    l1_messengerWrapperArtifact
  }
}

export const getRootHashFromTransferId = (transferId: Buffer) => {
  const tree: MerkleTree = new MerkleTree([transferId])
  const rootHash: Buffer = tree.getRoot()
  const rootHashHex: string = tree.getHexRoot()

  return {
    rootHash,
    rootHashHex
  }
}

export const getTransferRootId = (rootHash: string, totalAmount: BigNumber) => {
  return ethers.utils.solidityKeccak256(
    ['bytes32', 'uint256'],
    [rootHash, totalAmount]
  )
}

export const getTransferNonceFromEvent = async (
  l2_bridge: Contract,
  transferIndex: BigNumber = BigNumber.from('0')
): Promise<string> => {
  const transfersSentEvent = await l2_bridge.queryFilter(
    l2_bridge.filters.TransferSent()
  )
  return transfersSentEvent[transferIndex.toNumber()].topics[3]
}

export const getTransferNonce = (
  transferNonceIncrementer: BigNumber,
  chainId: BigNumber
): string => {
  const nonceDomainSeparator = getNonceDomainSeparator()
  return ethers.utils.solidityKeccak256(
    ['bytes32', 'uint256', 'uint256'],
    [nonceDomainSeparator, chainId, transferNonceIncrementer]
  )
}

export const getNonceDomainSeparator = (): string => {
  // keccak256(abi.encodePacked("L2_Bridge v1.0"));
  const domainSeparatorString: string = 'L2_Bridge v1.0'
  return ethers.utils.solidityKeccak256(['string'], [domainSeparatorString])
}

/**
 * Timing functions
 */

export const takeSnapshot = async () => {
  return await ethers.provider.send('evm_snapshot', [])
}

export const revertSnapshot = async (id: string) => {
  await ethers.provider.send('evm_revert', [id])
}

export const mineBlock = async (seconds: number) => {
  const blockTimestamp: number = (await ethers.provider.getBlock('latest'))
    .timestamp
  await ethers.provider.send('evm_mine', [blockTimestamp + seconds])
}

export const increaseTime = async (seconds: number) => {
  await mineBlock(seconds)
}

export const minerStop = async () => {
  await ethers.provider.send('miner_stop', [])
}

export const minerStart = async () => {
  await ethers.provider.send('miner_start', [])
}
