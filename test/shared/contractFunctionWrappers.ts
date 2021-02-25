import { BigNumber, Contract, Signer } from 'ethers'
import Transfer from '../../lib/Transfer'
import { expect } from 'chai'
import { expectBalanceOf, getRootHashFromTransferId } from './utils'

import {
  CHAIN_IDS,
  TIMESTAMP_VARIANCE,
  DEFAULT_AMOUNT_OUT_MIN,
  DEFAULT_DEADLINE,
  DEAD_ADDRESS
} from '../../config/constants'

/**
 * Canonical Bridge
 */

export const executeCanonicalBridgeSendMessage = async (
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

/**
 * L1 Bridge
 */

export const executeL1BridgeSendToL2 = async (
  l1_canonicalToken: Contract,
  l1_bridge: Contract,
  l2_bridge: Contract,
  l2_messenger: Contract,
  sender: Signer,
  amount: BigNumber,
  l2ChainId: BigNumber
) => {
  // Get state before transaction
  const accountBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(await sender.getAddress())

  // Perform transaction
  await l1_canonicalToken.connect(sender).approve(l1_bridge.address, amount)
  await l1_bridge
    .connect(sender)
    .sendToL2(l2ChainId, await sender.getAddress(), amount)
  await l2_messenger.relayNextMessage()

  // Validate state after transaction
  await expectBalanceOf(
    l1_canonicalToken,
    sender,
    accountBalanceBefore.sub(amount)
  )
  await expectBalanceOf(l2_bridge, sender, amount)
}

export const executeL1BridgeSendToL2AndAttemptToSwap = async (
  l1_canonicalToken: Contract,
  l1_bridge: Contract,
  l2_bridge: Contract,
  l2_messenger: Contract,
  l2_canonicalToken: Contract,
  l2_uniswapRouter: Contract,
  transfer: Transfer,
  l2ChainId: BigNumber
) => {
  const sender: Signer = transfer.sender
  const recipient: Signer = transfer.recipient
  const amount: BigNumber = transfer.amount
  const amountOutMin: BigNumber = transfer.amountOutMin
  const deadline: BigNumber = transfer.deadline

  // Get state before transaction
  const expectedAmounts: BigNumber[] = await l2_uniswapRouter.getAmountsOut(
    transfer.amount,
    [l2_canonicalToken.address, l2_bridge.address]
  )

  const expectedAmountAfterSlippage: BigNumber = expectedAmounts[1]
  const senderBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(await sender.getAddress())

  // Perform transaction
  await l1_canonicalToken
    .connect(sender)
    .approve(l1_bridge.address, amount)
  await l1_bridge
    .connect(sender)
    .sendToL2AndAttemptSwap(
      l2ChainId.toString(),
      await recipient.getAddress(),
      amount,
      amountOutMin,
      deadline
    )
  await l2_messenger.relayNextMessage()

  // Validate state after transaction
  await expectBalanceOf(l1_canonicalToken, sender, senderBalanceBefore.sub(amount))

  // The recipient will either have the canonical token or the bridge token
  try {
    await expectBalanceOf(l2_canonicalToken, recipient, expectedAmountAfterSlippage)
    await expectBalanceOf(l2_bridge, recipient, 0)
  } catch {
    await expectBalanceOf(l2_canonicalToken, recipient, 0)
    await expectBalanceOf(l2_bridge, recipient, amount)
  }
}

export const executeL1BridgeBondWithdrawal = async (
  l1_canonicalToken: Contract,
  l1_bridge: Contract,
  transfer: Transfer,
  bonder: Signer
) => {
  // Get state before transaction
  const senderBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(await transfer.sender.getAddress())
  const bonderBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(await bonder.getAddress())

  // Perform transaction
  await l1_bridge
    .connect(bonder)
    .bondWithdrawal(
      await transfer.sender.getAddress(),
      await transfer.recipient.getAddress(),
      transfer.amount,
      transfer.transferNonce,
      transfer.relayerFee
    )

  // Validate state after transaction
  let senderL1CanonicalTokenBalance: BigNumber
  let recipientL1CanonicalTokenBalance: BigNumber
  if(transfer.sender === transfer.recipient) {
    senderL1CanonicalTokenBalance = senderBalanceBefore.add(transfer.amount).sub(transfer.relayerFee)
    recipientL1CanonicalTokenBalance = senderL1CanonicalTokenBalance
  } else {
    senderL1CanonicalTokenBalance = senderBalanceBefore
    recipientL1CanonicalTokenBalance = transfer.amount.sub(transfer.relayerFee)
  }
  await expectBalanceOf(
    l1_canonicalToken,
    transfer.sender,
    senderL1CanonicalTokenBalance
  )

  // Validate state after transaction
  await expectBalanceOf(
    l1_canonicalToken,
    transfer.recipient,
    recipientL1CanonicalTokenBalance
  )

  await expectBalanceOf(
    l1_canonicalToken,
    bonder,
    bonderBalanceBefore.add(transfer.relayerFee)
  )
}

export const executeL1BridgeBondTransferRoot = async (
  l1_bridge: Contract,
  transfer: Transfer,
  bonder: Signer
) => {
  const transferId: Buffer = await transfer.getTransferId()
  const { rootHash } = getRootHashFromTransferId(transferId)

  // Perform transaction
  await l1_bridge
    .connect(bonder)
    .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

  // Validate state after transaction
  const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
  const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
  const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
  const transferBond: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
  const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)

  expect(timeSlotToAmountBonded).to.eq(bondAmount)
  expect(transferBond).to.eq(bondAmount)
  if (transfer.chainId === CHAIN_IDS.ETHEREUM.MAINNET) {
    expect(transferRoot[0]).to.eq(transfer.amount)
    expect(transferRoot[1]).to.eq(BigNumber.from('0'))
  }
}

