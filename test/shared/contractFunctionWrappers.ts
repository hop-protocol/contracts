import { BigNumber, Contract, Signer } from 'ethers'
import Transfer from '../../lib/Transfer'
import MerkleTree from '../../lib/MerkleTree'
import { expect } from 'chai'
import { expectBalanceOf, getRootHashFromTransferId, getTransferNonceFromEvent } from './utils'

import {
  CHAIN_IDS,
  TIMESTAMP_VARIANCE,
  DEFAULT_AMOUNT_OUT_MIN,
  DEFAULT_DEADLINE,
  DEAD_ADDRESS,
  DEFAULT_BONDER_FEE
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
  l2_hopBridgeToken: Contract,
  l2_messenger: Contract,
  sender: Signer,
  amount: BigNumber,
  relayerFee: BigNumber,
  l2ChainId: BigNumber
) => {
  // Get state before transaction
  const accountBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(await sender.getAddress())

  // Perform transaction
  await l1_canonicalToken.connect(sender).approve(l1_bridge.address, amount)
  await l1_bridge
    .connect(sender)
    .sendToL2(l2ChainId, await sender.getAddress(), amount, relayerFee)
  await l2_messenger.relayNextMessage()

  // Validate state after transaction
  await expectBalanceOf(
    l1_canonicalToken,
    sender,
    accountBalanceBefore.sub(amount)
  )
  await expectBalanceOf(l2_hopBridgeToken, sender, amount)
}

export const executeL1BridgeSendToL2AndAttemptToSwap = async (
  l1_canonicalToken: Contract,
  l1_bridge: Contract,
  l2_hopBridgeToken: Contract,
  l2_messenger: Contract,
  l2_canonicalToken: Contract,
  l2_uniswapRouter: Contract,
  transfer: Transfer,
  relayerFee: BigNumber,
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
    [l2_canonicalToken.address, l2_hopBridgeToken.address]
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
      deadline,
      relayerFee
    )
  await l2_messenger.relayNextMessage()

  // Validate state after transaction
  await expectBalanceOf(l1_canonicalToken, sender, senderBalanceBefore.sub(amount))

  // The recipient will either have the canonical token or the bridge token
  try {
    await expectBalanceOf(l2_canonicalToken, recipient, expectedAmountAfterSlippage)
    await expectBalanceOf(l2_hopBridgeToken, recipient, 0)
  } catch {
    await expectBalanceOf(l2_canonicalToken, recipient, 0)
    await expectBalanceOf(l2_hopBridgeToken, recipient, amount)
  }
}

export const executeL1BridgeBondWithdrawal = async (
  l1_canonicalToken: Contract,
  l1_bridge: Contract,
  l2_bridge: Contract,
  transfer: Transfer,
  bonder: Signer
) => {
  // Get state before transaction
  const transferNonce = await getTransferNonceFromEvent(l2_bridge)
  const senderBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(await transfer.sender.getAddress())
  const bonderBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(await bonder.getAddress())

  // Perform transaction
  await l1_bridge
    .connect(bonder)
    .bondWithdrawal(
      await transfer.recipient.getAddress(),
      transfer.amount,
      transferNonce,
      transfer.bonderFee
    )

  // Validate state after transaction
  let senderL1CanonicalTokenBalance: BigNumber
  let recipientL1CanonicalTokenBalance: BigNumber
  if(transfer.sender === transfer.recipient) {
    senderL1CanonicalTokenBalance = senderBalanceBefore.add(transfer.amount).sub(transfer.bonderFee)
    recipientL1CanonicalTokenBalance = senderL1CanonicalTokenBalance
  } else {
    senderL1CanonicalTokenBalance = senderBalanceBefore
    recipientL1CanonicalTokenBalance = transfer.amount.sub(transfer.bonderFee)
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
    bonderBalanceBefore.add(transfer.bonderFee)
  )
}

