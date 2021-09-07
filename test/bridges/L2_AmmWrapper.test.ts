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
  takeSnapshot,
  getTransferNonceFromEvent
} from '../shared/utils'
import {
  executeCanonicalBridgeSendTokens,
  executeL2AmmWrapperAttemptSwap,
  getAddBonderMessage,
  executeL1BridgeSendToL2,
  executeBridgeBondWithdrawal,
  executeL1BridgeBondTransferRoot,
  executeBridgeSettleBondedWithdrawals,
  executeL1BridgeChallengeTransferBond,
  executeL1BridgeResolveChallenge,
  executeL2BridgeSend,
  executeL2AmmWrapperSwapAndSend,
  executeL2BridgeCommitTransfers,
  executeL2BridgeBondWithdrawalAndDistribute,
  executeCanonicalMessengerSendMessage,
  getSetAmmWrapperMessage,
  getSetL1BridgeConnectorMessage,
  getSetL1CallerMessage,
  getAddActiveChainIdsMessage,
  getRemoveActiveChainIdsMessage,
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
  LIQUIDITY_PROVIDER_AMM_AMOUNT,
  ZERO_ADDRESS,
  SECONDS_IN_AN_HOUR,
  SECONDS_IN_A_DAY,
  TIMESTAMP_VARIANCE,
  DEAD_ADDRESS,
  ARBITRARY_ROOT_HASH,
  DEFAULT_H_BRIDGE_TOKEN_NAME,
  DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
  DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
  DEFAULT_TIME_TO_WAIT,
  DEFAULT_RELAYER_FEE
} from '../../config/constants'