export const executeL1BridgeSettleBondedWithdrawals = async (
  l1_bridge: Contract,
  transfer: Transfer,
  bonder: Signer
) => {
  const transferId: Buffer = await transfer.getTransferId()
  const { rootHash } = getRootHashFromTransferId(transferId)

  // Get state before transaction
  const bondedAmountBefore: BigNumber = await l1_bridge.getCredit(await bonder.getAddress())

  // Perform transaction
  await l1_bridge
    .connect(bonder)
    .settleBondedWithdrawals(await bonder.getAddress(), [ transferId ], transfer.amount)

  // Validate state after transaction
  const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
  const credit = await l1_bridge.getCredit(await bonder.getAddress())
  const expectedCredit: BigNumber = bondedAmountBefore.add(transfer.amount)
  expect(transferRoot[0]).to.eq(transfer.amount)
  expect(transferRoot[1]).to.eq(transfer.amount)
  expect(credit).to.eq(expectedCredit)
}

export const executeL1BridgeChallengeTransferBond = async (
  l1_canonicalToken: Contract,
  l1_bridge: Contract,
  amount: BigNumber,
  bonder: Signer,
  challenger: Signer,
  transferId: Buffer
) => {
  const { rootHash } = getRootHashFromTransferId(transferId)
  const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(amount)
  const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, amount)

  // Get state before transaction
  const challengerBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(await challenger.getAddress())
  const debitBefore: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
  const bridgeBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(l1_bridge.address)

  // Perform transaction
  await l1_canonicalToken
    .connect(challenger)
    .approve(l1_bridge.address, challengeAmount)
  await l1_bridge.connect(challenger).challengeTransferBond(rootHash, amount)

  // Validate state after transaction
  await expectBalanceOf(
    l1_canonicalToken,
    challenger,
    challengerBalanceBefore.sub(challengeAmount)
  )

  const transferBond = await l1_bridge.transferBonds(transferRootId)
  expect(transferBond[3].mul(1000).toNumber()).to.be.closeTo(
    Date.now(),
    TIMESTAMP_VARIANCE
  )
  expect(transferBond[4]).to.eq(await challenger.getAddress())
  expect(transferBond[5]).to.eq(false)

  const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
  const bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
  expect(bondAmountForTimeSlot).to.eq(BigNumber.from('0'))

  expectBalanceOf(l1_canonicalToken, l1_bridge, bridgeBalanceBefore.add(challengeAmount))

  // This will be the same, as the debit has already been counted
  const debitAfter: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
  expect(debitBefore).to.eq(debitAfter)
}

