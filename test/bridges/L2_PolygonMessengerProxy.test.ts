import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber, utils as ethersUtils } from 'ethers'
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
  getSetMessengerProxyMessage,
  getAddBonderMessage,
  getSetL1GovernanceMessage,
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
  getSetL1BridgeAddressMessage,
  getSetL1BridgeCallerMessage,
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
  DEFAULT_L2_BRIDGE_GAS_LIMIT,
  DEFAULT_TIME_TO_WAIT,
  DEFAULT_RELAYER_FEE
} from '../../config/constants'

describe('L2_Polygon_Messenger_Proxy', () => {
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
  let l2_messengerProxy: Contract

  let transfers: Transfer[]
  let transfer: Transfer
  let l2Transfer: Transfer

  let originalBondedAmount: BigNumber
  let defaultRelayerFee: BigNumber

  let beforeAllSnapshotId: string
  let snapshotId: string

  before(async () => {
    beforeAllSnapshotId = await takeSnapshot()

    l1ChainId = CHAIN_IDS.ETHEREUM.GOERLI
    l2ChainId = CHAIN_IDS.POLYGON.MUMBAI

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
      l2_messenger,
      l2_swap,
      l2_ammWrapper,
      l2_messengerProxy,
      transfers
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
    const expectedXDomainMessageSenderAddress: string = DEAD_ADDRESS
    const xDomainMessageSenderAddress: string = await l2_messengerProxy.xDomainMessageSender()

    expect(expectedXDomainMessageSenderAddress).to.eq(
      xDomainMessageSenderAddress
    )
  })

  /**
   * Happy Path
   */

  it('Should set the L2 Bridge address', async () => {
    // This is not possible, as this is set in the fixture
  })

  it('Should send a cross domain message', async () => {
    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)
    await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)
  })

  it('Should process a message from root', async () => {
    // This happens on any transfer from Lx -> L2
    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)
  })

  /**
   * Non-Happy Path
   */

  it('Should not set the L2 Bridge address because it has already been set', async () => {
    const expectedErrorMsg: string = 'L2_PLGN_MSG: L2 Bridge already set'
    await expect(l2_messengerProxy.setL2Bridge(ONE_ADDRESS)).to.be.revertedWith(
      expectedErrorMsg
    )
  })

  it('Should not send a cross domain message because it was called by an arbitrary address', async () => {
    const expectedErrorMsg: string = 'L2_PLGN_MSG: Sender must be the L2 Bridge'
    const arbitraryMessage: string = ethersUtils.defaultAbiCoder.encode(
      ['address'],
      [DEAD_ADDRESS]
    )
    await expect(
      l2_messengerProxy
        .connect(otherUser)
        .sendCrossDomainMessage(arbitraryMessage)
    ).to.be.revertedWith(expectedErrorMsg)
  })

  it('Should not allow _processMessageFromRoot to succeed because the transaction fails', async () => {
    const expectedErrorMsg: string = 'L2_PLGN_MSG: Failed to proxy message'

    const message: string = getSetL1GovernanceMessage(DEAD_ADDRESS)

    // Trying to set state with an account that is not the governance address will fail
    await expect(
      executeCanonicalMessengerSendMessage(
        l1_messenger,
        l1_messengerWrapper,
        l2_bridge,
        l2_messenger,
        otherUser,
        message,
        l2ChainId
      )
    ).to.be.revertedWith(expectedErrorMsg)
  })
})