describe('L2_AmmWrapper', () => {
  let _fixture: IFixture
  let l1ChainId: BigNumber
  let l2ChainId: BigNumber
  let l22ChainId: BigNumber

  let user: Signer
  let bonder: Signer
  let governance: Signer
  let relayer: Signer
  let otherUser: Signer

  let l1_canonicalToken: Contract
  let l1_bridge: Contract
  let l1_canonicalBridge: Contract
  let l1_messenger: Contract
  let l1_messengerWrapper: Contract
  let l2_canonicalToken: Contract
  let l2_hopBridgeToken: Contract
  let l2_bridge: Contract
  let l2_messenger: Contract
  let l2_swap: Contract
  let l2_ammWrapper: Contract
  let l22_canonicalToken: Contract
  let l22_hopBridgeToken: Contract
  let l22_bridge: Contract
  let l22_messenger: Contract
  let l22_swap: Contract

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
    l2ChainId = CHAIN_IDS.OPTIMISM.OPTIMISM_TESTNET
    l22ChainId = CHAIN_IDS.OPTIMISM.OPTIMISM_MAINNET

    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture)
    ;({
      user,
      bonder,
      governance,
      relayer,
      otherUser,
      l1_canonicalToken,
      l1_bridge,
      l1_messenger,
      l1_messengerWrapper,
      l1_canonicalBridge,
      l2_canonicalToken,
      l2_hopBridgeToken,
      l2_bridge,
      l2_swap,
      l2_messenger,
      l2_ammWrapper,
      transfers
    } = _fixture)

    const l1AlreadySetOpts = {
      l1BridgeAddress: l1_bridge.address,
      l1CanonicalTokenAddress: l1_canonicalToken.address
    }
    _fixture = await fixture(l1ChainId, l22ChainId, l1AlreadySetOpts)
    await setUpDefaults(_fixture)
    ;({
      l2_canonicalToken: l22_canonicalToken,
      l2_hopBridgeToken: l22_hopBridgeToken,
      l2_bridge: l22_bridge,
      l2_messenger: l22_messenger,
      l2_swap: l22_swap
    } = _fixture)

    transfer = transfers[0]
    l2Transfer = transfers[1]

    originalBondedAmount = LIQUIDITY_PROVIDER_AMM_AMOUNT.add(
      INITIAL_BONDED_AMOUNT
    )
    defaultRelayerFee = DEFAULT_RELAYER_FEE

    // All tests in L2 Bridge will require sending tokens to the L2 bridge first
    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_swap,
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
  after(async () => {
    await revertSnapshot(beforeAllSnapshotId)
  })

  beforeEach(async () => {
    snapshotId = await takeSnapshot()
  })

  afterEach(async () => {
    await revertSnapshot(snapshotId)
  })

  /**
   * Unit tests
   */

  it('Should set the correct values in the constructor', async () => {
    const expectedBridge: string = l2_bridge.address
    const expectedL2CanonicalToken: string = l2_canonicalToken.address
    const expectedL2CanonicalTokenIsEth: boolean = false
    const expectedHToken: string = l2_hopBridgeToken.address
    const expectedExchangeAddress: string = l2_swap.address

    const bridge: string = await l2_ammWrapper.bridge()
    const l2CanonicalToken: string = await l2_ammWrapper.l2CanonicalToken()
    const l2CanonicalTokenIsEth: boolean = await l2_ammWrapper.l2CanonicalTokenIsEth()
    const hToken: string = await l2_ammWrapper.hToken()
    const exchangeAddress: string = await l2_ammWrapper.exchangeAddress()

    expect(expectedBridge).to.eq(bridge)
    expect(expectedL2CanonicalToken).to.eq(l2CanonicalToken)
    expect(expectedL2CanonicalTokenIsEth).to.eq(l2CanonicalTokenIsEth)
    expect(expectedHToken).to.eq(hToken)
    expect(expectedExchangeAddress).to.eq(exchangeAddress)
  })

  describe('swapAndSend', async () => {
    it('Should send tokens to L1 via swapAndSend', async () => {
      await executeCanonicalBridgeSendTokens(
        l1_canonicalToken,
        l1_canonicalBridge,
        l2_canonicalToken,
        l2_messenger,
        user,
        transfer.amount,
        l2ChainId
      )

      // There needs to be a deadline when swapping and sending to L1
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.deadline = DEFAULT_DEADLINE

      await executeL2AmmWrapperSwapAndSend(
        l2_bridge,
        l2_canonicalToken,
        l2_swap,
        l2_ammWrapper,
        customTransfer
      )
    })

    it('Should send tokens to L2 via swapAndSend', async () => {
      await executeCanonicalBridgeSendTokens(
        l1_canonicalToken,
        l1_canonicalBridge,
        l2_canonicalToken,
        l2_messenger,
        user,
        transfer.amount,
        l2ChainId
      )

      await executeL2AmmWrapperSwapAndSend(
        l2_bridge,
        l2_canonicalToken,
        l2_swap,
        l2_ammWrapper,
        l2Transfer
      )
    })
  })

  describe('attemptSwap', async () => {
    it('Should successfully swap h token for canonical token', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        transfer.sender,
        transfer.recipient,
        relayer,
        transfer.amount,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      const recipient: Signer = otherUser
      const deadline: BigNumber = DEFAULT_DEADLINE
      await executeL2AmmWrapperAttemptSwap(
        l2_swap,
        l2_ammWrapper,
        l2_canonicalToken,
        l2_hopBridgeToken,
        transfer.sender,
        recipient,
        transfer.amount,
        transfer.amountOutMin,
        deadline
      )
    })

    it('Should unsuccessfully swap h token for canonical token', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        transfer.sender,
        transfer.recipient,
        relayer,
        transfer.amount,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      const recipient: Signer = otherUser
      const deadline: BigNumber = BigNumber.from('0')
      const shouldSwapSuccessfully: boolean = false
      await executeL2AmmWrapperAttemptSwap(
        l2_swap,
        l2_ammWrapper,
        l2_canonicalToken,
        l2_hopBridgeToken,
        transfer.sender,
        recipient,
        transfer.amount,
        transfer.amountOutMin,
        deadline,
        shouldSwapSuccessfully
      )
    })
  })

  /**
   * Non-Happy Path
   */

  describe('swapAndSend', async () => {
    it('Should not be able to swapAndSend because the bonder fee is greater than the transfer amount', async () => {
      const expectedErrorMsg: string = 'L2_AMM_W: Bonder fee cannot exceed amount'
      const customTransfer: Transfer = new Transfer(l2Transfer)
      customTransfer.bonderFee = customTransfer.amount.add(1)

      await executeCanonicalBridgeSendTokens(
        l1_canonicalToken,
        l1_canonicalBridge,
        l2_canonicalToken,
        l2_messenger,
        user,
        transfer.amount,
        l2ChainId
      )

      await expect(
        executeL2AmmWrapperSwapAndSend(
          l2_bridge,
          l2_canonicalToken,
          l2_swap,
          l2_ammWrapper,
          customTransfer
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not be able to swapAndSend because the token is not approved', async () => {
      const expectedErrorMsg: string =
        'ERC20: transfer amount exceeds allowance'

      await executeCanonicalBridgeSendTokens(
        l1_canonicalToken,
        l1_canonicalBridge,
        l2_canonicalToken,
        l2_messenger,
        user,
        transfer.amount,
        l2ChainId
      )

      const bonderAddress = (await transfer.bonder?.getAddress()) ?? ZERO_ADDRESS

      await expect(
        l2_ammWrapper
          .connect(transfer.sender)
          .swapAndSend(
            transfer.chainId,
            await transfer.recipient.getAddress(),
            transfer.amount,
            transfer.bonderFee,
            [
              '1',
              transfer.amountOutMin,
              transfer.deadline
            ],
            [
              '1',
              transfer.destinationAmountOutMin,
              transfer.destinationDeadline
            ],
            bonderAddress
          )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not be able to swapAndSend because the L2 canonical token approval does not work', async () => {
      // This would require a non-standard ERC20.
    })

    it('Should send tokens to L2 via swapAndSend but fail on the SECOND amount vs. bonder fee check', async () => {
      const expectedErrorMsg: string = 'L2_BRG: Bonder fee cannot exceed amount'

      const minBonderBps: BigNumber = BigNumber.from('0')
      const minBonderFeeAbsolute: BigNumber = transfer.amount

      await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
        minBonderBps,
        minBonderFeeAbsolute
      )

      const customTransfer: Transfer = new Transfer(l2Transfer)
      customTransfer.bonderFee = l2Transfer.amount

      await executeCanonicalBridgeSendTokens(
        l1_canonicalToken,
        l1_canonicalBridge,
        l2_canonicalToken,
        l2_messenger,
        user,
        transfer.amount,
        l2ChainId
      )

      await expect(
        executeL2AmmWrapperSwapAndSend(
          l2_bridge,
          l2_canonicalToken,
          l2_swap,
          l2_ammWrapper,
          customTransfer
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('attemptSwap', async () => {
    it('Should not attempt swap because h token was not approved', async () => {
      const expectedErrorMsg: string = 'ERC20: transfer amount exceeds allowance'
      await expect(
        l2_ammWrapper
          .connect(transfer.sender)
          .attemptSwap(
            await transfer.recipient.getAddress(),
            transfer.amount,
            [
              '1',
              transfer.amountOutMin,
              transfer.deadline
            ]
          )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not attempt swap because the approval failed', async () => {
      // This would require a non-standard ERC20.
    })
  })

  describe('Edge cases', async () => {
    it('Should send tokens to L2 via swapAndSend with an unusual bonder fee (0 wei)', async () => {
      const minBonderBps: BigNumber = BigNumber.from('0')
      const minBonderFeeAbsolute: BigNumber = BigNumber.from('0')

      await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
        minBonderBps,
        minBonderFeeAbsolute
      )

      const customTransfer: Transfer = new Transfer(l2Transfer)
      customTransfer.bonderFee = BigNumber.from('0')

      await executeCanonicalBridgeSendTokens(
        l1_canonicalToken,
        l1_canonicalBridge,
        l2_canonicalToken,
        l2_messenger,
        user,
        transfer.amount,
        l2ChainId
      )

      await executeL2AmmWrapperSwapAndSend(
        l2_bridge,
        l2_canonicalToken,
        l2_swap,
        l2_ammWrapper,
        customTransfer
      )
    })

    it('Should send tokens to L2 via swapAndSend with an unusual bonder fee (almost full amount)', async () => {
      // NOTE: This needs to be slightly less than max because of slippage
      const minBonderBps: BigNumber = BigNumber.from('0')
      const minBonderFeeAbsolute: BigNumber = transfer.amount.mul(98).div(100)

      await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
        minBonderBps,
        minBonderFeeAbsolute
      )

      const customTransfer: Transfer = new Transfer(l2Transfer)
      customTransfer.bonderFee = l2Transfer.amount.mul(99).div(100)

      await executeCanonicalBridgeSendTokens(
        l1_canonicalToken,
        l1_canonicalBridge,
        l2_canonicalToken,
        l2_messenger,
        user,
        transfer.amount,
        l2ChainId
      )

      await executeL2AmmWrapperSwapAndSend(
        l2_bridge,
        l2_canonicalToken,
        l2_swap,
        l2_ammWrapper,
        customTransfer
      )
    })

    it('Should successfully swap h token for canonical token twice', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        transfer.sender,
        transfer.recipient,
        relayer,
        transfer.amount,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.amount = transfer.amount.div(2)

      const recipient: Signer = otherUser
      const deadline: BigNumber = DEFAULT_DEADLINE
      await executeL2AmmWrapperAttemptSwap(
        l2_swap,
        l2_ammWrapper,
        l2_canonicalToken,
        l2_hopBridgeToken,
        customTransfer.sender,
        recipient,
        customTransfer.amount,
        customTransfer.amountOutMin,
        deadline
      )

      await executeL2AmmWrapperAttemptSwap(
        l2_swap,
        l2_ammWrapper,
        l2_canonicalToken,
        l2_hopBridgeToken,
        customTransfer.sender,
        recipient,
        customTransfer.amount,
        customTransfer.amountOutMin,
        deadline
      )
    })
  })
})