export const executeL1BridgeResolveChallenge = async (
  l1_canonicalToken: Contract,
  l1_bridge: Contract,
  amount: BigNumber,
  bonder: Signer,
  challenger: Signer,
  transferId: Buffer,
  shouldResolveSuccessfully: boolean
) => {
  const { rootHash } = getRootHashFromTransferId(transferId)
  const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(amount)
  const bondAmount: BigNumber = await l1_bridge.getBondForTransferAmount(amount)
  const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, amount)

  // Get state before transaction
  const creditBefore: BigNumber = await l1_bridge.getCredit(await bonder.getAddress())
  const challengerBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(await challenger.getAddress())

  // Perform transaction
  await l1_bridge.resolveChallenge(rootHash, amount)

  // Validate state after transaction
  const transferBond: number = await l1_bridge.transferBonds(transferRootId)
  const creditAfter: BigNumber = await l1_bridge.getCredit(await bonder.getAddress())

  if (!shouldResolveSuccessfully) {
    expect(transferBond[5]).to.eq(true)
    expect(creditAfter).to.eq(creditBefore.add(bondAmount).add(challengeAmount))
  } else {
    expect(transferBond[5]).to.eq(true)

    // Credit should not have changed
    expect(creditAfter).to.eq(creditBefore)

    // DEAD address should have tokens
    const balanceAfter: BigNumber = await l1_canonicalToken.balanceOf(DEAD_ADDRESS)
    expect(balanceAfter.toString()).to.eq(BigNumber.from(challengeAmount).div(4).toString())

    // Challenger should have tokens
    // NOTE: the challenge amount is subtracted to mimic the amount sent to the contract during the challenge
    const expectedChallengerTokenAmount: BigNumber = challengerBalanceBefore.add(challengeAmount.mul(7).div(4))
    await expectBalanceOf(l1_canonicalToken, challenger, expectedChallengerTokenAmount)
  }
}

/**
 * L2 Bridge
 */

export const executeL2BridgeSend = async (
  l2_bridge: Contract,
  transfer: Transfer
) => {
  // Get state before transaction
  const bridgeTotalSupplyBefore: BigNumber = await l2_bridge.totalSupply()
  const senderBalanceBefore: BigNumber = await l2_bridge.balanceOf(await transfer.sender.getAddress())

  // Perform transaction
  await l2_bridge
    .connect(transfer.sender)
    .send(
      transfer.chainId,
      await transfer.recipient.getAddress(),
      transfer.amount,
      transfer.transferNonce,
      transfer.relayerFee,
      transfer.amountOutMin,
      transfer.deadline
    )

  // Validate state after transaction
  const bridgeTotalSupplyAfter: BigNumber = await l2_bridge.totalSupply()
  expect(bridgeTotalSupplyAfter).to.eq(bridgeTotalSupplyBefore.sub(transfer.amount))
  await expectBalanceOf(
    l2_bridge,
    transfer.sender,
    senderBalanceBefore.sub(transfer.amount)
  )
}

export const executeL2BridgeCommitTransfers = async (
  l2_bridge: Contract,
  transfer: Transfer,
  bonder: Signer
) => {
  // Get state before transaction
  const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(BigNumber.from('0'))
  const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
  const expectedPendingTransferIdsForChainId: string = await transfer.getTransferIdHex()
  expect(pendingAmountChainId).to.eq(transfer.chainId)
  expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

  // Perform transaction
  await l2_bridge
    .connect(bonder)
    .commitTransfers(transfer.chainId)

  // Validate state after transaction
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
}

export const executeL2BridgeBondWithdrawalAndAttemptSwap = async (
  l2_bridge: Contract,
  transfer: Transfer,
  bonder: Signer,
) => {
  // Get state before transaction
  const bonderBalanceBefore: BigNumber = await l2_bridge.balanceOf(await bonder.getAddress())

  // Perform transaction
  await l2_bridge
    .connect(bonder)
    .bondWithdrawalAndAttemptSwap(
      await transfer.sender.getAddress(),
      await transfer.recipient.getAddress(),
      transfer.amount,
      transfer.transferNonce,
      transfer.relayerFee,
      transfer.amountOutMin,
      transfer.deadline
    )


  // Validate state after transaction
  await expectBalanceOf(
    l2_bridge,
    transfer.recipient,
    transfer.amount.sub(transfer.relayerFee)
  )
  await expectBalanceOf(
    l2_bridge,
    bonder,
    bonderBalanceBefore.add(transfer.relayerFee)
  )
}
