import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber } from 'ethers'
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
  getSetAmmWrapperAddressMessage,
  getSetL1BridgeAddressMessage,
  getSetL1MessengerWrapperAddressMessage,
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
  DEFAULT_L2_BRIDGE_GAS_LIMIT,
  DEFAULT_TIME_TO_WAIT,
  DEFAULT_RELAYER_FEE
} from '../../config/constants'

describe('L2_Polygon_Bridge', () => {
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
    const expectedMessengerProxyAddress: string = l2_messengerProxy.address
    const expectedL1GovernanceAddress: string = await governance.getAddress()
    const expectedHopBridgeTokenAddress: string = l2_hopBridgeToken.address
    const expectedL1BridgeAddress: string = l1_bridge.address

    const messengerProxyAddress: string = await l2_bridge.messengerProxy()
    const l1GovernanceAddress: string = await l2_bridge.l1Governance()
    const hopBridgeTokenAddress: string = await l2_bridge.hToken()
    const l1BridgeAddress: string = await l2_bridge.l1BridgeAddress()
    const isBonder: string = await l2_bridge.getIsBonder(await bonder.getAddress())

    expect(expectedMessengerProxyAddress).to.eq(messengerProxyAddress)
    expect(expectedL1GovernanceAddress).to.eq(l1GovernanceAddress)
    expect(expectedHopBridgeTokenAddress).to.eq(hopBridgeTokenAddress)
    expect(expectedL1BridgeAddress).to.eq(l1BridgeAddress)
    expect(isBonder).to.eq(true)

    for (let i = 0; i < ALL_SUPPORTED_CHAIN_IDS.length; i++) {
      const chainId: string = ALL_SUPPORTED_CHAIN_IDS[i]
      const isChainIdSupported = await l2_bridge.activeChainIds(
        chainId
      )
      expect(isChainIdSupported).to.eq(true)
    }
  })

  /**
   * Happy Path
   */

  it('Should set an arbitrary messenger proxy', async () => {
    const expectedMessengerProxyAddress: string = ONE_ADDRESS

    const message: string = getSetMessengerProxyMessage(
      expectedMessengerProxyAddress
    )
    await executeCanonicalMessengerSendMessage(
      l1_messenger,
      l2_bridge,
      l2_messenger,
      governance,
      message,
      l2ChainId
    )

    const messengerProxyAddress: string = await l2_bridge.messengerProxy()
    expect(messengerProxyAddress).to.eq(expectedMessengerProxyAddress)
  })


  /**
   * Non-Happy Path
   */

  it('Should not set an arbitrary messenger proxy because the transaction was on L2 directly', async () => {
    const expectedErrorMsg: string = 'L2_PLGN_BRG: Caller is not the expected sender'

    const expectedMessengerProxyAddress: string = ONE_ADDRESS
    await expect(l2_bridge.setMessengerProxy(expectedMessengerProxyAddress)).to.be.revertedWith(expectedErrorMsg)
  })

  it('Should not set an arbitrary messenger proxy because the transaction was not sent by governance', async () => {
    const expectedErrorMsg: string = 'L2_PLGN_MSG: Failed to proxy message'

    const expectedMessengerProxyAddress: string = ONE_ADDRESS

    const message: string = getSetMessengerProxyMessage(
      expectedMessengerProxyAddress
    )

    await expect(
      executeCanonicalMessengerSendMessage(
        l1_messenger,
        l2_bridge,
        l2_messenger,
        user,
        message,
        l2ChainId
      )
    ).to.be.revertedWith(expectedErrorMsg)
  })
})
