import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import Transfer from '../../lib/Transfer'

import {
  setUpDefaults,
  expectBalanceOf,
  getRootHashFromTransferId,
  getTransferNonce,
  increaseTime,
  revertSnapshot,
  takeSnapshot
} from '../shared/utils'
import {
  executeCanonicalBridgeSendTokens,
  executeL1BridgeSendToL2,
  executeBridgeBondWithdrawal,
  executeL1BridgeBondTransferRoot,
  executeBridgeSettleBondedWithdrawals,
  executeL1BridgeChallengeTransferBond,
  executeL1BridgeResolveChallenge,
  executeL2BridgeSend,
  executeL2BridgeSwapAndSend,
  executeL2BridgeCommitTransfers,
  executeL2BridgeBondWithdrawalAndDistribute,
  executeCanonicalBridgeSendMessage,
  getSetUniswapWrapperAddressMessage,
  getSetL1BridgeAddressMessage,
  getSetL1MessengerWrapperAddressMessage,
  getSetMessengerGasLimitMessage,
  getAddSupportedChainIdsMessage,
  getRemoveSupportedChainIdsMessage,
  getSetMinimumForceCommitDelayMessage,
  getSetMaxPendingTransfersMessage,
  getSetHopBridgeTokenOwnerMessage,
  getSetMinimumBonderFeeRequirementsMessage
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
  DEFAULT_H_BRIDGE_TOKEN_NAME,
  DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
  DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
  DEFAULT_TIME_TO_WAIT,
  DEFAULT_RELAYER_FEE
} from '../../config/constants'

