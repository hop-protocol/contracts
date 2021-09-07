import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber, utils } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import Transfer from '../../lib/Transfer'
import { MerkleTree } from 'merkletreejs'

import {
  setUpDefaults,
  expectBalanceOf,
  getRootHashFromTransferId,
  getTransferNonce,
  getTransferNonceFromEvent,
  increaseTime,
  revertSnapshot,
  takeSnapshot,
  getNewMerkleTree
} from '../shared/utils'
import {
  executeBridgeWithdraw,
  executeL1BridgeSendToL2,
  executeBridgeBondWithdrawal,
  executeL1BridgeBondTransferRoot,
  executeBridgeSettleBondedWithdrawal,
  executeBridgeSettleBondedWithdrawals,
  executeL1BridgeChallengeTransferBond,
  executeBridgeRescueTransferRoot,
  executeL1BridgeResolveChallenge,
  executeL2BridgeSend,
  executeL2BridgeCommitTransfers,
  executeL2BridgeBondWithdrawalAndDistribute,
  executeL2AmmWrapperSwapAndSend
} from '../shared/contractFunctionWrappers'
import { fixture } from '../shared/fixtures'
import { IFixture } from '../shared/interfaces'

import {
  CHAIN_IDS,
  DEFAULT_AMOUNT_OUT_MIN,
  DEFAULT_DEADLINE,
  BONDER_INITIAL_BALANCE,
  INITIAL_BONDED_AMOUNT,
  LIQUIDITY_PROVIDER_AMM_AMOUNT,
  ZERO_ADDRESS,
  SECONDS_IN_A_MINUTE,
  SECONDS_IN_A_DAY,
  SECONDS_IN_A_WEEK,
  TIMESTAMP_VARIANCE,
  DEAD_ADDRESS,
  ARBITRARY_ROOT_HASH,
  DEFAULT_TIME_TO_WAIT,
  DEFAULT_RELAYER_FEE,
  ONE_ADDRESS,
  ARBITRARY_TRANSFER_NONCE,
  USER_INITIAL_BALANCE
} from '../../config/constants'