export const executeL1BridgeBondTransferRoot = async (
  l1_bridge: Contract,
  l2_bridge: Contract,
  transfer: Transfer,
  bonder: Signer,
  timeIncrease: number 
) => {
  const transferNonce = await getTransferNonceFromEvent(l2_bridge)
  const transferId: Buffer = await transfer.getTransferId(transferNonce)
  const { rootHash } = getRootHashFromTransferId(transferId)

  // Perform transaction
  await l1_bridge
    .connect(bonder)
    .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

  // Validate state after transaction
  const currentTime: number = Math.floor(Date.now() / 1000)
  const timeSlot: number = await l1_bridge.getTimeSlot(currentTime + timeIncrease)
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
  l2_bridge: Contract,
  transfer: Transfer,
  bonder: Signer
) => {
  const transferNonce = await getTransferNonceFromEvent(l2_bridge)
  const transferId: Buffer = await transfer.getTransferId(transferNonce)
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
  l2_bridge: Contract,
  amount: BigNumber,
  bonder: Signer,
  challenger: Signer,
  transfer: Transfer
) => {
  const transferNonce = await getTransferNonceFromEvent(l2_bridge)
  const transferId: Buffer = await transfer.getTransferId(transferNonce)
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
  expect(transferBond[3]).to.be.eq(BigNumber.from('0'))
  const currentTime: number = Math.floor(Date.now() / 1000)
  expect(transferBond[4].toNumber()).to.be.closeTo(
    currentTime,
    TIMESTAMP_VARIANCE
  )
  expect(transferBond[5]).to.eq(await challenger.getAddress())
  expect(transferBond[6]).to.eq(false)

  const timeSlot: string = await l1_bridge.getTimeSlot(currentTime)
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
  l2_bridge: Contract,
  amount: BigNumber,
  bonder: Signer,
  challenger: Signer,
  transfer: Transfer,
  shouldResolveSuccessfully: boolean,
  didBonderWaitMinTransferRootTime: boolean = true
) => {
  const transferNonce = await getTransferNonceFromEvent(l2_bridge)
  const transferId: Buffer = await transfer.getTransferId(transferNonce)
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
    expect(transferBond[6]).to.eq(true)
    let expectedCredit: BigNumber = creditBefore.add(bondAmount)
    if (didBonderWaitMinTransferRootTime) {
      expectedCredit = expectedCredit.add(challengeAmount)
    }
    expect(creditAfter).to.eq(expectedCredit)
  } else {
    expect(transferBond[6]).to.eq(true)

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
  l2_hopBridgeToken: Contract,
  l2_bridge: Contract,
  transfer: Transfer,
  expectedTransferIndex: BigNumber = BigNumber.from('0')
) => {
  // Get state before transaction
  const bridgeTotalSupplyBefore: BigNumber = await l2_hopBridgeToken.totalSupply()
  const senderBalanceBefore: BigNumber = await l2_hopBridgeToken.balanceOf(await transfer.sender.getAddress())
  const pendingAmountBefore: BigNumber = await l2_bridge.pendingAmountForChainId(
    transfer.chainId
  )

  // Perform transaction
  await l2_bridge
    .connect(transfer.sender)
    .send(
      transfer.chainId,
      await transfer.recipient.getAddress(),
      transfer.amount,
      transfer.bonderFee,
      transfer.amountOutMin,
      transfer.deadline
    )

  // Perform transaction
  // Validate state after transaction
  const bridgeTotalSupplyAfter: BigNumber = await l2_hopBridgeToken.totalSupply()
  expect(bridgeTotalSupplyAfter).to.eq(bridgeTotalSupplyBefore.sub(transfer.amount))
  await expectBalanceOf(
    l2_hopBridgeToken,
    transfer.sender,
    senderBalanceBefore.sub(transfer.amount)
  )

  // Verify state
  const transferNonce = await getTransferNonceFromEvent(l2_bridge, expectedTransferIndex)
  const expectedPendingTransferHash: Buffer = await transfer.getTransferId(transferNonce)

  const pendingAmount: BigNumber = await l2_bridge.pendingAmountForChainId(
    transfer.chainId
  )
  const expectedPendingAmount: BigNumber = pendingAmountBefore.add(transfer.amount)
  expect(pendingAmount).to.eq(expectedPendingAmount)

  const transfersSentEvent = (
    await l2_bridge.queryFilter(l2_bridge.filters.TransferSent())
  )[expectedTransferIndex.toNumber()]
  const transferSentArgs = transfersSentEvent.args
  expect(transferSentArgs[0]).to.eq(
    '0x' + expectedPendingTransferHash.toString('hex')
  )
  expect(transferSentArgs[1]).to.eq(await transfer.recipient.getAddress())
  expect(transferSentArgs[2]).to.eq(transfer.amount)
  expect(transferSentArgs[3]).to.eq(transferNonce)
  expect(transferSentArgs[4]).to.eq(transfer.bonderFee)
}

