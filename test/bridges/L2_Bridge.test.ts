import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber, utils } from 'ethers'
import Transfer from '../../lib/Transfer'

import {
  setUpDefaults,
  expectBalanceOf,
  getRootHashFromTransferId,
  increaseTime,
  revertSnapshot,
  takeSnapshot
} from '../shared/utils'
import {
  executeCanonicalBridgeSendMessage,
  executeL1BridgeSendToL2,
  executeL1BridgeSendToL2AndAttemptToSwap,
  executeL1BridgeBondWithdrawal,
  executeL1BridgeBondTransferRoot,
  executeL1BridgeSettleBondedWithdrawals,
  executeL1BridgeChallengeTransferBond,
  executeL1BridgeResolveChallenge,
  executeL2BridgeSend,
  executeL2BridgeSwapAndSend,
  executeL2BridgeCommitTransfers,
  executeL2BridgeBondWithdrawalAndAttemptSwap
} from '../shared/contractFunctionWrappers'
import { fixture } from '../shared/fixtures'
import { IFixture } from '../shared/interfaces'

import {
  CHAIN_IDS,
  ALL_SUPPORTED_CHAIN_IDS,
  DEFAULT_AMOUNT_OUT_MIN,
  DEFAULT_DEADLINE,
  ONE_ADDRESS,
  INITIAL_BONDED_AMOUNT,
  LIQUIDITY_PROVIDER_UNISWAP_AMOUNT,
  ZERO_ADDRESS,
  SECONDS_IN_AN_HOUR,
  TIMESTAMP_VARIANCE,
  DEAD_ADDRESS,
  ARBITRARY_ROOT_HASH,
  DEFAULT_H_TOKEN_NAME,
  DEFAULT_H_TOKEN_SYMBOL,
  DEFAULT_H_TOKEN_DECIMALS,
  DEFAULT_TIME_TO_WAIT
} from '../../config/constants'

