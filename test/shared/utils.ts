import { ethers } from 'hardhat'
import { BigNumber, Signer, Contract, BigNumberish } from 'ethers'
import { expect } from 'chai'
import {
  USER_INITIAL_BALANCE,
  LIQUIDITY_PROVIDER_INITIAL_BALANCE,
  LIQUIDITY_PROVIDER_UNISWAP_AMOUNT,
  BONDER_INITIAL_BALANCE,
  INITIAL_BONDED_AMOUNT,
  CHALLENGER_INITIAL_BALANCE,
  UNISWAP_LP_MINIMUM_LIQUIDITY
} from '../../config/constants'

import { IFixture } from './interfaces'

import { isChainIdOptimism, isChainIdArbitrum } from '../../config/utils'

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

  const setUpL2UniswapMarketOpts = {
    l2ChainId: l2ChainId,
    liquidityProviderBalance: LIQUIDITY_PROVIDER_UNISWAP_AMOUNT
  }

  await setUpL1AndL2Bridges(fixture, setUpL1AndL2BridgesOpts)
  await setUpL1AndL2Messengers(fixture)
  await distributeCanonicalTokens(fixture, distributeCanonicalTokensOpts)
  await setUpBonderStake(fixture)
  await setUpL2UniswapMarket(fixture, setUpL2UniswapMarketOpts)
}

export const setUpL1AndL2Bridges = async (fixture: IFixture, opts: any) => {
  const {
    l1_bridge,
    l1_messengerWrapper,
    l2_bridge,
    l2_uniswapRouter
  } = fixture

  const { messengerWrapperChainId } = opts

  // Set up L1
  await l1_bridge.setCrossDomainMessengerWrapper(
    messengerWrapperChainId,
    l1_messengerWrapper.address
  )

  // Set up L2
  await l2_bridge.setL1BridgeAddress(l1_bridge.address)
  await l2_bridge.setExchangeAddress(l2_uniswapRouter.address)
}