export const executeL2BridgeSwapAndSend = async (
  l2_bridge: Contract,
  l2_canonicalToken: Contract,
  l2_hopBridgeToken: Contract,
  l2_uniswapRouter: Contract,
  transfer: Transfer
) => {
  // Get state before transaction
  const senderBalanceBefore: BigNumber = await l2_canonicalToken.balanceOf(await transfer.sender.getAddress())
  const expectedAmounts: BigNumber[] = await l2_uniswapRouter.getAmountsOut(
    transfer.amount,
    [l2_canonicalToken.address, l2_hopBridgeToken.address]
  )
  const expectedAmountAfterSlippage: BigNumber = expectedAmounts[1]

  // Perform transaction
  await l2_canonicalToken
    .connect(transfer.sender)
    .approve(l2_bridge.address, transfer.amount)
  await l2_bridge
    .connect(transfer.sender)
    .swapAndSend(
      transfer.chainId,
      await transfer.recipient.getAddress(),
      transfer.amount,
      transfer.bonderFee,
      transfer.amountOutMin,
      transfer.deadline,
      transfer.destinationAmountOutMin,
      transfer.destinationDeadline
    )

  // Validate state after transaction
  await expectBalanceOf(
    l2_canonicalToken,
    transfer.sender,
    senderBalanceBefore.sub(transfer.amount)
  )

  const transferNonce = await getTransferNonceFromEvent(l2_bridge)
  const transferAfterSlippage: Transfer = Object.assign(transfer, {
    amount: expectedAmountAfterSlippage
  })
  const expectedPendingTransferHash: Buffer = await transferAfterSlippage.getTransferId(transferNonce)

  const pendingAmount = await l2_bridge.pendingAmountForChainId(
    transfer.chainId
  )
  const expectedPendingAmount = transfer.amount
  expect(pendingAmount).to.eq(expectedPendingAmount)

  const transfersSentEvent = (
    await l2_bridge.queryFilter(l2_bridge.filters.TransferSent())
  )[0]
  const transferSentArgs = transfersSentEvent.args
  expect(transferSentArgs[0]).to.eq(
    '0x' + expectedPendingTransferHash.toString('hex')
  )
  expect(transferSentArgs[1]).to.eq(await transfer.recipient.getAddress())
  expect(transferSentArgs[2]).to.eq(transferAfterSlippage.amount)
  expect(transferSentArgs[3]).to.eq(transferNonce)
  expect(transferSentArgs[4]).to.eq(transfer.bonderFee)
}

