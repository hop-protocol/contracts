import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber, utils } from 'ethers'
import Transfer from '../../lib/Transfer'
import MerkleTree from '../../lib/MerkleTree'

import {
  setUpDefaults,
  expectBalanceOf,
  getOriginalSignerBalances,
  getRootHashFromTransferId,
  getTransferRootId,
  increaseTime,
  revertSnapshot,
  takeSnapshot
} from '../shared/utils'
import { fixture } from '../shared/fixtures'
import { IFixture } from '../shared/interfaces'

import {
  CHAIN_IDS,
  DEFAULT_AMOUNT_OUT_MIN,
  DEFAULT_DEADLINE,
  USER_INITIAL_BALANCE,
  BONDER_INITIAL_BALANCE,
  INITIAL_BONDED_AMOUNT,
  LIQUIDITY_PROVIDER_UNISWAP_AMOUNT,
  CHALLENGER_INITIAL_BALANCE,
  ZERO_ADDRESS,
  SECONDS_IN_A_DAY,
  TIMESTAMP_VARIANCE
} from '../../config/constants'

describe('L1_Bridge', () => {
  let _fixture: IFixture
  let l2ChainId: BigNumber
  let l22ChainId: BigNumber

  let user: Signer
  let bonder: Signer
  let relayer: Signer
  let challenger: Signer
  let otherUser: Signer

  let l1_canonicalToken: Contract
  let l1_bridge: Contract
  let l1_messenger: Contract
  let l1_messengerWrapper: Contract
  let l2_canonicalToken: Contract
  let l2_bridge: Contract
  let l2_messenger: Contract
  let l2_uniswapRouter: Contract
  let l22_canonicalToken: Contract
  let l22_bridge: Contract
  let l22_messenger: Contract
  let l22_uniswapRouter: Contract

  let transfers: Transfer[]

  let originalBondedAmount: BigNumber
  let user_l1_canonicalTokenOriginalBalance: BigNumber
  let bonder_l1_canonicalTokenOriginalBalance: BigNumber
  let user_l2_canonicalTokenOriginalBalance: BigNumber
  let bonder_l2_canonicalTokenOriginalBalance: BigNumber
  let user_l2_bridgeTokenOriginalBalance: BigNumber
  let bonder_l2_bridgeTokenOriginalBalance: BigNumber

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
      relayer,
      challenger,
      otherUser,
      l1_canonicalToken,
      l1_bridge,
      l1_messenger,
      l1_messengerWrapper,
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
      l2_canonicalToken: l22_canonicalToken,
      l2_bridge: l22_bridge,
      l2_messenger: l22_messenger,
      l2_uniswapRouter: l22_uniswapRouter
    } = _fixture)

    ;({
      originalBondedAmount,
      user_l1_canonicalTokenOriginalBalance,
      bonder_l1_canonicalTokenOriginalBalance,
      user_l2_canonicalTokenOriginalBalance,
      bonder_l2_canonicalTokenOriginalBalance,
      user_l2_bridgeTokenOriginalBalance,
      bonder_l2_bridgeTokenOriginalBalance,
    } = await getOriginalSignerBalances(
      user,
      bonder,
      l1_bridge,
      l2_bridge,
      l1_canonicalToken,
      l2_canonicalToken,
    ))
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

  it('Should allow a user to send from L2 to L1 and perform a bonded withdrawal', async () => {
    // Set up transfer
    let transfer: any = transfers[0]
    transfer.chainId = CHAIN_IDS.ETHEREUM.MAINNET
    transfer.amountOutMin = BigNumber.from(0)
    transfer.deadline = BigNumber.from(0)

    // Instantiate a sender and recipient Signer
    const sender: Signer = user
    const recipient: Signer = otherUser
    expect(transfer.sender).to.eq(await sender.getAddress())
    expect(transfer.recipient).to.eq(await recipient.getAddress())

    // User moves funds to L2
    await l1_canonicalToken
      .connect(user)
      .approve(l1_bridge.address, transfer.amount)
    await l1_bridge
      .connect(user)
      .sendToL2(l2ChainId.toString(), await user.getAddress(), transfer.amount)
    await l2_messenger.relayNextMessage()

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
    )
    await expectBalanceOf(l2_bridge, user, transfer.amount)

    // User moves funds back to L1 across the liquidity bridge
    await l2_bridge
      .connect(user)
      .send(
        transfer.chainId,
        transfer.recipient,
        transfer.amount,
        transfer.transferNonce,
        transfer.relayerFee,
        transfer.amountOutMin,
        transfer.deadline
      )

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      otherUser,
      0
    )
    await expectBalanceOf(l2_bridge, user, 0)

    await l1_bridge
      .connect(bonder)
      .bondWithdrawal(
        transfer.sender,
        transfer.recipient,
        transfer.amount,
        transfer.transferNonce,
        transfer.relayerFee
      )

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      otherUser,
      transfer.amount.sub(transfer.relayerFee)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      bonder,
      bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
    )
  })

  it('Should send a transaction from L2 to L1, perform a bonded withdrawal, and confirm an already bonded transfer root on L1', async () => {
    // Set up transfer
    let transfer: any = transfers[0]
    transfer.chainId = CHAIN_IDS.ETHEREUM.MAINNET
    transfer.amountOutMin = BigNumber.from(0)
    transfer.deadline = BigNumber.from(0)

    // Instantiate a sender and recipient Signer
    const sender: Signer = user
    const recipient: Signer = otherUser
    expect(transfer.sender).to.eq(await sender.getAddress())
    expect(transfer.recipient).to.eq(await recipient.getAddress())

    // User moves funds to L2
    await l1_canonicalToken
      .connect(user)
      .approve(l1_bridge.address, transfer.amount)
    await l1_bridge
      .connect(user)
      .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
    await l2_messenger.relayNextMessage()

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
    )
    await expectBalanceOf(l2_bridge, user, transfer.amount)

    // User moves funds back to L1 across the liquidity bridge
    await l2_bridge
      .connect(user)
      .send(
        transfer.chainId,
        transfer.recipient,
        transfer.amount,
        transfer.transferNonce,
        transfer.relayerFee,
        transfer.amountOutMin,
        transfer.deadline
      )

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      otherUser,
      0
    )
    await expectBalanceOf(l2_bridge, user, 0)

    await l1_bridge
      .connect(bonder)
      .bondWithdrawal(
        transfer.sender,
        transfer.recipient,
        transfer.amount,
        transfer.transferNonce,
        transfer.relayerFee
      )

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      otherUser,
      transfer.amount.sub(transfer.relayerFee)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      bonder,
      bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
    )

    // Validate state before commitTransfers
    const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(BigNumber.from('0'))
    const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
    const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
    expect(pendingAmountChainId).to.eq(transfer.chainId)
    expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

    // Bonder commits transfers
    await l2_bridge
      .connect(bonder)
      .commitTransfers(transfer.chainId)

    // Validate state after commitTransfers()
    const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
    const expectedCommitTimeForChainId: number = Date.now()
    expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
      expectedCommitTimeForChainId,
      TIMESTAMP_VARIANCE
    )
    const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
    try {
      await l2_bridge.pendingAmountChainIds(0)
      throw new Error('There should not be a pending amount chainId in this slot.')
    } catch (err) {
      expect(err.message).to.eq(expectedErrorMsg)
    }
    try {
      await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      throw new Error('There should not be a pending transfer ID for chainId in this slot.')
    } catch (err) {
      expect(err.message).to.eq(expectedErrorMsg)
    }

    // Set up transfer root
    const transferId: Buffer = transfer.getTransferId()
    const { rootHash } = getRootHashFromTransferId(transferId)

    // Bonder bonds the transfer root
    await l1_bridge
      .connect(bonder)
      .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

    const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
    const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
    const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
    const transferBond: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
    let transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
    expect(timeSlotToAmountBonded).to.eq(bondAmount)
    expect(transferBond).to.eq(bondAmount)
    expect(transferRoot[0]).to.eq(transfer.amount)
    expect(transferRoot[1]).to.eq(BigNumber.from('0'))

    // Bonder settles withdrawals
    await l1_bridge
      .connect(bonder)
      .settleBondedWithdrawals(await bonder.getAddress(), [ transferId ], transfer.amount)

    transferRoot = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
    const credit = await l1_bridge.getCredit(await bonder.getAddress())
    const expectedCredit: BigNumber = originalBondedAmount.add(transfer.amount)
    expect(transferRoot[0]).to.eq(transfer.amount)
    expect(transferRoot[1]).to.eq(transfer.amount)
    expect(credit).to.eq(expectedCredit)

    // Message gets relayed to L1 and bonder confirms the transfer root
    await l1_messenger.relayNextMessage()

    const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount);
    const transferRootConfirmed: boolean = await l1_bridge.transferRootConfirmed(transferRootId)
    const transferBondByTransferRootId = await l1_bridge.transferBonds(transferRootId)
    expect(transferRootConfirmed).to.eq(true)
    expect(transferBondByTransferRootId[0]).to.eq(await bonder.getAddress())
    expect(transferBondByTransferRootId[1].mul(1000).toNumber()).to.be.closeTo(
      expectedCommitTimeForChainId,
      TIMESTAMP_VARIANCE
    )
    expect(transferBondByTransferRootId[2]).to.eq(transfer.amount)
    expect(transferBondByTransferRootId[3]).to.eq(false)
    expect(transferBondByTransferRootId[4]).to.eq(ZERO_ADDRESS)
  })

  it('Should send a transaction from L2 to L1 and confirm a not-yet-bonded transfer root on L1', async () => {
    // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
  })

  it('Should challenge a malicious transfer root', async () => {
    let transfer: any = transfers[0]
    transfer.chainId = CHAIN_IDS.OPTIMISM.TESTNET_1

    // Set up test params
    const expectedChallengeStartTime: number = Date.now()
    const expectedCreatedAtTime: number = expectedChallengeStartTime

    // Set up transfer root
    const transferId: Buffer = transfer.getTransferId()
    const { rootHash, rootHashHex } = getRootHashFromTransferId(transferId)

    // Bonder bonds transfer root
    const chainId: BigNumber = transfer.chainId
    const amount: BigNumber = transfer.amount
    await l1_bridge
      .connect(bonder)
      .bondTransferRoot(rootHash, chainId, amount)

    // Get current debit
    const originalDebit = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())

    // Challenger challenges transfer bond
    const challengeAmount: BigNumber = l1_bridge.getChallengeAmountForTransferAmount(
      transfer.amount
    )
    await l1_canonicalToken
      .connect(challenger)
      .approve(l1_bridge.address, challengeAmount)
    await l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)

    // Validate balances
    // TODO: This requires the L2 Bridge to confirm the transfer, or else the transfer will have a total of 0
    // await expectBalanceOf(l1_canonicalToken, challenger, CHALLENGER_INITIAL_BALANCE.sub(transfer.amount))

    // Validate transfer bond
    const transferRootId: string = getTransferRootId(rootHashHex, transfer.amount)
    const transferBond = await l1_bridge.transferBonds(transferRootId)

    expect(transferBond[0]).to.eq(await bonder.getAddress())
    expect(transferBond[1].mul(1000).toNumber()).to.be.closeTo(
      expectedChallengeStartTime,
      TIMESTAMP_VARIANCE
    )
    expect(transferBond[2]).to.eq(transfer.amount)
    expect(transferBond[3]).to.eq(false)
    expect(transferBond[4].mul(1000).toNumber()).to.be.closeTo(
      expectedCreatedAtTime,
      TIMESTAMP_VARIANCE
    )
    expect(transferBond[5]).to.eq(await challenger.getAddress())

    // Validate time slot bond
    // TODO: Validate the time slot
    // const bondAmount: BigNumber = await l1_bridge.getBondForTransferAmount(transfer.amount)
    // const timeSlot: BigNumber = await l1_bridge.getTimeSlot(expectedChallengeStartTime)
    // const newTimeSlotToAmountBonded: BigNumber = await l1_bridge.timeSlotToAmountBonded(timeSlot)
    // expect(originalTimeSlotToAmountBonded).to.eq(newTimeSlotToAmountBonded.add(bondAmount))

    // Validate accounting
    // TODO: Validate the accounting
    // const newDebit = await l1_bridge.getDebit()
    // expect(originalDebit).to.eq(newDebit.sub(bondAmount))
  })

  it('Should successfully challenge a malicious transfer root', async () => {
    let transfer: any = transfers[0]
    transfer.chainId = CHAIN_IDS.OPTIMISM.TESTNET_1

    // User withdraws from L1 bridge
    const tree = new MerkleTree([transfer.getTransferId()])

    // Bonder bonds transfer root
    const chainId: BigNumber = transfer.chainId
    const amount: BigNumber = transfer.amount
    await l1_bridge
      .connect(bonder)
      .bondTransferRoot(tree.getRoot(), chainId, amount)

    // Challenger challenges transfer bond
    await l1_canonicalToken
      .connect(challenger)
      .approve(l1_bridge.address, transfer.amount)
    await l1_bridge.connect(challenger).challengeTransferBond(tree.getRoot(), transfer.amount)
    const numDaysToWait: number = 9 * SECONDS_IN_A_DAY
    await increaseTime(numDaysToWait)

    await l1_bridge.connect(challenger).resolveChallenge(tree.getRoot(), transfer.amount)

    // TODO: Validate all state
  })

  it('Should unsuccessfully challenge a malicious transfer root', async () => {
    // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
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
      const collateralTokenAddress = await l1_bridge.l1CanonicalToken()
      const isBonder = await l1_bridge.getIsBonder(await bonder.getAddress())
      expect(collateralTokenAddress).to.eq(l1_canonicalToken.address)
      expect(isBonder).to.eq(true)
    })
  })

  describe('sendToL2', async () => {
    it('Should send tokens across the bridge via sendToL2', async () => {
      const tokenAmount = user_l1_canonicalTokenOriginalBalance
      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, tokenAmount)
      await l1_bridge
        .connect(user)
        .sendToL2(l2ChainId.toString(), await user.getAddress(), tokenAmount)
      await l2_messenger.relayNextMessage()

      await expectBalanceOf(l1_canonicalToken, user, tokenAmount.sub(tokenAmount))
      await expectBalanceOf(l2_bridge, user, tokenAmount)
      expect(await l1_bridge.chainBalance(l2ChainId)).to.eq(LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.add(INITIAL_BONDED_AMOUNT).add(tokenAmount))
    })
  })

  describe('sendToL2AndAttemptToSwap', async () => {
    it('Should send tokens across the bridge and swap via sendToL2AndAttemptSwap', async () => {
      const tokenAmount = user_l1_canonicalTokenOriginalBalance
      const expectedAmounts: BigNumber[] = await l2_uniswapRouter.getAmountsOut(
        tokenAmount,
        [l2_canonicalToken.address, l2_bridge.address]
      )
      const expectedAmountAfterSlippage: BigNumber = expectedAmounts[1]

      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, tokenAmount)
      await l1_bridge
        .connect(user)
        .sendToL2AndAttemptSwap(
          l2ChainId.toString(),
          await user.getAddress(),
          tokenAmount,
          DEFAULT_AMOUNT_OUT_MIN,
          DEFAULT_DEADLINE
        )
      await l2_messenger.relayNextMessage()

      await expectBalanceOf(l1_canonicalToken, user, tokenAmount.sub(tokenAmount))
      await expectBalanceOf(l2_canonicalToken, user, expectedAmountAfterSlippage)
      await expectBalanceOf(l2_bridge, user, 0)
      expect(await l1_bridge.chainBalance(l2ChainId)).to.eq(LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.add(INITIAL_BONDED_AMOUNT).add(tokenAmount))
    })
  })

  describe('bondTransferRoot', async () => {
    it('Should send a transaction from L2 to L1 and bond the transfer root on L1', async () => {
      // Set up transfer
      let transfer: any = transfers[0]
      transfer.chainId = CHAIN_IDS.ETHEREUM.MAINNET
      transfer.amountOutMin = BigNumber.from(0)
      transfer.deadline = BigNumber.from(0)

      // Instantiate a sender and recipient Signer
      const sender: Signer = user
      const recipient: Signer = otherUser
      expect(transfer.sender).to.eq(await sender.getAddress())
      expect(transfer.recipient).to.eq(await recipient.getAddress())

      // User moves funds to L2
      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge
        .connect(user)
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(l2_bridge, user, transfer.amount)

      // User moves funds back to L1 across the liquidity bridge
      await l2_bridge
        .connect(user)
        .send(
          transfer.chainId,
          transfer.recipient,
          transfer.amount,
          transfer.transferNonce,
          transfer.relayerFee,
          transfer.amountOutMin,
          transfer.deadline
        )

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        0
      )
      await expectBalanceOf(l2_bridge, user, 0)

      await l1_bridge
        .connect(bonder)
        .bondWithdrawal(
          transfer.sender,
          transfer.recipient,
          transfer.amount,
          transfer.transferNonce,
          transfer.relayerFee
        )

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      // Set up transfer root
      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      // Bonder bonds the transfer root
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferBond: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(transferBond).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))
    })

    it('Should send a transaction from L2 to L2 and bond the transfer root on L1', async () => {
      // Set up transfer
      let transfer: any = transfers[0]
      transfer.chainId = CHAIN_IDS.ETHEREUM.MAINNET
      transfer.amountOutMin = BigNumber.from(0)
      transfer.deadline = BigNumber.from(0)

      let l2Transfer: any = transfers[0]
      l2Transfer.chainId = l22ChainId
      l2Transfer.amountOutMin = BigNumber.from(0)
      l2Transfer.deadline = BigNumber.from(0)

      // Instantiate a sender and recipient Signer
      const sender: Signer = user
      const recipient: Signer = otherUser
      expect(transfer.sender).to.eq(await sender.getAddress())
      expect(transfer.recipient).to.eq(await recipient.getAddress())

      // User moves funds to first L2
      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge
        .connect(user)
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(l2_bridge, user, transfer.amount)

      // User moves funds to the other l2
      await l2_bridge
        .connect(user)
        .send(
          l2Transfer.chainId,
          l2Transfer.recipient,
          l2Transfer.amount,
          l2Transfer.transferNonce,
          l2Transfer.relayerFee,
          l2Transfer.amountOutMin,
          l2Transfer.deadline
        )

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        0
      )
      await expectBalanceOf(l2_bridge, user, 0)
      await expectBalanceOf(l22_bridge, user, 0)

      await l22_bridge
        .connect(bonder)
        .bondWithdrawalAndAttemptSwap(
          l2Transfer.sender,
          l2Transfer.recipient,
          l2Transfer.amount,
          l2Transfer.transferNonce,
          l2Transfer.relayerFee,
          l2Transfer.amountOutMin,
          l2Transfer.deadline
        )

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l22_bridge,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      // Set up transfer root
      const transferId: Buffer = l2Transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      // Bonder bonds the transfer root
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, l2Transfer.chainId, l2Transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(l2Transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferBond: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(transferBond).to.eq(bondAmount)

      const nextMessage = await l22_messenger.nextMessage()
      const ABI: string[] = [ "function setTransferRoot(bytes32, uint256)" ]
      const setTransferRootInterface = new utils.Interface(ABI)
      const expectedMessage: string  = setTransferRootInterface.encodeFunctionData("setTransferRoot", [ rootHash, l2Transfer.amount ])
      expect(nextMessage[0]).to.eq(l22_bridge.address)
      expect(nextMessage[1]).to.eq(expectedMessage)
    })
  })

  describe('confirmTransferRoot', async () => {
    // TODO
  })

  describe('challengeTransferBond', async () => {
    // TODO
  })

  describe('resolveChallenge', async () => {
    // TODO
  })

  // TODO: Test extreme relayer fees (0, max)
  // TODO: Test the same recipient
  /**
   * Non-Happy Path
   */

  describe('bondTransferRoot', async () => {
    it('Should not allow a transfer root to be bonded unless it is called by the bonder', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      const chainId: BigNumber = CHAIN_IDS.ARBITRUM.TESTNET_3
      const amount: BigNumber = BigNumber.from(1)
      const expectedErrorMsg: string = 'ACT: Caller is not bonder'

      await expect(
        l1_bridge
          .connect(user)
          .bondTransferRoot(tree.getRoot(), chainId, amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded that exceeds the committee bond', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(await bonder.getAddress(), BigNumber.from(1))

      const chainId: BigNumber = CHAIN_IDS.OPTIMISM.TESTNET_1
      const amount: BigNumber = BONDER_INITIAL_BALANCE.mul(2)
      const expectedErrorMsg: string = 'ACT: Not enough available credit'

      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainId, amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root has already been confirmed', async () => {
      // Set up transfer
      let transfer: any = transfers[0]
      transfer.chainId = CHAIN_IDS.ETHEREUM.MAINNET
      transfer.amountOutMin = BigNumber.from(0)
      transfer.deadline = BigNumber.from(0)

      // Instantiate a sender and recipient Signer
      const sender: Signer = user
      const recipient: Signer = otherUser
      expect(transfer.sender).to.eq(await sender.getAddress())
      expect(transfer.recipient).to.eq(await recipient.getAddress())

      // User moves funds to L2
      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge
        .connect(user)
        .sendToL2(
          l2ChainId.toString(),
          await user.getAddress(),
          transfer.amount
        )
      await l2_messenger.relayNextMessage()
      await expectBalanceOf(l2_bridge, user, transfer.amount)

      // User moves funds back to L1 across the liquidity bridge
      await l2_bridge
        .connect(user)
        .send(
          transfer.chainId,
          transfer.recipient,
          transfer.amount,
          transfer.transferNonce,
          transfer.relayerFee,
          transfer.amountOutMin,
          transfer.deadline
        )

      // User should have less balance now
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )

      await l2_bridge.commitTransfers(transfer.chainId)
      await l1_messenger.relayNextMessage()

      // User withdraws from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])
      const rootHash: Buffer = tree.getRoot()
      const proof: Buffer[] = tree.getProof(transferId)

      // TODO: Uncomment this when _sendCrossDomainMessage on L2_Bridge is implemented
      // const chainId: BigNumber = CHAIN_IDS.OPTIMISM.TESTNET_1
      // const amount: BigNumber = BigNumber.from(1)
      // const expectedErrorMsg: string = 'L1_BRG: Transfer Root has already been confirmed'

      // await expect(
      //   l1_bridge.connect(bonder).bondTransferRoot(tree.getRoot(), chainId, amount)
      // ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root has already been bonded', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(await bonder.getAddress(), BigNumber.from(1))

      const chainId: BigNumber = CHAIN_IDS.OPTIMISM.TESTNET_1
      const amount: BigNumber = BigNumber.from(1)
      const expectedErrorMsg: string =
        'L1_BRG: Transfer Root has already been bonded'

      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(tree.getRoot(), chainId, amount)
      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainId, amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root was already set', async () => {
      // This is not possible, as the only way to get to this code on the L1_Bridge would be to bond the same
      // mainnet transfer root twice, however this will be blocked by the bond reuse check prior to execution here
    })

    it('Should not allow a transfer root to be bonded if a mainnet transfer root amount is 0', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(await bonder.getAddress(), BigNumber.from(1))

      const chainId: BigNumber = CHAIN_IDS.ETHEREUM.MAINNET
      const amount: BigNumber = BigNumber.from(0)
      const expectedErrorMsg: string =
        'BRG: Cannot set TransferRoot amount of 0'

      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainId, amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the the messenger wrapper is not set', async () => {
      let transfer: any = transfers[0]

      // Unset messenger wrapper address
      await l1_bridge.setCrossDomainMessengerWrapper(
        CHAIN_IDS.OPTIMISM.TESTNET_1,
        ZERO_ADDRESS
      )

      // User withdraws from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(await bonder.getAddress(), BigNumber.from(1))

      const chainId: BigNumber = CHAIN_IDS.OPTIMISM.TESTNET_1
      const amount: BigNumber = BigNumber.from(1)
      const expectedErrorMsg: string = 'L1_BRG: chainId not supported'

      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainId, amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('confirmTransferRoot', async () => {
    it('Should not allow a transfer root to be confirmed by anybody except the L2_Bridge', async () => {
      let transfer: any = transfers[0]

      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      const chainId: BigNumber = CHAIN_IDS.OPTIMISM.TESTNET_1
      const amount: BigNumber = BigNumber.from(1)
      const expectedErrorMsg: string = 'TODO'

      // TODO: Uncomment this when the `onlyL2Bridge` modifier has been implemented
      // await expect(
      //   l1_bridge.connect(bonder).confirmTransferRoot(tree.getRoot(), chainId, amount)
      // ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be confirmed if it was already confirmed', async () => {
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })

    it('Should not allow a transfer root to be confirmed if the transfer root was already set', async () => {
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })

    it('Should not allow a transfer root to be confirmed if a mainnet transfer root amount is 0', async () => {
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })

    it('Should not allow a transfer root to be confirmed if the chainIds and chainAmounts do not match the values coming from the L2 bridge', async () => {
      // const expectedErrorMsg: string = 'L1_BRG: Amount hash is invalid'
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })
  })

  describe('challengeTransferRoot', async () => {
    it('Should not allow a transfer root to be challenged if the transfer root has already been confirmed', async () => {
      // const expectedErrorMsg: string = 'L1_BRG: Transfer root has already been confirmed'
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })

    it('Should not allow a transfer root to be challenged if the transfer root has already been confirmed', async () => {
      // const expectedErrorMsg: string = 'L1_BRG: Transfer root cannot be challenged after challenge period'
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })

    it('Should not allow a transfer root to be challenged if the challenger does not have enough tokens to challenge with', async () => {
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })
  })

  describe('resolveChallenge', async () => {
    it('Should not allow a transfer root challenge to be resolved if the transfer root was never challenged', async () => {
      // const expectedErrorMsg: string = 'L1_BRG: Transfer root has not been challenged'
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })

    it('Should not allow a transfer root challenge to be resolved if the transfer root challenge period is not over', async () => {
      let transfer: any = transfers[0]
      transfer.chainId = CHAIN_IDS.OPTIMISM.TESTNET_1

      // User withdraws from L1 bridge
      const tree = new MerkleTree([transfer.getTransferId()])

      // Bonder bonds transfer root
      const chainId: BigNumber = transfer.chainId
      const amount: BigNumber = transfer.amount
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(tree.getRoot(), chainId, amount)

      // Challenger challenges transfer bond
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(challenger).challengeTransferBond(tree.getRoot(), transfer.amount)

      const expectedErrorMsg: string = 'L1_BRG: Challenge period has not ended'
      await expect(
        l1_bridge.connect(challenger).resolveChallenge(tree.getRoot(), transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  // TODO: Edge cases
})