describe('L1_Bridge', () => {
  let _fixture: IFixture
  let l1ChainId: BigNumber
  let l2ChainId: BigNumber
  let l22ChainId: BigNumber

  let user: Signer
  let bonder: Signer
  let challenger: Signer
  let relayer: Signer
  let governance: Signer
  let otherUser: Signer

  let l1_canonicalToken: Contract
  let l1_bridge: Contract
  let l1_messenger: Contract
  let l1_registry: Contract
  let l2_canonicalToken: Contract
  let l2_hopBridgeToken: Contract
  let l2_bridge: Contract
  let l2_messenger: Contract
  let l2_bridgeConnector: Contract
  let l2_swap: Contract
  let l2_ammWrapper: Contract
  let l22_hopBridgeToken: Contract
  let l22_canonicalToken: Contract
  let l22_bridge: Contract
  let l22_messenger: Contract
  let l22_bridgeConnector: Contract
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
      challenger,
      relayer,
      governance,
      otherUser,
      l1_canonicalToken,
      l1_bridge,
      l1_messenger,
      l1_registry,
      l2_canonicalToken,
      l2_hopBridgeToken,
      l2_bridge,
      l2_messenger,
      l2_bridgeConnector,
      l2_swap,
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
      l2_bridgeConnector: l22_bridgeConnector,
      l2_swap: l22_swap
    } = _fixture)

    transfer = transfers[0]
    l2Transfer = transfers[1]

    originalBondedAmount = LIQUIDITY_PROVIDER_AMM_AMOUNT.add(
      INITIAL_BONDED_AMOUNT
    )
    defaultRelayerFee = DEFAULT_RELAYER_FEE
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
   * End to end tests
   */

  it('Should allow bonder to stake and unstake', async () => {
    const bondAmount: BigNumber = BigNumber.from('100')
    await l1_canonicalToken
      .connect(bonder)
      .approve(l1_bridge.address, bondAmount)
    await l1_bridge.connect(bonder).stake(await bonder.getAddress(), bondAmount)
    await l1_bridge.connect(bonder).unstake(bondAmount)
  })

  it('Should allow a user to send from L2 to L1, wait until the transfer is confirmed, and then withdraw', async () => {
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

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

    await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

    const timeToWait: number = 11 * SECONDS_IN_A_DAY
    await increaseTime(timeToWait)
    await l1_messenger.relayNextMessage()

    await executeBridgeWithdraw(
      l1_canonicalToken,
      l1_bridge,
      l2_bridge,
      transfer,
      bonder
    )
  })

  it('Should allow a user to send and swap from L1 to L2, swap and send from L2 to L1, wait until the transfer is confirmed, and then withdraw', async () => {
    const customTransfer: Transfer = new Transfer(transfer)
    customTransfer.deadline = DEFAULT_DEADLINE

    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_swap,
      customTransfer.sender,
      customTransfer.recipient,
      relayer,
      customTransfer.amount,
      customTransfer.amountOutMin,
      customTransfer.deadline,
      defaultRelayerFee,
      l2ChainId,
      customTransfer 
    )

    // The transfer amount should now take into account slippage
    customTransfer.amount = customTransfer.amountAfterSwap
    customTransfer.amountAfterSwap = BigNumber.from('0')

    await executeL2AmmWrapperSwapAndSend(
      l2_bridge,
      l2_canonicalToken,
      l2_swap,
      l2_ammWrapper,
      customTransfer
    )

    const startingTransferIndex: BigNumber = BigNumber.from('0')
    const didSwapAndSend: boolean = true
    await executeL2BridgeCommitTransfers(
      l2_bridge,
      [customTransfer],
      bonder,
      startingTransferIndex,
      didSwapAndSend
    )

    const timeToWait: number = 11 * SECONDS_IN_A_DAY
    await increaseTime(timeToWait)
    await l1_messenger.relayNextMessage()

    await executeBridgeWithdraw(
      l1_canonicalToken,
      l1_bridge,
      l2_bridge,
      customTransfer,
      bonder,
      didSwapAndSend
    )
  })

  it('Should allow a user to send from L2 to L2, wait until the transfer is confirmed, and then withdraw', async () => {
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

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

    await executeL2BridgeCommitTransfers(l2_bridge, [l2Transfer], bonder)

    const timeToWait: number = 11 * SECONDS_IN_A_DAY
    await increaseTime(timeToWait)
    await l1_messenger.relayNextMessage()
    await l22_messenger.relayNextMessage()

    const isSwapAndSend: boolean = false
    const destinationHopToken: Contract = l22_hopBridgeToken
    await executeBridgeWithdraw(
      l22_canonicalToken,
      l22_bridge,
      l2_bridge,
      l2Transfer,
      bonder,
      isSwapAndSend,
      destinationHopToken
    )
  })

  it('Should allow a user to send from L2 to L1 and perform a bonded withdrawal', async () => {
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

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

    await executeBridgeBondWithdrawal(
      l1_canonicalToken,
      l1_bridge,
      l2_bridge,
      transfer,
      bonder
    )
  })

  it('Should send a transaction from L2 to L1, perform a bonded withdrawal, and confirm an already bonded transfer root on L1', async () => {
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

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

    await executeBridgeBondWithdrawal(
      l1_canonicalToken,
      l1_bridge,
      l2_bridge,
      transfer,
      bonder
    )

    await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

    await executeL1BridgeBondTransferRoot(
      l1_bridge,
      l2_bridge,
      transfer,
      bonder,
      DEFAULT_TIME_TO_WAIT
    )

    await executeBridgeSettleBondedWithdrawals(
      l1_bridge,
      l2_bridge,
      [transfer],
      bonder
    )

    await l1_messenger.relayNextMessage()

    const transferNonce = await getTransferNonceFromEvent(l2_bridge)
    const transferId: Buffer = await transfer.getTransferId(transferNonce)
    const { rootHash } = getRootHashFromTransferId(transferId)
    const transferRootId: string = await l1_bridge.getTransferRootId(
      rootHash,
      transfer.amount
    )
    const transferRootCommittedAt: BigNumber = await l1_bridge.transferRootCommittedAt(
      transfer.chainId,
      transferRootId
    )
    const transferBondByTransferRootId = await l1_bridge.transferBonds(
      transferRootId
    )
    const currentTime: number = Math.floor(Date.now() / 1000)
    expect(transferRootCommittedAt.toNumber()).to.closeTo(
      currentTime,
      TIMESTAMP_VARIANCE
    )
    expect(transferBondByTransferRootId[0]).to.eq(await bonder.getAddress())
    expect(transferBondByTransferRootId[1].toNumber()).to.be.closeTo(
      currentTime,
      TIMESTAMP_VARIANCE
    )
    expect(transferBondByTransferRootId[2]).to.eq(transfer.amount)
    expect(transferBondByTransferRootId[3]).to.eq(0)
    expect(transferBondByTransferRootId[4]).to.eq(ZERO_ADDRESS)
    expect(transferBondByTransferRootId[5]).to.eq(false)
  })

  it('Should send a transaction from L2 to L2, perform a bonded withdrawal, and confirm an already bonded transfer root on L1', async () => {
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

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

    await executeBridgeBondWithdrawal(
      l1_canonicalToken,
      l1_bridge,
      l2_bridge,
      transfer,
      bonder
    )

    await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

    await executeL1BridgeBondTransferRoot(
      l1_bridge,
      l2_bridge,
      transfer,
      bonder,
      DEFAULT_TIME_TO_WAIT
    )

    await executeBridgeSettleBondedWithdrawals(
      l1_bridge,
      l2_bridge,
      [transfer],
      bonder
    )

    await l1_messenger.relayNextMessage()

    const transferNonce = await getTransferNonceFromEvent(l2_bridge)
    const transferId: Buffer = await transfer.getTransferId(transferNonce)
    const { rootHash } = getRootHashFromTransferId(transferId)
    const transferRootId: string = await l1_bridge.getTransferRootId(
      rootHash,
      transfer.amount
    )
    const transferRootCommittedAt: BigNumber = await l1_bridge.transferRootCommittedAt(
      transfer.chainId,
      transferRootId
    )
    const transferBondByTransferRootId = await l1_bridge.transferBonds(
      transferRootId
    )
    const currentTime: number = Math.floor(Date.now() / 1000)
    expect(transferRootCommittedAt.toNumber()).to.closeTo(
      currentTime,
      TIMESTAMP_VARIANCE
    )
    expect(transferBondByTransferRootId[0]).to.eq(await bonder.getAddress())
    expect(transferBondByTransferRootId[1].toNumber()).to.be.closeTo(
      currentTime,
      TIMESTAMP_VARIANCE
    )
    expect(transferBondByTransferRootId[2]).to.eq(transfer.amount)
    expect(transferBondByTransferRootId[3]).to.eq(0)
    expect(transferBondByTransferRootId[4]).to.eq(ZERO_ADDRESS)
    expect(transferBondByTransferRootId[5]).to.eq(false)
  })

  /**
   * Unit tests
   */

  describe('constructor', async () => {
    it('Should get the correct chainId', async () => {
      const chainId = await l1_bridge.getChainId()
      const expectedChainId = 1
      expect(chainId).to.eq(expectedChainId)
    })

    it('Should set the collateral token address and the bonder address in the constructor', async () => {
      const collateralTokenAddress = await l1_bridge.token()
      const isBonder = await l1_bridge.getIsBonder(await bonder.getAddress())
      expect(collateralTokenAddress).to.eq(l1_canonicalToken.address)
      expect(isBonder).to.eq(true)
    })
  })

  describe('setters and getters', async () => {
    it('Should set a new xDomainConnector address', async () => {
      const expectedCrossDomainMessengerWrapper: string = ONE_ADDRESS

      await l1_bridge.connect(governance).setXDomainConnector(
        transfer.chainId,
        ONE_ADDRESS
      )

      const xDomainConnectors: string = await l1_bridge.xDomainConnectors(
        transfer.chainId
      )
      expect(xDomainConnectors).to.eq(
        expectedCrossDomainMessengerWrapper
      )
    })

    it('Should pause and unpause a chain ID', async () => {
      await l1_bridge.connect(governance).setChainIdDepositsPaused(transfer.chainId, false)

      let isPaused: boolean = await l1_bridge.isChainIdPaused(transfer.chainId)
      expect(isPaused).to.eq(false)

      await l1_bridge.connect(governance).setChainIdDepositsPaused(transfer.chainId, true)

      isPaused = await l1_bridge.isChainIdPaused(transfer.chainId)
      expect(isPaused).to.eq(true)
    })

    it('Should set a new challengePeriod', async () => {
      const expectedChallengePeriod: BigNumber = BigNumber.from('28800')

      await l1_bridge.connect(governance).setChallengePeriod(
        expectedChallengePeriod
      )

      const challengePeriod: BigNumber = await l1_bridge.challengePeriod()
      expect(challengePeriod).to.eq(expectedChallengePeriod)
    })

    it('Should set a new challengeResolutionPeriod', async () => {
      const expectedChallengeResolutionPeriod: BigNumber = BigNumber.from(
        '13371337'
      )
      await l1_bridge.connect(governance).setChallengeResolutionPeriod(
        expectedChallengeResolutionPeriod
      )

      const challengeResolutionPeriod: BigNumber = await l1_bridge.challengeResolutionPeriod()
      expect(challengeResolutionPeriod).to.eq(expectedChallengeResolutionPeriod)
    })

    it('Should set a new min TransferRoot bond delay', async () => {
      const expectedMinTransferRootBondDelay: BigNumber = BigNumber.from(
        '13371337'
      )
      await l1_bridge.connect(governance).setMinTransferRootBondDelay(
        expectedMinTransferRootBondDelay
      )

      const minTransferRootBondDelay: BigNumber = await l1_bridge.minTransferRootBondDelay()
      expect(minTransferRootBondDelay).to.eq(expectedMinTransferRootBondDelay)
    })

    it('Should get the bond for a transfer amount', async () => {
      let expectedBond: BigNumber = BigNumber.from('135')
      let transferAmount: BigNumber = BigNumber.from('123')
      let bond: BigNumber = await l1_bridge.getBondForTransferAmount(transferAmount)
      expect(bond).to.eq(expectedBond)

      expectedBond = BigNumber.from(parseEther('1100'))
      transferAmount = BigNumber.from(parseEther('1000'))
      bond = await l1_bridge.getBondForTransferAmount(transferAmount)
      expect(bond).to.eq(expectedBond)
    })

    it('Should get the challenge amount for transfer amount', async () => {
      let expectedChallengeAmount: BigNumber = BigNumber.from('12')
      let transferAmount: BigNumber = BigNumber.from('123')
      let challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transferAmount)
      expect(challengeAmount).to.eq(expectedChallengeAmount)

      expectedChallengeAmount = BigNumber.from(parseEther('100'))
      transferAmount = BigNumber.from(parseEther('1000'))
      challengeAmount = await l1_bridge.getChallengeAmountForTransferAmount(transferAmount)
      expect(challengeAmount).to.eq(expectedChallengeAmount)
    })

    it('Should get the time slot', async () => {
      let expectedTimeSlot: BigNumber = BigNumber.from('0')
      let time: BigNumber = BigNumber.from('123')
      let timeSlot: BigNumber = await l1_bridge.getTimeSlot(time)
      expect(timeSlot).to.eq(expectedTimeSlot)

      expectedTimeSlot = BigNumber.from('69444444444444444')
      time = BigNumber.from(parseEther('1000'))
      timeSlot = await l1_bridge.getTimeSlot(time)
      expect(timeSlot).to.eq(expectedTimeSlot)
    })
  })

  describe('sendToL2', async () => {
    it('Should send tokens across the bridge via sendToL2', async () => {
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

      await l2_messenger.relayNextMessage()

      expect(await l1_bridge.chainBalance(l2ChainId)).to.eq(
        originalBondedAmount.add(transfer.amount)
      )
    })

    it('Should send tokens across the bridge via sendToL2 and swap for the canonical token', async () => {
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

      await l2_messenger.relayNextMessage()

      expect(await l1_bridge.chainBalance(l2ChainId)).to.eq(
        originalBondedAmount.add(transfer.amount)
      )
    })
  })

  describe('bondTransferRoot', async () => {
    it('Should send a transaction from L2 to L1 and bond the transfer root on L1', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )
    })

    it('Should send a transaction from L2 to L2 and bond the transfer root on L1', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      // Bond withdrawal on other L2
      const actualTransferAmount: BigNumber = l2Transfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        l2Transfer,
        bonder,
        actualTransferAmount
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [l2Transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        l2Transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      const transferNonce = await getTransferNonceFromEvent(l2_bridge)
      const transferId: Buffer = await l2Transfer.getTransferId(transferNonce)
      const nextMessage = await l22_messenger.nextMessage()
      const ABI: string[] = ['function setTransferRoot(bytes32, uint256)']
      const setTransferRootInterface = new utils.Interface(ABI)
      const expectedMessage: string = setTransferRootInterface.encodeFunctionData(
        'setTransferRoot',
        [transferId, l2Transfer.amount]
      )

      expect(nextMessage[0]).to.eq(l22_bridgeConnector.address)
      expect(nextMessage[1]).to.eq(expectedMessage)
    })
  })

  describe('settleBondedWithdrawal', async () => {
    it('Should send a transaction from L1 to L2, bond it, and settle the bonded withdrawal', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await l1_messenger.relayNextMessage()

      await executeBridgeSettleBondedWithdrawal(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )
    })

    it.skip('Should send a transaction from L2 to L2, bond it, and settle the bonded withdrawal', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      const actualTransferAmount: BigNumber = l2Transfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        l2Transfer,
        bonder,
        actualTransferAmount
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [l2Transfer], bonder)

      await l1_messenger.relayNextMessage()
      await l22_messenger.relayNextMessage()

      await executeBridgeSettleBondedWithdrawal(
        l22_bridge,
        l2_bridge,
        l2Transfer,
        bonder
      )
    })
  })

  describe('settleBondedWithdrawals', async () => {
    it('Should send two transactions from L2 to L1, bond them, and settle the bonded withdrawals', async () => {
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
        transfer.amount.mul(2),
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      const expectedTransferIndex: BigNumber = BigNumber.from('1')
      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer, expectedTransferIndex)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        expectedTransferIndex
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer, transfer], bonder)

      await l1_messenger.relayNextMessage()

      await executeBridgeSettleBondedWithdrawals(
        l1_bridge,
        l2_bridge,
        [transfer, transfer],
        bonder
      )
    })

    it.skip('Should send two transactions from L2 to L2, bond it, and settle the bonded withdrawals', async () => {
      const amountToSend: BigNumber = transfer.amount.mul(2)
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
        amountToSend,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      let actualTransferAmount: BigNumber = l2Transfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        l2Transfer,
        bonder,
        actualTransferAmount
      )

      const expectedTransferIndex: BigNumber = BigNumber.from('1')
      await executeL2BridgeSend(
        l2_hopBridgeToken,
        l2_bridge,
        l2Transfer,
        expectedTransferIndex
      )

      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        l2Transfer,
        bonder,
        actualTransferAmount,
        expectedTransferIndex
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        [l2Transfer, l2Transfer],
        bonder,
      )

      await l1_messenger.relayNextMessage()
      await l22_messenger.relayNextMessage()

      await executeBridgeSettleBondedWithdrawals(
        l22_bridge,
        l2_bridge,
        [l2Transfer, l2Transfer],
        bonder
      )
    })
  })

  describe('confirmTransferRoot', async () => {
    it('Should send a transaction from L2 to L1 and commit the transfers on L1', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      // Send the committed transfer the L1
      await l1_messenger.relayNextMessage()

      const transferNonce = await getTransferNonceFromEvent(l2_bridge)
      const transferId: Buffer = await transfer.getTransferId(transferNonce)
      const { rootHash } = getRootHashFromTransferId(transferId)

      const currentTime: number = Math.floor(Date.now() / 1000)
      const transferRootId: string = await l1_bridge.getTransferRootId(
        rootHash,
        transfer.amount
      )
      const transferRootCommittedAt: BigNumber = await l1_bridge.transferRootCommittedAt(
        transfer.chainId,
        transferRootId
      )
      const transferRoot = await l1_bridge.getTransferRoot(
        rootHash,
        transfer.amount
      )
      expect(transferRootCommittedAt.toNumber()).to.closeTo(
        currentTime,
        TIMESTAMP_VARIANCE
      )
      expect(await l1_bridge.chainBalance(l2ChainId)).to.eq(
        originalBondedAmount
      )
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))
      expect(transferRoot[2].toNumber()).to.be.closeTo(
        currentTime,
        TIMESTAMP_VARIANCE
      )
    })

    it('Should send a transaction from L2 to L2 and commit the transfers on L1', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      // Bond withdrawal on other L2
      const actualTransferAmount: BigNumber = transfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        l2Transfer,
        bonder,
        actualTransferAmount
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [l2Transfer], bonder)

      // Send the committed transfer the L1
      await l1_messenger.relayNextMessage()

      const transferNonce = await getTransferNonceFromEvent(l2_bridge)
      const transferId: Buffer = await l2Transfer.getTransferId(transferNonce)
      const { rootHash } = getRootHashFromTransferId(transferId)

      const currentTime: number = Math.floor(Date.now() / 1000)
      const transferRootId: string = await l1_bridge.getTransferRootId(
        rootHash,
        l2Transfer.amount
      )
      const transferRootCommittedAt: BigNumber = await l1_bridge.transferRootCommittedAt(
        l2Transfer.chainId,
        transferRootId
      )

      expect(transferRootCommittedAt.toNumber()).to.closeTo(
        currentTime,
        TIMESTAMP_VARIANCE
      )
      expect(await l1_bridge.chainBalance(l22ChainId)).to.eq(
        LIQUIDITY_PROVIDER_AMM_AMOUNT.add(INITIAL_BONDED_AMOUNT).add(l2Transfer.amount)
      )

      const nextMessage = await l22_messenger.nextMessage()
      const ABI: string[] = ['function setTransferRoot(bytes32, uint256)']
      const setTransferRootInterface = new utils.Interface(ABI)
      const expectedMessage: string = setTransferRootInterface.encodeFunctionData(
        'setTransferRoot',
        [transferId, l2Transfer.amount]
      )

      expect(nextMessage[0]).to.eq(l22_bridgeConnector.address)
      expect(nextMessage[1]).to.eq(expectedMessage)
    })
  })

  describe('challengeTransferBond', async () => {
    it('Should send a transaction from L2 to L1, bond withdrawal on L1, and challenge the transfer bond', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        transfer.chainId,
        bonder,
        challenger,
        transfer
      )
    })

    it('Should send a transaction from L2 to L2, bond withdrawal on L2, and challenge the transfer bond', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      // Bond withdrawal on other L2
      const actualTransferAmount: BigNumber = l2Transfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        l2Transfer,
        bonder,
        actualTransferAmount
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [l2Transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        l2Transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2Transfer.amount,
        l2Transfer.chainId,
        bonder,
        challenger,
        l2Transfer
      )
    })
  })

  describe('resolveChallenge', async () => {
    it('Should send a transaction from L2 to L1, bond withdrawal on L1, challenge the transfer bond, and resolve unsuccessfully', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        transfer.chainId,
        bonder,
        challenger,
        transfer
      )

      const timeToWait: number = 10 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = false
      const didBonderWaitMinTransferRootTime: boolean = false
      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        bonder,
        challenger,
        transfer,
        shouldResolveSuccessfully,
        didBonderWaitMinTransferRootTime
      )
    })

    it('Should send a transaction from L2 to L1, commit the bond, wait the min time then bond, challenge the transfer bond, and resolve unsuccessfully', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      // TODO: Get this from the contract
      let timeToWait: number = 16 * SECONDS_IN_A_MINUTE
      await increaseTime(timeToWait)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        timeToWait
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        transfer.chainId,
        bonder,
        challenger,
        transfer
      )

      timeToWait = 11 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = false
      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        bonder,
        challenger,
        transfer,
        shouldResolveSuccessfully
      )
    })

    it('Should send a transaction from L2 to L1, bond withdrawal on L1, challenge the transfer bond, and resolve successfully', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        transfer.chainId,
        bonder,
        challenger,
        transfer
      )

      const timeToWait: number = 11 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)

      // Message is not relayed successfully

      const shouldResolveSuccessfully: boolean = true
      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        bonder,
        challenger,
        transfer,
        shouldResolveSuccessfully
      )
    })

    it('Should send a transaction from L2 to L2, bond withdrawal on L2, and challenge the transfer bond, and resolve unsuccessfully', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      // Bond withdrawal on other L2
      const actualTransferAmount: BigNumber = l2Transfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        l2Transfer,
        bonder,
        actualTransferAmount
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [l2Transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        l2Transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2Transfer.amount,
        l2Transfer.chainId,
        bonder,
        challenger,
        l2Transfer
      )

      const timeToWait: number = 10 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = false
      const didBonderWaitMinTransferRootTime: boolean = false
      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2Transfer.amount,
        bonder,
        challenger,
        l2Transfer,
        shouldResolveSuccessfully,
        didBonderWaitMinTransferRootTime
      )
    })

    it('Should send a transaction from L2 to L2, commit the bond, wait the min time then bond, challenge the transfer bond, and resolve unsuccessfully', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      // Bond withdrawal on other L2
      const actualTransferAmount: BigNumber = l2Transfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        l2Transfer,
        bonder,
        actualTransferAmount
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [l2Transfer], bonder)

      // TODO: Get this from the contract
      let timeToWait: number = 16 * SECONDS_IN_A_MINUTE
      await increaseTime(timeToWait)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        l2Transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2Transfer.amount,
        l2Transfer.chainId,
        bonder,
        challenger,
        l2Transfer
      )

      timeToWait = 10 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = false
      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2Transfer.amount,
        bonder,
        challenger,
        l2Transfer,
        shouldResolveSuccessfully
      )
    })

    it('Should send a transaction from L2 to L2, bond withdrawal on L2, challenge the transfer bond, and resolve successfully', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      // Bond withdrawal on other L2
      const actualTransferAmount: BigNumber = l2Transfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        l2Transfer,
        bonder,
        actualTransferAmount
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [l2Transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        l2Transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2Transfer.amount,
        l2Transfer.chainId,
        bonder,
        challenger,
        l2Transfer
      )

      const timeToWait: number = 10 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)

      // Message is not relayed successfully

      const shouldResolveSuccessfully: boolean = true
      const didBonderWaitMinTransferRootTime: boolean = false
      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2Transfer.amount,
        bonder,
        challenger,
        l2Transfer,
        shouldResolveSuccessfully,
        didBonderWaitMinTransferRootTime
      )
    })
  })

  describe('rescueTransferRoot', async () => {
    it('Should rescue a transfer root from L2 -> L1', async () => {
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT,
        ARBITRARY_TRANSFER_NONCE
      )

      const timeToWait: number = 9 * SECONDS_IN_A_WEEK
      await increaseTime(timeToWait)

      await executeBridgeRescueTransferRoot(
        l1_canonicalToken,
        l2_bridge,
        l1_bridge,
        transfer.amount,
        governance,
        transfer,
        ARBITRARY_TRANSFER_NONCE
      )
    })

    it('Should rescue a transfer root from L2 -> L2', async () => {
      // Bond an invalid withdrawal on other L2
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        l2Transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT,
        ARBITRARY_TRANSFER_NONCE
      )

      await l22_messenger.relayNextMessage()

      const timeToWait: number = 9 * SECONDS_IN_A_WEEK
      await increaseTime(timeToWait)

      await executeBridgeRescueTransferRoot(
        l22_hopBridgeToken,
        l2_bridge,
        l22_bridge,
        transfer.amount,
        governance,
        l2Transfer,
        ARBITRARY_TRANSFER_NONCE
      )
    })

    it('Should rescue a valid transfer root from L2 -> L1 that was never withdrawn', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await l1_messenger.relayNextMessage()

      const timeToWait: number = 9 * SECONDS_IN_A_WEEK
      await increaseTime(timeToWait)

      await executeBridgeRescueTransferRoot(
        l1_canonicalToken,
        l2_bridge,
        l1_bridge,
        transfer.amount,
        governance,
        transfer
      )
    })
  })

  /**
   * Non-Happy Path
   */

  describe('setters', async () => {
    it('Should not set a new challengePeriod because it is not a valid value', async () => {
      const expectedErrorMsg: string =
        'L1_BRG: challengePeriod must be divisible by TIME_SLOT_SIZE'

      const expectedChallengePeriod: BigNumber = BigNumber.from('100')

      await expect(
        l1_bridge.connect(governance).setChallengePeriod(
          expectedChallengePeriod
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('sendToL2', async () => {
    it('Should not allow a user to sendToL2 with an amount of 0', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Must transfer a non-zero amount'
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.amount = BigNumber.from('0')

      await expect(
        executeL1BridgeSendToL2(
          l1_canonicalToken,
          l1_bridge,
          l2_hopBridgeToken,
          l2_canonicalToken,
          l2_messenger,
          l2_swap,
          customTransfer.sender,
          customTransfer.recipient,
          relayer,
          customTransfer.amount,
          transfer.amountOutMin,
          transfer.deadline,
          defaultRelayerFee,
          l2ChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2 if the messenger wrapper for the L2 is not defined', async () => {
      const invalidChainId: BigNumber = BigNumber.from('123')
      const expectedErrorMsg: string = 'L1_BRG: chainId not supported'

      await expect(
        executeL1BridgeSendToL2(
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
          invalidChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2 if the chainId is paused', async () => {
      const expectedErrorMsg: string =
        'L1_BRG: Sends to this chainId are paused'

      const isPaused: boolean = true
      await l1_bridge.connect(governance).setChainIdDepositsPaused(l2ChainId, isPaused)

      await expect(
        executeL1BridgeSendToL2(
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
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2 if the relayerFee is higher than the amount', async () => {
      const expectedErrorMsg: string =
        'L1_BRG: Relayer fee cannot exceed amount'
      const largeRelayerFee: BigNumber = transfer.amount.add(1)

      await expect(
        executeL1BridgeSendToL2(
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
          largeRelayerFee,
          l2ChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2 if the user did not approve the token transfer to the L1 Bridge', async () => {
      const expectedErrorMsg: string =
        ' ERC20: transfer amount exceeds allowance'
      const tokenAmount = await l1_canonicalToken.balanceOf(
        await user.getAddress()
      )

      await expect(
        l1_bridge
          .connect(user)
          .sendToL2(
            l2ChainId,
            await user.getAddress(),
            tokenAmount,
            [
              '1',
              transfer.amountOutMin,
              transfer.deadline
            ],
            await relayer.getAddress(),
            defaultRelayerFee
          )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2 if the user does not have the tokens to transfer to the L1 Bridge', async () => {
      const expectedErrorMsg: string = 'ERC20: transfer amount exceeds balance'

      // Send all tokens away from user's address
      const userBalance: BigNumber = await l1_canonicalToken.balanceOf(
        await user.getAddress()
      )
      await l1_canonicalToken.connect(user).transfer(DEAD_ADDRESS, userBalance)
      expectBalanceOf(l1_canonicalToken, user, BigNumber.from('0'))

      await expect(
        executeL1BridgeSendToL2(
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
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('bondTransferRoot', async () => {
    it('Should not allow a transfer root to be bonded unless it is called by the bonder', async () => {
      const expectedErrorMsg: string = 'ACT: Caller is not registered bonder'

      // const transferNonce = await getTransferNonceFromEvent(l2_bridge)
      const transferNonce = await l2_bridge.getNextTransferNonce()
      const transferId: Buffer = await transfer.getTransferId(transferNonce)
      const { rootHash } = getRootHashFromTransferId(transferId)

      await expect(
        l1_bridge
          .connect(user)
          .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded that exceeds the bonders credit', async () => {
      const expectedErrorMsg: string = 'ACT: Not enough available credit'
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.amount = BONDER_INITIAL_BALANCE.mul(2)

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await expect(
        executeL1BridgeBondTransferRoot(
          l1_bridge,
          l2_bridge,
          customTransfer,
          bonder,
          DEFAULT_TIME_TO_WAIT
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root has already been confirmed', async () => {
      const expectedErrorMsg: string = '1'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await l1_messenger.relayNextMessage()

      await expect(
        executeL1BridgeBondTransferRoot(
          l1_bridge,
          l2_bridge,
          transfer,
          bonder,
          DEFAULT_TIME_TO_WAIT
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root has already been bonded', async () => {
      const expectedErrorMsg: string =
        'L1_BRG: TransferRoot has already been bonded'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await expect(
        executeL1BridgeBondTransferRoot(
          l1_bridge,
          l2_bridge,
          transfer,
          bonder,
          DEFAULT_TIME_TO_WAIT
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root was already set', async () => {
      // This is not possible, as the only way to get to this code on the L1_Bridge would be to bond the same
      // mainnet transfer root twice, however this will be blocked by the bond reuse check prior to execution here
    })

    it('Should not allow a transfer root to be bonded if a mainnet transfer root amount is 0', async () => {
      const expectedErrorMsg: string =
        'BRG: Cannot set TransferRoot totalAmount of 0'
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.amount = BigNumber.from('0')

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await expect(
        executeL1BridgeBondTransferRoot(
          l1_bridge,
          l2_bridge,
          customTransfer,
          bonder,
          DEFAULT_TIME_TO_WAIT
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the the messenger wrapper is not set for an L2 to L2 transfer', async () => {
      const expectedErrorMsg: string = 'L1_BRG: chainId not supported'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        l2Transfer.sender,
        l2Transfer.recipient,
        relayer,
        l2Transfer.amount,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2Transfer,
        bonder
      )

      await l1_bridge.connect(governance).setXDomainConnector(
        l2Transfer.chainId,
        ZERO_ADDRESS
      )

      await expect(
        executeL1BridgeBondTransferRoot(
          l1_bridge,
          l2_bridge,
          l2Transfer,
          bonder,
          DEFAULT_TIME_TO_WAIT
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('settleBondedWithdrawal', async () => {
    it('Should not settle a bonded withdrawal an invalid transfer proof', async () => {
      const expectedErrorMsg: string = 'BRG: Invalid transfer proof'
      const transferId: string = ARBITRARY_ROOT_HASH
      const rootHash: string = ARBITRARY_ROOT_HASH
      const proof: string[] = [ARBITRARY_ROOT_HASH]
      const transferIdTreeIndex = 0
      const totalLeaves = 2

      await expect(
        l1_bridge
          .connect(bonder)
          .settleBondedWithdrawal(
            await bonder.getAddress(),
            transferId,
            rootHash,
            transfer.amount,
            transferIdTreeIndex,
            proof,
            totalLeaves
          )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not let an arbitrary bonder settle a bonded withdrawal', async () => {
      const expectedErrorMsg: string = 'L2_BRG: transferId has no bond'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await l1_messenger.relayNextMessage()

      const transferNonce = await getTransferNonceFromEvent(l2_bridge)
      const transferId: Buffer = await transfer.getTransferId(transferNonce)
      const { rootHash } = getRootHashFromTransferId(transferId)
      const tree: MerkleTree = getNewMerkleTree([transferId])
      const proof: Buffer[] = tree.getProof(transferId)
      const transferIdTreeIndex = 0
      const totalLeaves = 1

      await expect(
        l1_bridge
          .connect(bonder)
          .settleBondedWithdrawal(
            await otherUser.getAddress(),
            transferId,
            rootHash,
            transfer.amount,
            transferIdTreeIndex,
            proof,
            totalLeaves
          )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('settleBondedWithdrawals', async () => {
    it('Should not settle bonded withdrawals because the transfer root is not found', async () => {
      const expectedErrorMsg: string = 'BRG: Transfer root not found'
      const transferIds: string[] = [ARBITRARY_ROOT_HASH]
      const totalTransferAmount: BigNumber = BigNumber.from('123')

      await expect(
        l1_bridge
          .connect(bonder)
          .settleBondedWithdrawals(
            await bonder.getAddress(),
            transferIds,
            totalTransferAmount
          )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('withdraw', async () => {
    it('Should not be able to withdraw with a bad proof', async () => {
      const expectedErrorMsg: string = 'BRG: Invalid transfer proof'
      const invalidProof: string[] = [ARBITRARY_TRANSFER_NONCE]
      const transferIdTreeIndex = 0
      const totalLeaves = 2
      await expect(
        l1_bridge
          .connect(bonder)
          .withdraw(
            await transfer.recipient.getAddress(),
            transfer.amount,
            ARBITRARY_TRANSFER_NONCE,
            transfer.bonderFee,
            [
              '1',
              transfer.amountOutMin,
              transfer.deadline
            ],
            ARBITRARY_ROOT_HASH,
            transfer.amount,
            transferIdTreeIndex,
            invalidProof,
            totalLeaves
          )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a user to withdraw if the withdrawal exceeds the TransferRoot total', async () => {
      const expectedErrorMsg: string = 'BRG: Withdrawal exceeds TransferRoot total'
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)
      await l2_bridge.connect(bonder).commitTransfers(transfer.chainId, await bonder.getAddress())

      // Get the rootHash from the event
      const transfersCommittedEvent = await l2_bridge.queryFilter(
        l2_bridge.filters.TransfersCommitted()
      )
      const rootHash: string = transfersCommittedEvent[0].args.rootHash

      // Bond with the same root hash but a lower amount
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount.div(2))

      const transferNonce: string = await getTransferNonceFromEvent(l2_bridge)
      const transferId: Buffer = await transfer.getTransferId(transferNonce)
      const tree: MerkleTree = getNewMerkleTree([transferId])
      const transferRootHash: Buffer = tree.getRoot()
      const proof: Buffer[] = tree.getProof(transferId)
      const transferIdTreeIndex = 0
      const totalLeaves = 1

      const timeToWait: number = 11 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)
      await l1_messenger.relayNextMessage()

      await expect(
        l1_bridge
          .connect(bonder)
          .withdraw(
            await transfer.recipient.getAddress(),
            transfer.amount,
            transferNonce,
            transfer.bonderFee,
            [
              '0',
              transfer.amountOutMin,
              transfer.deadline
            ],
            transferRootHash,
            transfer.amount.div(2),
            transferIdTreeIndex,
            proof,
            totalLeaves
          )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('confirmTransferRoot', async () => {
    it('Should not allow a transfer root to be confirmed by anybody except the L2_Bridge', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Caller must be bridge connector'
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      // Mimic the same data that would be sent with relayNextMessage()
      const transferNonce = await getTransferNonceFromEvent(l2_bridge)
      const transferId: Buffer = await transfer.getTransferId(transferNonce)
      const { rootHash } = getRootHashFromTransferId(transferId)
      const mimicChainId: BigNumber = l2ChainId
      const mimicRootHash: Buffer = rootHash
      const mimicDestinationChainId: BigNumber = transfer.chainId
      const mimicTotalAmount: BigNumber = await l2_bridge.pendingAmount(
        transfer.chainId,
        await bonder.getAddress()
      )
      const mimicTransferRootCommittedAt: BigNumber = await l1_bridge.transferRootCommittedAt(
        mimicDestinationChainId,
        transferId
      )

      await expect(
        l1_bridge
          .connect(user)
          .confirmTransferRoot(
            mimicChainId,
            mimicRootHash,
            mimicDestinationChainId,
            mimicTotalAmount,
            mimicTransferRootCommittedAt
          )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be confirmed if it was already confirmed', async () => {
      const expectedErrorMsg: string = 'CNR: Failed to forward message'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await l1_messenger.relayNextMessage()

      // The only way for this to happen in production is for the canonical messenger to relay the same message twice.
      // Our Mock Messenger allows for this and reverts with the bridge's error message

      await expect(l1_messenger.relayNextMessage()).to.be.revertedWith(
        expectedErrorMsg
      )
    })

    it('Should not allow a transfer root to be confirmed the rootCommittedAt value is 0', async () => {
      // This is not possible in the current contracts (as long as an L2's block.timestamp is 0)
    })

    it('Should not allow a transfer root to be confirmed if a mainnet transfer root amount is 0', async () => {
      // This is not possible to check, as `L2_Bridge.send()` and `L2_Bridge.swapAndSend()` perform this check
      // and disallow it on that level.
    })

    it('Should not allow a transfer root to be confirmed if the messenger wrapper for the L2 is not defined', async () => {
      const expectedErrorMsg: string = 'CNR: Failed to forward message'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2Transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [l2Transfer], bonder)

      // Unset the supported chainId for this test
      await l1_bridge.connect(governance).setXDomainConnector(
        l2Transfer.chainId,
        ZERO_ADDRESS
      )

      await expect(l1_messenger.relayNextMessage()).to.be.revertedWith(
        expectedErrorMsg
      )
    })
  })

  describe('challengeTransferBond', async () => {
    it('Should not allow a transfer root to be challenged if the transfer root has already been confirmed', async () => {
      const expectedErrorMsg: string =
        'L1_BRG: TransferRoot has already been confirmed'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      // Confirm the transfer root
      await l1_messenger.relayNextMessage()

      await expect(
        executeL1BridgeChallengeTransferBond(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer.amount,
          transfer.chainId,
          bonder,
          challenger,
          transfer
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if the TransferRoot has not been bonded', async () => {
      // This is not possible in the current contracts.
    })

    it('Should not allow a transfer root to be challenged if the transfer root is challenged after the challenge period', async () => {
      const expectedErrorMsg: string =
        'L1_BRG: TransferRoot cannot be challenged after challenge period'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      // Wait until after the challenge period
      const challengePeriod: BigNumber = await l1_bridge.challengePeriod()
      await increaseTime(challengePeriod.toNumber())

      await expect(
        executeL1BridgeChallengeTransferBond(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer.amount,
          transfer.chainId,
          bonder,
          challenger,
          transfer
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if the transfer root has already been challenged', async () => {
      const expectedErrorMsg: string = 'L1_BRG: TransferRoot already challenged'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        transfer.chainId,
        bonder,
        challenger,
        transfer
      )

      await expect(
        executeL1BridgeChallengeTransferBond(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer.amount,
          transfer.chainId,
          bonder,
          challenger,
          transfer
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if the challenger does not approve the tokens to challenge with', async () => {
      const expectedErrorMsg: string =
        'ERC20: transfer amount exceeds allowance'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      const transferNonce = await getTransferNonceFromEvent(l2_bridge)
      const transferId: Buffer = await transfer.getTransferId(transferNonce)
      await expect(
        l1_bridge
          .connect(challenger)
          .challengeTransferBond(transferId, transfer.amount, transfer.chainId)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if the challenger does not have enough tokens to challenge with', async () => {
      const expectedErrorMsg: string = 'ERC20: transfer amount exceeds balance'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      const challengerBalance: BigNumber = await l1_canonicalToken.balanceOf(
        await challenger.getAddress()
      )
      await l1_canonicalToken
        .connect(challenger)
        .transfer(DEAD_ADDRESS, challengerBalance)

      await expect(
        executeL1BridgeChallengeTransferBond(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer.amount,
          transfer.chainId,
          bonder,
          challenger,
          transfer
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if an arbitrary root hash is passed in', async () => {
      const expectedErrorMsg: string =
        'L1_BRG: TransferRoot has not been bonded'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      const challengerBalance: BigNumber = await l1_canonicalToken.balanceOf(
        await challenger.getAddress()
      )
      await l1_canonicalToken
        .connect(challenger)
        .transfer(DEAD_ADDRESS, challengerBalance)

      await expect(
        l1_bridge
          .connect(challenger)
          .challengeTransferBond(ARBITRARY_ROOT_HASH, transfer.amount, transfer.chainId)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if an incorrect originalAmount is passed in', async () => {
      const expectedErrorMsg: string =
        'L1_BRG: TransferRoot has not been bonded'
      const incorrectAmount: BigNumber = BigNumber.from('13371337')

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await expect(
        executeL1BridgeChallengeTransferBond(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          incorrectAmount,
          transfer.chainId,
          bonder,
          challenger,
          transfer
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('resolveChallenge', async () => {
    it('Should not allow a transfer root challenge to be resolved if the transfer root was never challenged', async () => {
      const expectedErrorMsg: string =
        'L1_BRG: TransferRoot has not been challenged'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      const shouldResolveSuccessfully: boolean = false

      await expect(
        executeL1BridgeResolveChallenge(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer.amount,
          bonder,
          challenger,
          transfer,
          shouldResolveSuccessfully
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root challenge to be resolved if the transfer root challenge period is not over', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Challenge period has not ended'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        transfer.chainId,
        bonder,
        challenger,
        transfer
      )

      // Resolve the challenge
      // Do not increase the time
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = false
      await expect(
        executeL1BridgeResolveChallenge(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer.amount,
          bonder,
          challenger,
          transfer,
          shouldResolveSuccessfully
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root challenge to be resolved if an arbitrary root hash is passed in', async () => {
      const expectedErrorMsg: string =
        'L1_BRG: TransferRoot has not been challenged'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        transfer.chainId,
        bonder,
        challenger,
        transfer
      )

      // Resolve the challenge
      const timeToWait: number = 11 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)
      await l1_messenger.relayNextMessage()

      await expect(
        l1_bridge.resolveChallenge(ARBITRARY_ROOT_HASH, transfer.amount, transfer.chainId)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root challenge to be resolved if it has already been resolved', async () => {
      const expectedErrorMsg: string = 'L1_BRG: TransferRoot already resolved'

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        transfer.chainId,
        bonder,
        challenger,
        transfer
      )

      // Resolve the challenge
      const timeToWait: number = 11 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = false
      const didBonderWaitMinTransferRootTime: boolean = false
      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        bonder,
        challenger,
        transfer,
        shouldResolveSuccessfully,
        didBonderWaitMinTransferRootTime
      )

      await expect(
        executeL1BridgeResolveChallenge(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer.amount,
          bonder,
          challenger,
          transfer,
          shouldResolveSuccessfully
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root challenge to be resolved if an incorrect originalAmount is passed in', async () => {
      const expectedErrorMsg: string =
        'L1_BRG: TransferRoot has not been challenged'
      const incorrectAmount: BigNumber = BigNumber.from('13371337')

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        transfer.chainId,
        bonder,
        challenger,
        transfer
      )

      // Resolve the challenge
      const timeToWait: number = 11 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = false
      await expect(
        executeL1BridgeResolveChallenge(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          incorrectAmount,
          bonder,
          challenger,
          transfer,
          shouldResolveSuccessfully
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('rescueTransferRoot', async () => {
    it('Should not rescue a transfer root from L2 -> L1 that is being rescued by someone other than governance', async () => {
      const expectedErrorMsg: string = 'Ownable: caller is not the owner'
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT,
        ARBITRARY_TRANSFER_NONCE
      )

      const timeToWait: number = 9 * SECONDS_IN_A_WEEK
      await increaseTime(timeToWait)

      await l1_bridge.connect(governance).transferOwnership(ONE_ADDRESS)

      await expect(
        executeBridgeRescueTransferRoot(
          l1_canonicalToken,
          l2_bridge,
          l1_bridge,
          transfer.amount,
          governance,
          transfer,
          ARBITRARY_TRANSFER_NONCE
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not rescue a transfer root that is not found', async () => {
      const expectedErrorMsg: string = 'BRG: TransferRoot not found'
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT,
        ARBITRARY_TRANSFER_NONCE
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        transfer.chainId,
        bonder,
        challenger,
        transfer,
        ARBITRARY_TRANSFER_NONCE
      )

      let timeToWait: number = 11 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)

      const shouldResolveSuccessfully: boolean = true
      const didBonderWaitMinTransferRootTime: boolean = false
      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        bonder,
        challenger,
        transfer,
        shouldResolveSuccessfully,
        didBonderWaitMinTransferRootTime,
        ARBITRARY_TRANSFER_NONCE
      )

      timeToWait = 9 * SECONDS_IN_A_WEEK
      await increaseTime(timeToWait)

      const invalidTransferNonce: string =
        '0x0065737400000000000000000000000000000000000000000000000000000000'
      await expect(
        executeBridgeRescueTransferRoot(
          l1_canonicalToken,
          l2_bridge,
          l1_bridge,
          transfer.amount,
          governance,
          transfer,
          invalidTransferNonce
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not rescue a transfer root that has already been confirmed', async () => {
      // This is not possible in the current contracts.
    })

    it('Should not rescue a transfer root that has not exceeded the rescue delay', async () => {
      const expectedErrorMsg: string =
        'BRG: TransferRoot cannot be rescued before the Rescue Delay'
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT,
        ARBITRARY_TRANSFER_NONCE
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        transfer.chainId,
        bonder,
        challenger,
        transfer,
        ARBITRARY_TRANSFER_NONCE
      )

      let timeToWait: number = 11 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)

      const shouldResolveSuccessfully: boolean = true
      const didBonderWaitMinTransferRootTime: boolean = false
      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        bonder,
        challenger,
        transfer,
        shouldResolveSuccessfully,
        didBonderWaitMinTransferRootTime,
        ARBITRARY_TRANSFER_NONCE
      )

      await expect(
        executeBridgeRescueTransferRoot(
          l1_canonicalToken,
          l2_bridge,
          l1_bridge,
          transfer.amount,
          governance,
          transfer,
          ARBITRARY_TRANSFER_NONCE
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('Edge cases', async () => {
    it('Should allow a user to sendToL2 with an unusual relayer fee (1 wei)', async () => {
      const relayerFee: BigNumber = BigNumber.from('1')

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
        relayerFee,
        l2ChainId
      )
    })

    it('Should allow a user to sendToL2 with an unusual relayer fee (full transfer amount)', async () => {
      const relayerFee: BigNumber = transfer.amount

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
        relayerFee,
        l2ChainId
      )
    })

    it('Should allow a user to sendToL2 with an amountOutMin that is greater than expected', async () => {
      const largeValue: BigNumber = BigNumber.from(
        '999999999999999999999999999'
      )
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.amountOutMin = BigNumber.from(largeValue.mul(largeValue))

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        customTransfer.sender,
        customTransfer.recipient,
        relayer,
        customTransfer.amount,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )
    })

    it('Should allow a user to sendToL2AndAttemptSwap with a deadline that is expired', async () => {
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.deadline = BigNumber.from('0')

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        customTransfer.sender,
        customTransfer.recipient,
        relayer,
        customTransfer.amount,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )
    })

    it("Should send a transaction to one's self from L2 to L1 and bond the transfer root on L1", async () => {
      const customTransfer: Transfer = transfers[2]

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        customTransfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [customTransfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        customTransfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )
    })

    it("Should send a transaction to one's self from L2 to L2 and bond the transfer root on L1", async () => {
      const customTransfer: Transfer = transfers[3]

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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

      // Bond withdrawal on other L2
      const actualTransferAmount: BigNumber = customTransfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        customTransfer,
        bonder,
        actualTransferAmount
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [customTransfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        customTransfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      const transferNonce = await getTransferNonceFromEvent(l2_bridge)
      const transferId: Buffer = await customTransfer.getTransferId(
        transferNonce
      )
      const nextMessage = await l22_messenger.nextMessage()
      const ABI: string[] = ['function setTransferRoot(bytes32, uint256)']
      const setTransferRootInterface = new utils.Interface(ABI)
      const expectedMessage: string = setTransferRootInterface.encodeFunctionData(
        'setTransferRoot',
        [transferId, customTransfer.amount]
      )

      expect(nextMessage[0]).to.eq(l22_bridgeConnector.address)
      expect(nextMessage[1]).to.eq(expectedMessage)
    })

    it('Should get the bond for a transfer amount of 0', async () => {
      const expectedBond: BigNumber = BigNumber.from('0')
      const transferAmount: BigNumber = BigNumber.from('0')
      const bond: BigNumber = await l1_bridge.getBondForTransferAmount(transferAmount)
      expect(bond).to.eq(expectedBond)
    })

    it('Should get the challenge amount for transfer amount of 0', async () => {
      const expectedChallengeAmount: BigNumber = BigNumber.from('0')
      const transferAmount: BigNumber = BigNumber.from('0')
      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transferAmount)
      expect(challengeAmount).to.eq(expectedChallengeAmount)
    })

    it('Should get the time slot for a time of 0', async () => {
      const expectedTimeSlot: BigNumber = BigNumber.from('0')
      const time: BigNumber = BigNumber.from('0')
      const timeSlot: BigNumber = await l1_bridge.getTimeSlot(time)
      expect(timeSlot).to.eq(expectedTimeSlot)
    })

    it('Should settle bonded withdrawals with an arbitrary bonder address but not update any relevant state. Should then let the actual bonder settle.', async () => {
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
        transfer.amount.mul(2),
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      const transferIndex: BigNumber = BigNumber.from('1')
      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer, transferIndex)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        transferIndex
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer, transfer], bonder)

      await l1_messenger.relayNextMessage()

      const numTransfers: BigNumber = BigNumber.from('2')
      let totalTransferAmount: BigNumber = BigNumber.from('0')
      let transferIds: Buffer[] = []
      for (let i = 0; i < numTransfers.toNumber(); i++) {
        const transferNonce: string = await getTransferNonceFromEvent(l2_bridge, BigNumber.from(i))
        transferIds.push(await transfer.getTransferId(transferNonce))
        totalTransferAmount = totalTransferAmount.add(transfers[i].amount)
      }

      const creditBefore = await l1_bridge.getCredit(await bonder.getAddress())
      // Send tx with arbitrary bonder address
      await l1_bridge
        .connect(bonder)
        .settleBondedWithdrawals(
          await user.getAddress(),
          transferIds,
          totalTransferAmount
        )

      // Validate state after transaction
      const currentTime: number = Math.floor(Date.now() / 1000)
      let calculatedTransferIds: Buffer[] = []
      for (let i = 0; i < numTransfers.toNumber(); i++) {
        const transferNonce = await getTransferNonceFromEvent(
          l2_bridge,
          BigNumber.from(i)
        )
        calculatedTransferIds.push(await transfer.getTransferId(transferNonce))
      }
      const expectedMerkleTree: MerkleTree = getNewMerkleTree(calculatedTransferIds)
      const transferRoot: number = await l1_bridge.getTransferRoot(
        expectedMerkleTree.getHexRoot(),
        totalTransferAmount
      )
      const creditAfter = await l1_bridge.getCredit(await bonder.getAddress())
      expect(transferRoot[0]).to.eq(totalTransferAmount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))
      expect(transferRoot[2].toNumber()).to.be.closeTo(
        currentTime,
        TIMESTAMP_VARIANCE
      )
      expect(creditBefore.sub(creditAfter)).to.eq(BigNumber.from('0'))

      // Send expected tx
      await executeBridgeSettleBondedWithdrawals(
        l1_bridge,
        l2_bridge,
        [transfer, transfer],
        bonder
      )
    })

    it('Should settle bonded withdrawals and update state. Should then try to settle a single withdrawal and fail.', async () => {
      const expectedErrorMsg: string = 'L2_BRG: transferId has no bond'
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
        transfer.amount.mul(2),
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      const transferIndex: BigNumber = BigNumber.from('1')
      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer, transferIndex)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        transferIndex
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer, transfer], bonder)

      await l1_messenger.relayNextMessage()

      // Send expected tx
      await executeBridgeSettleBondedWithdrawals(
        l1_bridge,
        l2_bridge,
        [transfer, transfer],
        bonder
      )

      await expect(
        executeBridgeSettleBondedWithdrawal(
          l1_bridge,
          l2_bridge,
          transfer,
          bonder
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should successfully challenge a bonder that bonds a correct rootHash but incorrect amount', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)
      await l2_bridge.connect(bonder).commitTransfers(transfer.chainId, await bonder.getAddress())

      // Get the rootHash from the event
      const transfersCommittedEvent = await l2_bridge.queryFilter(
        l2_bridge.filters.TransfersCommitted()
      )
      const rootHash: string = transfersCommittedEvent[0].args.rootHash

      // Bond with the same root hash but a lower amount
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.amount = transfer.amount.div(2)
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, customTransfer.amount)

      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(
        customTransfer.amount
      )
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)
      await l1_bridge.connect(challenger).challengeTransferBond(
        rootHash,
        customTransfer.amount,
        customTransfer.chainId
      )

      // Message is relayed and proves the bonder wrong
      const timeToWait: number = 11 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)
      await l1_messenger.relayNextMessage()

      await l1_bridge.resolveChallenge(rootHash, customTransfer.amount, transfer.chainId)

      // DEAD address should have tokens because of successful challenge
      const balanceAfter: BigNumber = await l1_canonicalToken.balanceOf(
        DEAD_ADDRESS
      )
      expect(balanceAfter.toString()).to.eq(
        BigNumber.from(challengeAmount)
          .div(4)
          .toString()
      )
    })

    it('Should allow a user to withdraw a transfer if the bonder bonded the transfer with an incorrect totalAmount', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)
      await l2_bridge.connect(bonder).commitTransfers(transfer.chainId, await bonder.getAddress())

      // Get the rootHash from the event
      const transfersCommittedEvent = await l2_bridge.queryFilter(
        l2_bridge.filters.TransfersCommitted()
      )
      const rootHash: string = transfersCommittedEvent[0].args.rootHash

      // Bond with the same root hash but a lower amount
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.amount = transfer.amount.div(2)
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, customTransfer.amount)

      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(
        customTransfer.amount
      )
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)
      await l1_bridge.connect(challenger).challengeTransferBond(
        rootHash,
        customTransfer.amount,
        customTransfer.chainId
      )

      // Message is relayed and proves the bonder wrong
      const timeToWait: number = 11 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)
      await l1_messenger.relayNextMessage()

      await l1_bridge.resolveChallenge(rootHash, customTransfer.amount, transfer.chainId)

      // DEAD address should have tokens because of successful challenge
      const balanceAfter: BigNumber = await l1_canonicalToken.balanceOf(
        DEAD_ADDRESS
      )
      expect(balanceAfter.toString()).to.eq(
        BigNumber.from(challengeAmount)
          .div(4)
          .toString()
      )

      await executeBridgeWithdraw(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )
    })

    it('Should allow a malicious bonder to withdraw as much as they want because nobody challenges them', async () => {
      // Create a fraudulent transfer
      const transferNonce: string = await l2_bridge.getNextTransferNonce()
      const transferId: Buffer = await transfer.getTransferId(transferNonce)
      const { rootHash } = getRootHashFromTransferId(transferId)

      const tree: MerkleTree = getNewMerkleTree([transferId])
      const transferRootHash: Buffer = tree.getRoot()
      const proof: Buffer[] = tree.getProof(transferId)
      const transferIdTreeIndex = 0
      const totalLeaves = 1

      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeToWait: number = 11 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)
      await l1_messenger.relayNextMessage()


      // const transferNonce: string = await getTransferNonceFromEvent(l2_bridge)
      // const transferId: Buffer = await transfer.getTransferId(transferNonce)

      // const { rootHash } = getRootHashFromTransferId(transferId)

      const recipientCanonicalTokenBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(
        await transfer.recipient.getAddress()
      )
      const bonderBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(
        await bonder.getAddress()
      )
      const transferRootAmountWithdrawnBefore: BigNumber = (
        await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      )[1]

      // Perform transaction
      await l1_bridge
        .connect(bonder)
        .withdraw(
          await transfer.recipient.getAddress(),
          transfer.amount,
          transferNonce,
          transfer.bonderFee,
          [
            '0',
            transfer.amountOutMin,
            transfer.deadline
          ],
          transferRootHash,
          transfer.amount,
          transferIdTreeIndex,
          proof,
          totalLeaves
        )

      // Validate state after transaction
      const transferRootAmountWithdrawnAfter: BigNumber = (
        await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      )[1]

      // NOTE: Unbonded withdrawals do not pay the bonder
      await expectBalanceOf(
        l1_canonicalToken,
        transfer.recipient,
        recipientCanonicalTokenBalanceBefore.add(transfer.amount)
      )

      await expectBalanceOf(l1_canonicalToken, bonder, bonderBalanceBefore)

      expect(transferRootAmountWithdrawnAfter).to.eq(
        transferRootAmountWithdrawnBefore.add(transfer.amount)
      )
      const isTransferIdSpent = await l1_bridge.isTransferIdSpent(transferId)
      expect(isTransferIdSpent).to.eq(true)
    })

    it('Should send a transaction from L2 to L1, bond withdrawal on L1 with wrong chainId, challenge the transfer bond, and resolve successfully', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      const transferNonce = await getTransferNonceFromEvent(l2_bridge)
      const transferId: Buffer = await transfer.getTransferId(transferNonce)
      const { rootHash } = getRootHashFromTransferId(transferId)

      // Perform transaction
      const incorrectChainId: BigNumber = l22ChainId
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, incorrectChainId, transfer.amount)

      const transferRootId: string = await l1_bridge.getTransferRootId(
        rootHash,
        transfer.amount
      )
      let bond = await l1_bridge.transferBonds(transferRootId)
      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        incorrectChainId,
        bonder,
        challenger,
        transfer
      )

      bond = await l1_bridge.transferBonds(transferRootId)

      const timeToWait: number = 10 * SECONDS_IN_A_DAY
      await increaseTime(timeToWait)
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = true
      const didBonderWaitMinTransferRootTime: boolean = false
      const customTransferNonce = null
      const customChainId = incorrectChainId

      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer.amount,
        bonder,
        challenger,
        transfer,
        shouldResolveSuccessfully,
        didBonderWaitMinTransferRootTime,
        customTransferNonce,
        customChainId
      )
    })

    it('Should send a transaction from L1 to L2, bond it, and settle the bonded withdrawal, then call it again with another bonder (but not update state)', async () => {
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

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)

      await l1_messenger.relayNextMessage()

      await executeBridgeSettleBondedWithdrawals(
        l1_bridge,
        l2_bridge,
        [transfer],
        bonder
      )

      await l1_registry.connect(governance).addBonder(await otherUser.getAddress())

      const transferNonce: string = await getTransferNonceFromEvent(l2_bridge)
      const transferId: Buffer = await transfer.getTransferId(transferNonce)
      const totalTransferAmount: BigNumber = transfer.amount
      await l1_bridge
        .connect(bonder)
        .settleBondedWithdrawals(
          await bonder.getAddress(),
          [transferId],
          totalTransferAmount
        )

        const credit = await l1_bridge.getCredit(await otherUser.getAddress())
        expect(credit).to.eq(BigNumber.from('0'))
    })

    it('Should settle bonded withdrawals and update state with 3, 5, 7, 11, 12, and 15 transfers.', async () => {
      await l1_canonicalToken.mint(await user.getAddress(), USER_INITIAL_BALANCE.mul(100))
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
        transfer.amount.mul(100),
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      let startingTransferIndex: BigNumber = BigNumber.from('0')
      let transferIndex: BigNumber = startingTransferIndex
      let expectedTransfers: Transfer[] = [transfer, transfer, transfer]
      expect(expectedTransfers.length).to.eq(3)
      for (let i = 0; i < expectedTransfers.length; i++) {
        await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer, transferIndex)

        await executeBridgeBondWithdrawal(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer,
          bonder,
          transferIndex
        )

        transferIndex = transferIndex.add('1')
      }

      await executeL2BridgeCommitTransfers(l2_bridge, expectedTransfers, bonder, startingTransferIndex)

      await l1_messenger.relayNextMessage()

      await executeBridgeSettleBondedWithdrawals(
        l1_bridge,
        l2_bridge,
        expectedTransfers,
        bonder
      )

      // 5 transfers
      startingTransferIndex = startingTransferIndex.add(expectedTransfers.length)
      transferIndex = startingTransferIndex
      expectedTransfers = [transfer, transfer, transfer, transfer, transfer]
      expect(expectedTransfers.length).to.eq(5)
      for (let i = 0; i < expectedTransfers.length; i++) {
        await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer, transferIndex)

        await executeBridgeBondWithdrawal(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer,
          bonder,
          transferIndex
        )

        transferIndex = transferIndex.add('1')
      }

      await executeL2BridgeCommitTransfers(l2_bridge, expectedTransfers, bonder, startingTransferIndex)

      await l1_messenger.relayNextMessage()

      await executeBridgeSettleBondedWithdrawals(
        l1_bridge,
        l2_bridge,
        expectedTransfers,
        bonder,
        startingTransferIndex
      )

      // 7 transfers
      startingTransferIndex = startingTransferIndex.add(expectedTransfers.length)
      transferIndex = startingTransferIndex
      expectedTransfers = [
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer
      ]
      expect(expectedTransfers.length).to.eq(7)
      for (let i = 0; i < expectedTransfers.length; i++) {
        await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer, transferIndex)

        await executeBridgeBondWithdrawal(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer,
          bonder,
          transferIndex
        )

        transferIndex = transferIndex.add('1')
      }

      await executeL2BridgeCommitTransfers(l2_bridge, expectedTransfers, bonder, startingTransferIndex)

      await l1_messenger.relayNextMessage()

      await executeBridgeSettleBondedWithdrawals(
        l1_bridge,
        l2_bridge,
        expectedTransfers,
        bonder,
        startingTransferIndex
      )

      // 11 transfers
      startingTransferIndex = startingTransferIndex.add(expectedTransfers.length)
      transferIndex = startingTransferIndex
      expectedTransfers = [
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer
      ]
      expect(expectedTransfers.length).to.eq(11)
      for (let i = 0; i < expectedTransfers.length; i++) {
        await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer, transferIndex)

        await executeBridgeBondWithdrawal(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer,
          bonder,
          transferIndex
        )

        transferIndex = transferIndex.add('1')
      }

      await executeL2BridgeCommitTransfers(l2_bridge, expectedTransfers, bonder, startingTransferIndex)

      await l1_messenger.relayNextMessage()

      await executeBridgeSettleBondedWithdrawals(
        l1_bridge,
        l2_bridge,
        expectedTransfers,
        bonder,
        startingTransferIndex
      )

      // 12 transfers
      startingTransferIndex = startingTransferIndex.add(expectedTransfers.length)
      transferIndex = startingTransferIndex
      expectedTransfers = [
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer
      ]
      expect(expectedTransfers.length).to.eq(12)
      for (let i = 0; i < expectedTransfers.length; i++) {
        await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer, transferIndex)

        await executeBridgeBondWithdrawal(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer,
          bonder,
          transferIndex
        )

        transferIndex = transferIndex.add('1')
      }

      await executeL2BridgeCommitTransfers(l2_bridge, expectedTransfers, bonder, startingTransferIndex)

      await l1_messenger.relayNextMessage()

      await executeBridgeSettleBondedWithdrawals(
        l1_bridge,
        l2_bridge,
        expectedTransfers,
        bonder,
        startingTransferIndex
      )

      // 15 transfers
      startingTransferIndex = startingTransferIndex.add(expectedTransfers.length)
      transferIndex = startingTransferIndex
      expectedTransfers = [
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer,
        transfer
      ]
      expect(expectedTransfers.length).to.eq(15)
      for (let i = 0; i < expectedTransfers.length; i++) {
        await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer, transferIndex)

        await executeBridgeBondWithdrawal(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          transfer,
          bonder,
          transferIndex
        )

        transferIndex = transferIndex.add('1')
      }

      await executeL2BridgeCommitTransfers(l2_bridge, expectedTransfers, bonder, startingTransferIndex)

      await l1_messenger.relayNextMessage()

      await executeBridgeSettleBondedWithdrawals(
        l1_bridge,
        l2_bridge,
        expectedTransfers,
        bonder,
        startingTransferIndex
      )
    })
  })
})