export const executeL2BridgeCommitTransfers = async (
  l2_bridge: Contract,
  transfer: Transfer,
  bonder: Signer,
  expectedTransferIndex: BigNumber = BigNumber.from('0')
) => {
  // Get state before transaction
  const transferNonce = await getTransferNonceFromEvent(l2_bridge, expectedTransferIndex)
  const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
  const expectedPendingTransferIdsForChainId: string = await transfer.getTransferIdHex(transferNonce)
  expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)
  let pendingAmountForChainId = await l2_bridge.pendingAmountForChainId(
    transfer.chainId
  )
  expect(pendingAmountForChainId).to.eq(transfer.amount)

  // Perform transaction
  await l2_bridge
    .connect(bonder)
    .commitTransfers(transfer.chainId)

  // Validate state after transaction
  const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
  const currentTime: number = Math.floor(Date.now() / 1000)
  expect(lastCommitTimeForChainId.toNumber()).to.be.closeTo(
    currentTime,
    TIMESTAMP_VARIANCE
  )
  const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
  try {
    await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
    throw new Error('There should not be a pending transfer ID for chainId in this slot.')
  } catch (err) {
    expect(err.message).to.eq(expectedErrorMsg)
  }

  // Verify state post-transaction
  pendingAmountForChainId = await l2_bridge.pendingAmountForChainId(
    transfer.chainId
  )
  expect(pendingAmountForChainId).to.eq(transfer.amount)

  const expectedMerkleTree = new MerkleTree([await transfer.getTransferId(transferNonce)])

  const transfersCommittedEvent = (
    await l2_bridge.queryFilter(l2_bridge.filters.TransfersCommitted())
  )[expectedTransferIndex.toNumber()]
  const transfersCommittedArgs = transfersCommittedEvent.args
  expect(transfersCommittedArgs[0]).to.eq(expectedMerkleTree.getHexRoot())
  const pendingChainAmounts = transfersCommittedArgs[1]
  expect(pendingChainAmounts).to.eq(transfer.amount)
}

export const executeL2BridgeWithdrawAndAttemptSwap = async (
  l2_bridgeOrigin: Contract,
  l2_hopBridgeToken: Contract,
  l2_bridge: Contract,
  l2_canonicalToken: Contract,
  l2_uniswapRouter: Contract,
  transfer: Transfer,
  bonder: Signer,
  actualTransferAmount: BigNumber
) => {
  // TODO
}

export const executeL2BridgeBondWithdrawalAndAttemptSwap = async (
  l2_bridgeOrigin: Contract,
  l2_hopBridgeToken: Contract,
  l2_bridge: Contract,
  l2_canonicalToken: Contract,
  l2_uniswapRouter: Contract,
  transfer: Transfer,
  bonder: Signer,
  actualTransferAmount: BigNumber,
  expectedTransferIndex: BigNumber = BigNumber.from('0')
) => {
  // Get state before transaction
  const transferNonce = await getTransferNonceFromEvent(l2_bridgeOrigin, expectedTransferIndex)
  const bonderBalanceBefore: BigNumber = await l2_hopBridgeToken.balanceOf(await bonder.getAddress())

  const expectedAmountsRecipientBridge: BigNumber[] = await l2_uniswapRouter.getAmountsOut(
    actualTransferAmount.sub(transfer.bonderFee),
    [l2_canonicalToken.address, l2_hopBridgeToken.address]
  )
  const expectedRecipientAmountAfterSlippage: BigNumber = expectedAmountsRecipientBridge[1]

  // Perform transaction
  await l2_bridge
    .connect(bonder)
    .bondWithdrawalAndAttemptSwap(
      await transfer.recipient.getAddress(),
      transfer.amount,
      transferNonce,
      transfer.bonderFee,
      transfer.amountOutMin,
      transfer.deadline
    )


  // Validate state after transaction
  await expectBalanceOf(
    l2_hopBridgeToken,
    transfer.recipient,
    0
  )
  await expectBalanceOf(
    l2_hopBridgeToken,
    bonder,
    bonderBalanceBefore.add(transfer.bonderFee)
  )
  await expectBalanceOf(
    l2_canonicalToken,
    transfer.recipient,
    expectedRecipientAmountAfterSlippage
  )
}