export const setUpL1AndL2Messengers = async (fixture: IFixture) => {
  const { l1_messenger, l2_messenger } = fixture

  // Set up L1
  await l1_messenger.setTargetMessenger(l2_messenger.address)

  // Set up L2
  await l2_messenger.setTargetMessenger(l1_messenger.address)
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

export const setUpBonderStake = async (fixture: IFixture) => {
  const {
    bonder,
    l1_bridge,
    l1_canonicalToken
  } = fixture

    await l1_canonicalToken
      .connect(bonder)
      .approve(l1_bridge.address, INITIAL_BONDED_AMOUNT)
    await l1_bridge.connect(bonder).stake(INITIAL_BONDED_AMOUNT)
}

export const setUpL2UniswapMarket = async (fixture: IFixture, opts: any) => {
  const {
    l1_bridge,
    l1_canonicalToken,
    l1_canonicalBridge,
    l2_bridge,
    l2_messenger,
    liquidityProvider,
    l2_uniswapRouter,
    l2_uniswapFactory,
    l2_canonicalToken
  } = fixture

  const { l2ChainId, liquidityProviderBalance } = opts

  // liquidityProvider moves funds across the canonical bridge
  await sendTestTokensAcrossCanonicalBridge(
    l1_canonicalToken,
    l1_canonicalBridge,
    l2_canonicalToken,
    l2_messenger,
    liquidityProvider,
    liquidityProviderBalance
  )

  // liquidityProvider moves funds across the Hop liquidity bridge
  await sendTestTokensAcrossHopBridge(
    l1_canonicalToken,
    l1_bridge,
    l2_bridge,
    l2_messenger,
    liquidityProvider,
    liquidityProviderBalance,
    l2ChainId
  )

  // liquidityProvider adds liquidity to the pool on L2
  await l2_canonicalToken
    .connect(liquidityProvider)
    .approve(l2_uniswapRouter.address, liquidityProviderBalance)
  await l2_bridge
    .connect(liquidityProvider)
    .approve(l2_uniswapRouter.address, liquidityProviderBalance)
  await l2_uniswapRouter
    .connect(liquidityProvider)
    .addLiquidity(
      l2_canonicalToken.address,
      l2_bridge.address,
      liquidityProviderBalance,
      liquidityProviderBalance,
      '0',
      '0',
      await liquidityProvider.getAddress(),
      '999999999999'
    )
  await expectBalanceOf(l2_canonicalToken, liquidityProvider, '0')
  await expectBalanceOf(l2_bridge, liquidityProvider, '0')

  const l2_uniswapPairAddress: string = await l2_uniswapFactory.getPair(
    l2_canonicalToken.address,
    l2_bridge.address
  )
  const l2_uniswapPair: Contract = await ethers.getContractAt(
    '@uniswap/v2-core/contracts/UniswapV2Pair.sol:UniswapV2Pair',
    l2_uniswapPairAddress
  )
  const lpTokenTotalBalance: BigNumber = await l2_uniswapPair.totalSupply()
  const expectedLiquidityProviderBalance = lpTokenTotalBalance.sub(
    UNISWAP_LP_MINIMUM_LIQUIDITY
  )
  await expectBalanceOf(
    l2_uniswapPair,
    liquidityProvider,
    expectedLiquidityProviderBalance
  )
  await expectBalanceOf(
    l2_canonicalToken,
    l2_uniswapPair,
    liquidityProviderBalance
  )
  await expectBalanceOf(l2_bridge, l2_uniswapPair, liquidityProviderBalance)
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

export const sendTestTokensAcrossCanonicalBridge = async (
  l1_canonicalToken: Contract,
  l1_canonicalBridge: Contract,
  l2_canonicalToken: Contract,
  l2_messenger: Contract,
  account: Signer,
  amount: BigNumber
) => {
  await l1_canonicalToken
    .connect(account)
    .approve(l1_canonicalBridge.address, amount)
  await l1_canonicalBridge
    .connect(account)
    .sendMessage(l2_canonicalToken.address, await account.getAddress(), amount)
  await l2_messenger.relayNextMessage()
  await expectBalanceOf(l2_canonicalToken, account, amount)
}

export const sendTestTokensAcrossHopBridge = async (
  l1_canonicalToken: Contract,
  l1_bridge: Contract,
  l2_bridge: Contract,
  l2_messenger: Contract,
  account: Signer,
  amount: BigNumber,
  l2ChainId: BigNumber
) => {
  await l1_canonicalToken.connect(account).approve(l1_bridge.address, amount)
  await l1_bridge
    .connect(account)
    .sendToL2(l2ChainId, await account.getAddress(), amount)
  await l2_messenger.relayNextMessage()
  await expectBalanceOf(l2_bridge, account, amount)
}

export const getL2SpecificArtifact = (chainId: BigNumber) => {
  let l2_bridgeArtifact: string
  let l1_messengerWrapperArtifact: string

  if (isChainIdOptimism(chainId)) {
    l2_bridgeArtifact = 'L2_OptimismBridge.sol:L2_OptimismBridge'
    l1_messengerWrapperArtifact =
      'OptimismMessengerWrapper.sol:OptimismMessengerWrapper'
  } else if (isChainIdArbitrum(chainId)) {
    l2_bridgeArtifact = 'L2_ArbitrumBridge.sol:L2_ArbitrumBridge'
    l1_messengerWrapperArtifact =
      'ArbitrumMessengerWrapper.sol:ArbitrumMessengerWrapper'
  }

  return {
    l2_bridgeArtifact,
    l1_messengerWrapperArtifact
  }
}

export const getTransferRootId = (rootHash: string, totalAmount: BigNumber) => {
  return ethers.utils.solidityKeccak256(['bytes32', 'uint256'], [rootHash, totalAmount])
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

export const mineBlock = async () => {
  const timestamp: number = Date.now()
  await ethers.provider.send('evm_mine', [timestamp])
}

export const increaseTime = async (seconds: number) => {
  await ethers.provider.send('evm_increaseTime', [seconds])
  await mineBlock()
}

export const minerStop = async () => {
  await ethers.provider.send('miner_stop', [])
}

export const minerStart = async () => {
  await ethers.provider.send('miner_start', [])
}