describe('L2_Bridge', () => {
  let _fixture: IFixture
  let l2ChainId: BigNumber
  let l22ChainId: BigNumber

  let user: Signer
  let bonder: Signer
  let governance: Signer

  let l1_canonicalToken: Contract
  let l1_bridge: Contract
  let l1_canonicalBridge: Contract
  let l1_messenger: Contract
  let l2_canonicalToken: Contract
  let l2_bridge: Contract
  let l2_messenger: Contract
  let l2_uniswapRouter: Contract
  let l22_bridge: Contract
  let l22_messenger: Contract

  let transfers: Transfer[]
  let transfer: Transfer
  let l2Transfer: Transfer

  let originalBondedAmount: BigNumber

  let beforeAllSnapshotId: string
  let snapshotId: string

  before(async () => {
    beforeAllSnapshotId = await takeSnapshot()

    l2ChainId = CHAIN_IDS.OPTIMISM.TESTNET_1
    l22ChainId = CHAIN_IDS.ARBITRUM.TESTNET_3

    _fixture = await fixture(l2ChainId)
    await setUpDefaults(_fixture, l2ChainId)
    ;({
      user,
      bonder,
      governance,
      l1_canonicalToken,
      l1_bridge,
      l1_messenger,
      l1_canonicalBridge,
      l2_canonicalToken,
      l2_bridge,
      l2_messenger,
      l2_uniswapRouter,
      transfers
    } = _fixture)

    const l1AlreadySetOpts = {
      l1BridgeAddress: l1_bridge.address,
      l1CanonicalTokenAddress: l1_canonicalToken.address
    }
    _fixture = await fixture(l22ChainId, l1AlreadySetOpts)
    await setUpDefaults(_fixture, l22ChainId)
    ;({
      l2_bridge: l22_bridge,
      l2_messenger: l22_messenger,
    } = _fixture)

    transfer = transfers[0]
    l2Transfer = transfers[1]

    originalBondedAmount = LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.add(INITIAL_BONDED_AMOUNT)

    // All tests in L2 Bridge will require sending tokens to the L2 bridge first
    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_bridge,
      l2_messenger,
      transfer.sender,
      transfer.amount,
      l2ChainId
    )
  })

  after(async() => {
    await revertSnapshot(beforeAllSnapshotId)
  })

  // Take snapshot before each test and revert after each test
  beforeEach(async() => {
    snapshotId = await takeSnapshot()
  })

  afterEach(async() => {
    await revertSnapshot(snapshotId)
  })

  /**
   * Unit tests
   */

  it('Should set the correct values in the constructor', async () => {
    const expectedL1GovernanceAddress: string = await governance.getAddress()
    const expectedL2CanonicalTokenAddress: string = l2_canonicalToken.address
    const expectedL1BridgeAddress: string = l1_bridge.address
    const expectedIsChainIdSupported: boolean = true
    const expectedIsBonder: boolean = true
    const expectedExchangeAddress: string = l2_uniswapRouter.address
    const expectedName: string = DEFAULT_H_TOKEN_NAME
    const expectedSymbol: string = DEFAULT_H_TOKEN_SYMBOL
    const expectedDecimals: number = DEFAULT_H_TOKEN_DECIMALS

    const l1GovernanceAddress = await l2_bridge.l1Governance()
    const l2CanonicalTokenAddress = await l2_bridge.l2CanonicalToken()
    const l1BridgeAddress = await l2_bridge.l1BridgeAddress()
    const isBonder = await l2_bridge.getIsBonder(await bonder.getAddress())
    const exchangeAddress: string = await l2_bridge.exchangeAddress()
    const name: string = await l2_bridge.name()
    const symbol: string = await l2_bridge.symbol()
    const decimals: number = await l2_bridge.decimals()

    expect(expectedL1GovernanceAddress).to.eq(l1GovernanceAddress)
    expect(expectedL2CanonicalTokenAddress).to.eq(l2CanonicalTokenAddress)
    expect(expectedL1BridgeAddress).to.eq(l1BridgeAddress)
    expect(expectedIsBonder).to.eq(isBonder)
    expect(expectedExchangeAddress).to.eq(exchangeAddress)
    expect(expectedName).to.eq(name)
    expect(expectedSymbol).to.eq(symbol)
    expect(expectedDecimals).to.eq(decimals)

    for (let i = 0; i < ALL_SUPPORTED_CHAIN_IDS.length; i++) {
      const isChainIdSupported = await l2_bridge.supportedChainIds(
        ALL_SUPPORTED_CHAIN_IDS[i]
      )
      expect(expectedIsChainIdSupported).to.eq(isChainIdSupported)
    }
  })

  describe('getters', async () => {
    it('Should set the exchange address arbitrarily', async () => {
      const expectedExchangeAddress: string = ONE_ADDRESS

      await l2_bridge
        .connect(governance)
        .setExchangeAddress(expectedExchangeAddress)
      const exchangeAddress: string = await l2_bridge.exchangeAddress()
      expect(exchangeAddress).to.eq(expectedExchangeAddress)
    })

    it('Should set the L1 bridge address arbitrarily', async () => {
      const expectedL1BridgeAddress: string = ONE_ADDRESS

      await l2_bridge
        .connect(governance)
        .setL1BridgeAddress(expectedL1BridgeAddress)
      const l1BridgeAddress: string = await l2_bridge.l1BridgeAddress()
      expect(l1BridgeAddress).to.eq(expectedL1BridgeAddress)
    })

    it('Should set the messenger gas limit arbitrarily', async () => {
      const expectedMessengerGasLimit: BigNumber = BigNumber.from('123')

      await l2_bridge
        .connect(governance)
        .setMessengerGasLimit(expectedMessengerGasLimit)
      const messengerGasLimit: BigNumber = await l2_bridge.messengerGasLimit()
      expect(messengerGasLimit).to.eq(expectedMessengerGasLimit)
    })

    it('Should add support for a new chainId', async () => {
      const newChainId: BigNumber = BigNumber.from('13371337')

      await l2_bridge.connect(governance).addSupportedChainIds([newChainId])
      const isChainIdSupported: boolean = await l2_bridge.supportedChainIds(newChainId)
      expect(isChainIdSupported).to.eq(true)
    })

    it('Should add support for a new chainId then remove it', async () => {
      const newChainId: BigNumber = BigNumber.from('13371337')

      await l2_bridge.connect(governance).addSupportedChainIds([newChainId])

      let isChainIdSupported: boolean = await l2_bridge.supportedChainIds(newChainId)
      expect(isChainIdSupported).to.eq(true)

      await l2_bridge.connect(governance).removeSupportedChainIds([newChainId])

      isChainIdSupported = await l2_bridge.supportedChainIds(newChainId)
      expect(isChainIdSupported).to.eq(false)
    })

    it('Should set the minimum force commit delay arbitrarily', async () => {
      const expectedMinimumForceCommitDelay: BigNumber = BigNumber.from('123')

      await l2_bridge
        .connect(governance)
        .setMinimumForceCommitDelay(expectedMinimumForceCommitDelay)
      const minimumForceCommitDelay: BigNumber = await l2_bridge.minimumForceCommitDelay()
      expect(minimumForceCommitDelay).to.eq(expectedMinimumForceCommitDelay)
    })
  })

  describe('send', async () => {
    it('Should send tokens to L1 via send', async () => {
      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )
    })
  })

  describe('swapAndSend', async () => {
    it('Should send tokens to L2 via swapAndSend', async () => {
      // Add the canonical token to the users' address on L2
      await executeCanonicalBridgeSendMessage(
        l1_canonicalToken,
        l1_canonicalBridge,
        l2_canonicalToken,
        l2_messenger,
        user,
        transfer.amount
      )

      await executeL2BridgeSwapAndSend(
        l2_bridge,
        l2_canonicalToken,
        l2_uniswapRouter,
        l2Transfer
      )
    })
  })

  describe('commitTransfers', async () => {
    it('Should commit a transfer automatically after 100 sends', async () => {
    })
    it.only('Should commit a transfer after the minForceCommitTime', async () => {
      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )


      const timeToWait: number = 4 * SECONDS_IN_AN_HOUR
      await increaseTime(timeToWait)

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        user,
       timeToWait 
      )
    })
    it('Should commit a transfer by the bonder at any time', async () => {
      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )
    })

  it('Should mint hTokens', async () => {
  //   const tokenAmount: BigNumber = USER_INITIAL_BALANCE

  //   // Verify no tokens available
  //   let expectedBalance: BigNumber = BigNumber.from('0')
  //   await expectBalanceOf(l2_bridge, user, expectedBalance)

  //   // Make swap from l1 bridge
  //   await l1_canonicalToken
  //     .connect(user)
  //     .approve(l1_bridge.address, tokenAmount)
  //   await l1_bridge
  //     .connect(user)
  //     .sendToL2(l2ChainId.toString(), await user.getAddress(), tokenAmount)
  //   await l2_messenger.relayNextMessage()

  //   // Verify token mint on L2
  //   expectedBalance = BigNumber.from(tokenAmount)
  //   await expectBalanceOf(l2_bridge, user, expectedBalance)
  // })

  // it('Should mint hTokens and swap for canonical tokens', async () => {
  //   const tokenAmount: BigNumber = USER_INITIAL_BALANCE

  //   // Verify no tokens available
  //   let expectedBalance: BigNumber = BigNumber.from('0')
  //   await expectBalanceOf(l2_canonicalToken, user, expectedBalance)

  //   // Make swap from l1 bridge
  //   const expectedAmounts: BigNumber[] = await l2_uniswapRouter.getAmountsOut(
  //     tokenAmount,
  //     [l2_canonicalToken.address, l2_bridge.address]
  //   )
  //   const expectedAmountAfterSlippage: BigNumber = expectedAmounts[1]

  //   await l1_canonicalToken
  //     .connect(user)
  //     .approve(l1_bridge.address, tokenAmount)
  //   await l1_bridge
  //     .connect(user)
  //     .sendToL2AndAttemptSwap(
  //       l2ChainId.toString(),
  //       await user.getAddress(),
  //       tokenAmount,
  //       DEFAULT_AMOUNT_OUT_MIN,
  //       DEFAULT_DEADLINE
  //     )
  //   await l2_messenger.relayNextMessage()

  //   // Verify token mint on L2
  //   expectedBalance = BigNumber.from(expectedAmountAfterSlippage)
  //   await expectBalanceOf(l2_canonicalToken, user, expectedBalance)
  })

  // // TODO: Changed with contract updates
  it.skip('Should send tokens from one L2 to another while the bonder is offline via withdrawAndAttemptSwap', async () => {
  //   const numberOfSendsToOverflow: number = MAX_NUM_SENDS_BEFORE_COMMIT + 1
  //   for (let i = 0; i < numberOfSendsToOverflow; i++) {
  //     // Mint canonical tokens on L1
  //     await l1_canonicalToken.mint(await user.getAddress(), transfer.amount)

  //     // Add the canonical token to the users' address on L2
  //     await executeCanonicalBridgeSendMessage(
  //       l1_canonicalToken,
  //       l1_canonicalBridge,
  //       l2_canonicalToken,
  //       l2_messenger,
  //       user,
  //       userSendTokenAmount
  //     )

  //     // Execute transaction
  //     await l2_bridge.connect(governance).addSupportedChainIds([transfer.chainId])
  //     await l2_canonicalToken
  //       .connect(user)
  //       .approve(l2_bridge.address, userSendTokenAmount)
  //     await l2_bridge
  //       .connect(user)
  //       .swapAndSend(
  //         transfer.chainId,
  //         transfer.recipient,
  //         transfer.amount,
  //         transfer.transferNonce,
  //         transfer.relayerFee,
  //         transfer.amountOutMin,
  //         transfer.deadline,
  //         transfer.destinationAmountOutMin,
  //         transfer.destinationDeadline
  //       )

  //     transfer.transferNonce += 1
  //   }

  //   try {
  //     // The array should have been deleted and only a single item (index 0) should exist
  //     await l2_bridge.pendingAmountChainIds(1)
  //     throw new Error('There should not be a pending transfer in this slot.')
  //   } catch (err) {
  //     const expectedErrorMsg: string =
  //       'VM Exception while processing transaction: invalid opcode'
  //     expect(err.message).to.eq(expectedErrorMsg)
  //   }

  //   try {
  //     // The array should have been deleted and only a single item (index 0) should exist
  //     await l2_bridge.pendingTransfers(1)
  //     throw new Error('There should not be a pending transfer in this slot.')
  //   } catch (err) {
  //     const expectedErrorMsg: string =
  //       'VM Exception while processing transaction: invalid opcode'
  //     expect(err.message).to.eq(expectedErrorMsg)
  //   }

  //   // TODO: When _sendCrossDomainImplementation is implemented, the last l2_bridge.swapAndSend() should atomically
  //   // call the l2_canonicalMessenger, which should automatically call l1_bridge.confirmTransferRoot() which should
  //   // atomically call recipientL2Bridge.setTransferRoot(). Then I can test the recipientL2Bridge.withdrawAndAttemptSwap()
  })

  it('Should send a transfer from one L2 to another L2 via bondWithdrawalAndAttemptSwap', async () => {
  //   transfer.destinationAmountOutMin = BigNumber.from(0)
  //   transfer.destinationDeadline = BigNumber.from(DEFAULT_DEADLINE)

  //   // Add the canonical token to the users' address on L2
  //   await executeCanonicalBridgeSendMessage(
  //     l1_canonicalToken,
  //     l1_canonicalBridge,
  //     l2_canonicalToken,
  //     l2_messenger,
  //     user,
  //     userSendTokenAmount
  //   )

  //   // Execute transaction
  //   await l2_bridge.connect(governance).addSupportedChainIds([transfer.chainId])
  //   await l2_canonicalToken
  //     .connect(user)
  //     .approve(l2_bridge.address, userSendTokenAmount)
  //   await l2_bridge
  //     .connect(user)
  //     .swapAndSend(
  //       transfer.chainId,
  //       await transfer.recipient.getAddress(),
  //       transfer.amount,
  //       transfer.transferNonce,
  //       transfer.relayerFee,
  //       transfer.amountOutMin,
  //       transfer.deadline,
  //       transfer.destinationAmountOutMin,
  //       transfer.destinationDeadline
  //     )

  //   // TODO: Mimic the cross chain test and verify state
  })

  it('Should set the transfer root', async () => {
  //   const arbitraryAmount: number = 123

  //   // Verify that the l1 bridge is the only account who can set it
  //   // TODO: Introduce this when `_verifySender()` implementation is added
  //   // expect(await l2_bridge.setTransferRoot(ARBITRARY_ROOT_HASH, arbitraryAmount)).to.throw('hi')

  //   // Update l1 bridge address for testing purposes
  //   await l2_bridge.setL1BridgeAddress(await user.getAddress())
  //   expect(await l2_bridge.l1BridgeAddress()).to.eq(await user.getAddress())

  //   await l2_bridge.setTransferRoot(ARBITRARY_ROOT_HASH, arbitraryAmount)

  //   const transferRoot = await l2_bridge.getTransferRoot(ARBITRARY_ROOT_HASH, arbitraryAmount)
  //   expect(transferRoot[0]).to.eq(arbitraryAmount)
  //   expect(transferRoot[1]).to.eq(0)
  })
  })

  /**
   * Non-Happy Path
   */


  describe('Edge cases', async () => {
    it('Should send tokens to L2 via send', async () => {
      await executeL2BridgeSend(
        l2_bridge,
        l2Transfer
      )
    })

    it('Should send tokens to L1 via swapAndSend', async () => {
      // TODO: What should happen here?
    })
  })

  // TODO: Over 100 pending transfers in send() (test is basically already written in 'Should send tokens from one L2 to another while the bonder is offline')
  // TODO: swapAndSend to same user on a different L2
  // TODO: swapAndSend to self on a different L2
  // TODO: Commit multiple
  // TODO: (maybe another file) single leaf tree and multiple leaf tree

  // TODO: only governance
  // TODO: all requires -- even those in children contracts
  // TODO: modifiers
  // TODO: Same nonce shouldn't work
  // TODO: Does 200 transfers without a bond event work?
  // TODO: Test nonces
  // TODO: Diff relayer fees

  // TODO: What happens if hTokens are sent to L1?
  // TODO: What happens if non-supported tokens are sent to L1?
})