describe('L2_Bridge', () => {
  let _fixture: IFixture
  let l1ChainId: BigNumber
  let l2ChainId: BigNumber
  let l22ChainId: BigNumber

  let user: Signer
  let bonder: Signer
  let governance: Signer
  let relayer: Signer

  let l1_canonicalToken: Contract
  let l1_bridge: Contract
  let l1_canonicalBridge: Contract
  let l1_messenger: Contract
  let l2_canonicalToken: Contract
  let l2_hopBridgeToken: Contract
  let l2_bridge: Contract
  let l2_messenger: Contract
  let l2_uniswapRouter: Contract
  let l2_uniswapWrapper: Contract
  let l22_canonicalToken: Contract
  let l22_hopBridgeToken: Contract
  let l22_bridge: Contract
  let l22_messenger: Contract
  let l22_uniswapRouter: Contract

  let transfers: Transfer[]
  let transfer: Transfer
  let l2Transfer: Transfer

  let originalBondedAmount: BigNumber
  let defaultRelayerFee: BigNumber

  let beforeAllSnapshotId: string
  let snapshotId: string

  before(async () => {
    beforeAllSnapshotId = await takeSnapshot()

    l1ChainId = CHAIN_IDS.ETHEREUM.KOVAN
    l2ChainId = CHAIN_IDS.OPTIMISM.TESTNET_1
    l22ChainId = CHAIN_IDS.ARBITRUM.TESTNET_3

    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture, l2ChainId)
    ;({
      user,
      bonder,
      governance,
      relayer,
      l1_canonicalToken,
      l1_bridge,
      l1_messenger,
      l1_canonicalBridge,
      l2_canonicalToken,
      l2_hopBridgeToken,
      l2_bridge,
      l2_messenger,
      l2_uniswapRouter,
      l2_uniswapWrapper,
      transfers
    } = _fixture)

    const l1AlreadySetOpts = {
      l1BridgeAddress: l1_bridge.address,
      l1CanonicalTokenAddress: l1_canonicalToken.address
    }
    _fixture = await fixture(l1ChainId, l22ChainId, l1AlreadySetOpts)
    await setUpDefaults(_fixture, l22ChainId)
    ;({
      l2_canonicalToken: l22_canonicalToken,
      l2_hopBridgeToken: l22_hopBridgeToken,
      l2_bridge: l22_bridge,
      l2_messenger: l22_messenger,
      l2_uniswapRouter: l22_uniswapRouter,
    } = _fixture)

    transfer = transfers[0]
    l2Transfer = transfers[1]

    originalBondedAmount = LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.add(INITIAL_BONDED_AMOUNT)
    defaultRelayerFee = DEFAULT_RELAYER_FEE

    // All tests in L2 Bridge will require sending tokens to the L2 bridge first
    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_uniswapRouter,
      transfer.sender,
      transfer.recipient,
      relayer,
      transfer.amount,
      transfer.amountOutMin,
      transfer.deadline,
      defaultRelayerFee,
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
    const expectedName: string = DEFAULT_H_BRIDGE_TOKEN_NAME
    const expectedSymbol: string = DEFAULT_H_BRIDGE_TOKEN_SYMBOL
    const expectedDecimals: number = DEFAULT_H_BRIDGE_TOKEN_DECIMALS

    const l1GovernanceAddress = await l2_bridge.l1Governance()
    const l2CanonicalTokenAddress = await l2_bridge.l2CanonicalToken()
    const l1BridgeAddress = await l2_bridge.l1BridgeAddress()
    const isBonder = await l2_bridge.getIsBonder(await bonder.getAddress())
    const name: string = await l2_hopBridgeToken.name()
    const symbol: string = await l2_hopBridgeToken.symbol()
    const decimals: number = await l2_hopBridgeToken.decimals()

    expect(expectedL1GovernanceAddress).to.eq(l1GovernanceAddress)
    expect(expectedL2CanonicalTokenAddress).to.eq(l2CanonicalTokenAddress)
    expect(expectedL1BridgeAddress).to.eq(l1BridgeAddress)
    expect(expectedIsBonder).to.eq(isBonder)
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

  describe('setters', async () => {
    it('Should set the uniswap wrapper address arbitrarily', async () => {
      const expectedUniswapWrapperAddress: string = ONE_ADDRESS

      const message: string = getSetUniswapWrapperAddressMessage(expectedUniswapWrapperAddress)
      await executeCanonicalBridgeSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        governance,
        message
      )

      const exchangeAddress: string = await l2_bridge.uniswapWrapper()
      expect(exchangeAddress).to.eq(expectedUniswapWrapperAddress)
    })

    it('Should set the L1 bridge address arbitrarily', async () => {
      const expectedL1BridgeAddress: string = ONE_ADDRESS

      const message: string = getSetL1BridgeAddressMessage(expectedL1BridgeAddress)
      await executeCanonicalBridgeSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        governance,
        message
      )

      const l1BridgeAddress: string = await l2_bridge.l1BridgeAddress()
      expect(l1BridgeAddress).to.eq(expectedL1BridgeAddress)
    })

    it('Should set the L1 messenger wrapper address arbitrarily', async () => {
      const expectedL1MessengerWrapperAddress: string = ONE_ADDRESS

      const message: string = getSetL1MessengerWrapperAddressMessage(expectedL1MessengerWrapperAddress)
      await executeCanonicalBridgeSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        governance,
        message
      )

      const l1MessengerWrapperAddress: string = await l2_bridge.l1MessengerWrapperAddress()
      expect(l1MessengerWrapperAddress).to.eq(expectedL1MessengerWrapperAddress)
    })

    it('Should set the messenger gas limit arbitrarily', async () => {
      const expectedMessengerGasLimit: BigNumber = BigNumber.from('123')

      const message: string = getSetMessengerGasLimitMessage(expectedMessengerGasLimit)
      await executeCanonicalBridgeSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        governance,
        message
      )

      const messengerGasLimit: BigNumber = await l2_bridge.messengerGasLimit()
      expect(messengerGasLimit).to.eq(expectedMessengerGasLimit)
    })

    it('Should add support for a new chainId', async () => {
      const newChainId: BigNumber[] = [BigNumber.from('13371337')]

      const message: string = getAddSupportedChainIdsMessage(newChainId)
      await executeCanonicalBridgeSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        governance,
        message
      )

      const isChainIdSupported: boolean = await l2_bridge.supportedChainIds(newChainId[0])
      expect(isChainIdSupported).to.eq(true)
    })

    it('Should add support for a new chainId then remove it', async () => {
      const newChainId: BigNumber[] = [BigNumber.from('13371337')]

      let message: string = getAddSupportedChainIdsMessage(newChainId)
      await executeCanonicalBridgeSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        governance,
        message
      )

      let isChainIdSupported: boolean = await l2_bridge.supportedChainIds(newChainId[0])
      expect(isChainIdSupported).to.eq(true)

      message = getRemoveSupportedChainIdsMessage(newChainId)
      await executeCanonicalBridgeSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        governance,
        message
      )

      isChainIdSupported = await l2_bridge.supportedChainIds(newChainId[0])
      expect(isChainIdSupported).to.eq(false)
    })

    it('Should set the minimum force commit delay arbitrarily', async () => {
      const expectedMinimumForceCommitDelay: BigNumber = BigNumber.from('123')

      const message: string = getSetMinimumForceCommitDelayMessage(expectedMinimumForceCommitDelay)
      await executeCanonicalBridgeSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        governance,
        message
      )

      const minimumForceCommitDelay: BigNumber = await l2_bridge.minimumForceCommitDelay()
      expect(minimumForceCommitDelay).to.eq(expectedMinimumForceCommitDelay)
    })

    it('Should set the max pending transfers arbitrarily', async () => {
      const expectedMaxPendingTransfers: BigNumber = BigNumber.from('123')

      const message: string = getSetMaxPendingTransfersMessage(expectedMaxPendingTransfers)
      await executeCanonicalBridgeSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        governance,
        message
      )

      const maxPendingTransfers: BigNumber = await l2_bridge.maxPendingTransfers()
      expect(maxPendingTransfers).to.eq(expectedMaxPendingTransfers)
    })

    it('Should set a new owner of the HopBridgeToken', async () => {
      let hopBridgeTokenOwner: string = await l2_hopBridgeToken.owner()
      expect(hopBridgeTokenOwner).to.eq(l2_bridge.address)

      const newOwner: Signer = user
      const message: string = getSetHopBridgeTokenOwnerMessage(await newOwner.getAddress())
      await executeCanonicalBridgeSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        governance,
        message
      )

      hopBridgeTokenOwner = await l2_hopBridgeToken.owner()
      expect(hopBridgeTokenOwner).to.eq(await newOwner.getAddress())
    })

    it('Should set the minimum bonder fee requirements', async () => {
      const expectedMinBonderBps: BigNumber = BigNumber.from('13371337')
      const expectedMinBonderFeeAbsolute: BigNumber = BigNumber.from('73317331')

      const message: string = getSetMinimumBonderFeeRequirementsMessage(expectedMinBonderBps, expectedMinBonderFeeAbsolute)
      await executeCanonicalBridgeSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        governance,
        message
      )

      const minBonderBps = await l2_bridge.minBonderBps()
      const minBonderFeeAbsolute= await l2_bridge.minBonderFeeAbsolute()
      expect(minBonderBps).to.eq(expectedMinBonderBps)
      expect(minBonderFeeAbsolute).to.eq(expectedMinBonderFeeAbsolute)
    })
  })

  describe('send', async () => {
    it('Should send tokens to L1 via send', async () => {
      await executeL2BridgeSend(
        l2_hopBridgeToken,
        l2_bridge,
        transfer
      )
    })
  })

  describe('swapAndSend', async () => {
    it('Should send tokens to L2 via swapAndSend', async () => {
      // Add the canonical token to the users' address on L2
      await executeCanonicalBridgeSendTokens(
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
        l2_hopBridgeToken,
        l2_uniswapRouter,
        l2_uniswapWrapper,
        l2Transfer
      )
    })
  })

  describe('commitTransfers', async () => {
    it('Should commit a transfer automatically after 100 sends', async () => {
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.amount = BigNumber.from('100')
      customTransfer.bonderFee = BigNumber.from('0')

      for (let i = 0; i < 101; i++) {
        await executeL2BridgeSend(
          l2_hopBridgeToken,
          l2_bridge,
          customTransfer
        )
      }

      // After the commit, the contract state should have a single index for pendingTransferIdsForChainId.
      const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 1)
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
    })

    it('Should commit a transfer after the minForceCommitTime', async () => {
      await executeL2BridgeSend(
        l2_hopBridgeToken,
        l2_bridge,
        transfer
      )

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      const timeToWait: number = 4 * SECONDS_IN_AN_HOUR
      await increaseTime(timeToWait)

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        user
      )
    })

    it('Should commit a transfer by the bonder at any time', async () => {
      await executeL2BridgeSend(
        l2_hopBridgeToken,
        l2_bridge,
        transfer
      )

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )
    })

    it('Should commit a transfer with two sends -- to L1 and to L2', async () => {
      const customTransfer: Transfer = new Transfer(transfer)
      const customL2Transfer: Transfer = new Transfer(l2Transfer)
      customTransfer.amount = transfer.amount.div(4)
      customL2Transfer.amount = transfer.amount.div(4)

      await executeL2BridgeSend(
        l2_hopBridgeToken,
        l2_bridge,
        customTransfer
      )

      const expectedTransferIndex: BigNumber = BigNumber.from('1')
      await executeL2BridgeSend(
        l2_hopBridgeToken,
        l2_bridge,
        customL2Transfer,
        expectedTransferIndex
      )

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        customTransfer,
        bonder
      )

      // Bond withdrawal on other L2
      const actualTransferAmount: BigNumber = customL2Transfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_uniswapRouter,
        customL2Transfer,
        bonder,
        actualTransferAmount,
        expectedTransferIndex
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        customTransfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        customL2Transfer,
        bonder,
        expectedTransferIndex
      )
    })
  })

  describe('bondWithdrawalAndDistribute', async () => {
    it('Should send a transfer from one L2 to another L2 via bondWithdrawalAndDistribute', async () => {
    //   transfer.destinationAmountOutMin = BigNumber.from(0)
    //   transfer.destinationDeadline = BigNumber.from(DEFAULT_DEADLINE)

    //   // Add the canonical token to the users' address on L2
    //   await executeCanonicalBridgeSendTokens(
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
    //       transfer.bonderFee,
    //       transfer.amountOutMin,
    //       transfer.deadline,
    //       transfer.destinationAmountOutMin,
    //       transfer.destinationDeadline
    //     )

    //   // TODO: Mimic the cross chain test and verify state
    })
  })

  describe('setTransferRoot', async () => {
    it('Should set the transfer root', async () => {
      // TODO: Test this with actual transaction flow
    })
  })

  describe('getNextTransferNonce', async () => {
    it('Should get the next transfer nonce', async () => {
      const transferNonceIncrementer: BigNumber = await l2_bridge.transferNonceIncrementer()
      const expectedNextTransferNonce: string = getTransferNonce(transferNonceIncrementer, l2ChainId)
      const nextTransferNonce: string = await l2_bridge.getNextTransferNonce()
      expect(expectedNextTransferNonce).to.eq(nextTransferNonce)
    })
  })

  /**
   * Non-Happy Path
   */

  describe('setters', async () => {
    it('Should not allow an arbitrary address to set the uniswap wrapper address arbitrarily', async () => {
      const expectedErrorMsg: string = 'L2_OVM_BRG: Invalid cross-domain sender'
      const expectedUniswapWrapperAddress: string = ONE_ADDRESS

      const message: string = getSetUniswapWrapperAddressMessage(expectedUniswapWrapperAddress)
      await expect(
        executeCanonicalBridgeSendMessage(
          l1_messenger,
          l2_bridge,
          l2_messenger,
          user,
          message
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set the L1 bridge address arbitrarily', async () => {
      const expectedErrorMsg: string = 'L2_OVM_BRG: Invalid cross-domain sender'
      const expectedL1BridgeAddress: string = ONE_ADDRESS

      const message: string = getSetL1BridgeAddressMessage(expectedL1BridgeAddress)
      await expect(
        executeCanonicalBridgeSendMessage(
          l1_messenger,
          l2_bridge,
          l2_messenger,
          user,
          message
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set the L1 messenger wrapper address arbitrarily', async () => {
      const expectedErrorMsg: string = 'L2_OVM_BRG: Invalid cross-domain sender'
      const expectedL1MessengerWrapperAddress: string = ONE_ADDRESS

      const message: string = getSetL1MessengerWrapperAddressMessage(expectedL1MessengerWrapperAddress)
      await expect(
        executeCanonicalBridgeSendMessage(
          l1_messenger,
          l2_bridge,
          l2_messenger,
          user,
          message
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set the messenger gas limit arbitrarily', async () => {
      const expectedErrorMsg: string = 'L2_OVM_BRG: Invalid cross-domain sender'
      const expectedMessengerGasLimit: BigNumber = BigNumber.from('123')

      const message: string = getSetMessengerGasLimitMessage(expectedMessengerGasLimit)
      await expect(
        executeCanonicalBridgeSendMessage(
          l1_messenger,
          l2_bridge,
          l2_messenger,
          user,
          message
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to add support for a new chainId', async () => {
      const expectedErrorMsg: string = 'L2_OVM_BRG: Invalid cross-domain sender'
      const newChainId: BigNumber[] = [BigNumber.from('13371337')]

      const message: string = getAddSupportedChainIdsMessage(newChainId)
      await expect(
        executeCanonicalBridgeSendMessage(
          l1_messenger,
          l2_bridge,
          l2_messenger,
          user,
          message
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to remove support for a new chainId', async () => {
      const expectedErrorMsg: string = 'L2_OVM_BRG: Invalid cross-domain sender'
      const newChainId: BigNumber[] = [BigNumber.from('13371337')]

      let message: string = getAddSupportedChainIdsMessage(newChainId)
      await executeCanonicalBridgeSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        governance,
        message
      )

      let isChainIdSupported: boolean = await l2_bridge.supportedChainIds(newChainId[0])
      expect(isChainIdSupported).to.eq(true)

      message = getRemoveSupportedChainIdsMessage(newChainId)
      await expect(
        executeCanonicalBridgeSendMessage(
          l1_messenger,
          l2_bridge,
          l2_messenger,
          user,
          message
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set the minimum force commit delay arbitrarily', async () => {
      const expectedErrorMsg: string = 'L2_OVM_BRG: Invalid cross-domain sender'
      const expectedMinimumForceCommitDelay: BigNumber = BigNumber.from('123')

      const message: string = getSetMinimumForceCommitDelayMessage(expectedMinimumForceCommitDelay)
      await expect(
        executeCanonicalBridgeSendMessage(
          l1_messenger,
          l2_bridge,
          l2_messenger,
          user,
          message
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set the max pending transfers arbitrarily', async () => {
      const expectedErrorMsg: string = 'L2_OVM_BRG: Invalid cross-domain sender'
      const expectedMaxPendingTransfers: BigNumber = BigNumber.from('123')

      const message: string = getSetMaxPendingTransfersMessage(expectedMaxPendingTransfers)
      await expect(
        executeCanonicalBridgeSendMessage(
          l1_messenger,
          l2_bridge,
          l2_messenger,
          user,
          message
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set a new owner of the HopBridgeToken', async () => {
      const expectedErrorMsg: string = 'L2_OVM_BRG: Invalid cross-domain sender'
      let hopBridgeTokenOwner: string = await l2_hopBridgeToken.owner()
      expect(hopBridgeTokenOwner).to.eq(l2_bridge.address)

      const newOwner: Signer = user
      const message: string = getSetHopBridgeTokenOwnerMessage(await newOwner.getAddress())
      await expect(
        executeCanonicalBridgeSendMessage(
          l1_messenger,
          l2_bridge,
          l2_messenger,
          user,
          message
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set the minimum bonder fee requirements', async () => {
      const expectedErrorMsg: string = 'L2_OVM_BRG: Invalid cross-domain sender'
      const expectedMinBonderBps: BigNumber = BigNumber.from('13371337')
      const expectedMinBonderFeeAbsolute: BigNumber = BigNumber.from('73317331')

      const message: string = getSetMinimumBonderFeeRequirementsMessage(expectedMinBonderBps, expectedMinBonderFeeAbsolute)
      await expect(
        executeCanonicalBridgeSendMessage(
          l1_messenger,
          l2_bridge,
          l2_messenger,
          user,
          message
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('Edge cases', async () => {
    it('Should send tokens to L2 via send', async () => {
      await executeL2BridgeSend(
        l2_hopBridgeToken,
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
