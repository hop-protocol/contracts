import {
  BigNumber,
  Contract,
  Signer,
  providers,
  utils as ethersUtils
} from 'ethers'
import Transfer from '../../lib/Transfer'
import { MerkleTree } from 'merkletreejs'
import { expect } from 'chai'
import {
  expectBalanceOf,
  getRootHashFromTransferId,
  getTransferNonceFromEvent,
  getNewMerkleTree,
  didAttemptedSwapSucceed
} from './utils'
import {
  isChainIdOptimism,
  isChainIdArbitrum,
  isChainIdXDai,
  isChainIdPolygon,
  isChainIdL1
} from '../../config/utils'
import {
  CHAIN_IDS,
  TIMESTAMP_VARIANCE,
  DEAD_ADDRESS,
  H_TO_C_SWAP_INDICES,
  C_TO_H_SWAP_INDICES,
  ZERO_ADDRESS
} from '../../config/constants'

/**
 * Canonical Bridge
 */

export const executeCanonicalBridgeSendTokens = async (
  l1_canonicalToken: Contract,
  l1_canonicalBridge: Contract,
  l2_canonicalToken: Contract,
  l2_messenger: Contract,
  account: Signer,
  amount: BigNumber,
  l2ChainId: BigNumber
) => {
  await l1_canonicalToken
    .connect(account)
    .approve(l1_canonicalBridge.address, amount)

  const isPolygon: boolean = isChainIdPolygon(l2ChainId)
  await l1_canonicalBridge
    .connect(account)
    .sendTokens(l2_canonicalToken.address, await account.getAddress(), amount, isPolygon)
  await l2_messenger.relayNextMessage()
  await expectBalanceOf(l2_canonicalToken, account, amount)
}

export const executeCanonicalMessengerSendMessage = async (
  l1_messenger: Contract,
  l1_messengerWrapper: Contract,
  l2_bridgeConnector: Contract,
  l2_messenger: Contract | string,
  sender: Signer,
  message: string,
  l2ChainId: BigNumber,
  modifiedGasPrice: { [key: string]: BigNumber } | undefined = undefined
) => {
  let tx: providers.TransactionResponse
  const gasLimit: BigNumber = BigNumber.from('1500000')
  const params: any[] = [l2_bridgeConnector.address, message, gasLimit]
  modifiedGasPrice = modifiedGasPrice || {}

  if (isChainIdArbitrum(l2ChainId)) {
    const amount: BigNumber = BigNumber.from('0')
    const maxSubmissionCost: BigNumber = BigNumber.from('0')
    const maxGas: BigNumber = BigNumber.from('100000000000')
    const gasPriceBid: BigNumber = BigNumber.from('0')
    const arbitrumParams: any[] = [
      l2_bridgeConnector.address,
      amount,
      maxSubmissionCost,
      await sender.getAddress(),
      await sender.getAddress(),
      maxGas,
      gasPriceBid,
      message
    ]

    tx = await l1_messenger
      .connect(sender)
      .createRetryableTicket(...arbitrumParams, modifiedGasPrice);
  } else if (isChainIdOptimism(l2ChainId)) {
    const optimismGasLimit: BigNumber = BigNumber.from('5000000')
    const optimismParams: any[] = [l2_bridgeConnector.address, message, optimismGasLimit]
    tx = await l1_messenger.connect(sender).sendMessage(...optimismParams, modifiedGasPrice)
  } else if (isChainIdXDai(l2ChainId)) {
    tx = await l1_messenger.connect(sender).requireToPassMessage(...params, modifiedGasPrice)
  } else if (isChainIdPolygon(l2ChainId)) {
    tx = await l1_messengerWrapper.connect(sender).sendCrossDomainMessage(message, modifiedGasPrice)
  } else {
    tx = await l1_messenger.connect(sender).sendMessage(...params, modifiedGasPrice)
  }

  // Prod deployments should pass in ZERO_ADDRESS for the l2_messenger param
  if (typeof l2_messenger === 'object') {
    await l2_messenger.relayNextMessage()
  }

  return tx
}

/**
 * L1 Bridge
 */

export const executeL1BridgeSendToL2 = async (
  l1_canonicalToken: Contract,
  l1_bridge: Contract,
  l2_hopBridgeToken: Contract,
  l2_canonicalToken: Contract,
  l2_messenger: Contract,
  l2_swap: Contract,
  sender: Signer,
  recipient: Signer,
  relayer: Signer,
  amount: BigNumber,
  amountOutMin: BigNumber,
  deadline: BigNumber,
  relayerFee: BigNumber,
  l2ChainId: BigNumber,
  transfer: Transfer | null = null
) => {
  // Get state before transaction
  // The test suite setup might not have defined the Amm Router yet
  let expectedAmountAfterSlippage: BigNumber
  if (!amountOutMin.eq(0) || !deadline.eq(0)) {
    expectedAmountAfterSlippage = await l2_swap.calculateSwap(...H_TO_C_SWAP_INDICES, amount.sub(relayerFee))
  }

  const senderL1CanonicalTokenBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(
    await sender.getAddress()
  )
  const recipientL2CanonicalTokenBalanceBefore: BigNumber = await l2_canonicalToken.balanceOf(
    await recipient.getAddress()
  )
  const recipientL2HopBridgeTokenBalanceBefore: BigNumber = await l2_hopBridgeToken.balanceOf(
    await recipient.getAddress()
  )
  const relayerL2HopBridgeTokenBalanceBefore: BigNumber = await l2_hopBridgeToken.balanceOf(
    await relayer.getAddress()
  )

  // Perform transaction
  await l1_canonicalToken.connect(sender).approve(l1_bridge.address, amount)
  await l1_bridge
    .connect(sender)
    .sendToL2(
      l2ChainId,
      await recipient.getAddress(),
      amount,
      [
        '1',
        amountOutMin,
        deadline
      ],
      await relayer.getAddress(),
      relayerFee
    )
  await l2_messenger.connect(relayer).relayNextMessage()

  // Validate state after transaction
  const isRelayerRecipient: boolean = recipient === relayer
  const didSwap: boolean = !amountOutMin.eq(0) || !deadline.eq(0)
  const didSwapSucceed: boolean = await didAttemptedSwapSucceed(l2_canonicalToken, recipient, recipientL2CanonicalTokenBalanceBefore)

  // Verify sender balance
  await expectBalanceOf(
    l1_canonicalToken,
    sender,
    senderL1CanonicalTokenBalanceBefore.sub(amount)
  )

  // Verify recipient and relayer balances
  if (!didSwap || !didSwapSucceed) {
    // The recipient will always have the same canonical token balance if a swap does not occur
    await expectBalanceOf(
      l2_canonicalToken,
      recipient,
      recipientL2CanonicalTokenBalanceBefore
    )

    if (isRelayerRecipient) {
      // Validate that the values are the same and then only validate balances against one account
      expect(recipient).to.eq(relayer)
      expect(recipientL2HopBridgeTokenBalanceBefore).to.eq(relayerL2HopBridgeTokenBalanceBefore)

      await expectBalanceOf(
        l2_hopBridgeToken,
        recipient,
        recipientL2HopBridgeTokenBalanceBefore.add(amount)
      )
    } else if (!isRelayerRecipient) {
      await expectBalanceOf(
        l2_hopBridgeToken,
        recipient,
        recipientL2HopBridgeTokenBalanceBefore.add(amount).sub(relayerFee)
      )
      await expectBalanceOf(
        l2_hopBridgeToken,
        relayer,
        relayerL2HopBridgeTokenBalanceBefore.add(relayerFee)
      )
    }
  } else if (didSwap) {
    // The recipient will always receive canonical tokens in a successful swap
    await expectBalanceOf(
      l2_canonicalToken,
      recipient,
      recipientL2CanonicalTokenBalanceBefore.add(expectedAmountAfterSlippage)
    )

    if (isRelayerRecipient) {
      // Validate that the values are the same and then only validate balances against one account
      expect(recipient).to.eq(relayer)
      expect(recipientL2HopBridgeTokenBalanceBefore).to.eq(relayerL2HopBridgeTokenBalanceBefore)

      await expectBalanceOf(
        l2_hopBridgeToken,
        recipient,
        recipientL2HopBridgeTokenBalanceBefore.add(relayerFee)
      )
    } else if (!isRelayerRecipient) {
      await expectBalanceOf(
        l2_hopBridgeToken,
        recipient,
        recipientL2HopBridgeTokenBalanceBefore
      )

      await expectBalanceOf(
        l2_hopBridgeToken,
        relayer,
        relayerL2HopBridgeTokenBalanceBefore.add(relayerFee)
      )
    }

    // Record the swap value if the swap did successfully occur
    if (transfer) {
      transfer.amountAfterSwap = expectedAmountAfterSlippage
    }
  }
}

export const executeBridgeWithdraw = async (
  destinationCanonicalToken: Contract,
  destinationBridge: Contract,
  sourceBridge: Contract,
  transfer: Transfer,
  bonder: Signer,
  isSwapAndSend: boolean = false,
  destinationHopToken: Contract = null
) => {
  const transferNonce: string = await getTransferNonceFromEvent(sourceBridge)
  const transferId: Buffer = await transfer.getTransferId(transferNonce, isSwapAndSend)
  const tree: MerkleTree = getNewMerkleTree([transferId])
  const transferRootHash: Buffer = tree.getRoot()
  const proof: Buffer[] = tree.getProof(transferId)
  const transferIdTreeIndex = 0
  const totalLeaves = 1

  const { rootHash } = getRootHashFromTransferId(transferId)

  // Get state before transaction
  const recipientCanonicalTokenBalanceBefore: BigNumber = await destinationCanonicalToken.balanceOf(
    await transfer.recipient.getAddress()
  )
  const bonderBalanceBefore: BigNumber = await destinationCanonicalToken.balanceOf(
    await bonder.getAddress()
  )
  let recipientHopTokenBalanceBefore: BigNumber
  if (!isChainIdL1(transfer.chainId)) {
    recipientHopTokenBalanceBefore = await destinationCanonicalToken.balanceOf(
      await bonder.getAddress()
    )
  }
  const transferRootAmountWithdrawnBefore: BigNumber = (
    await destinationBridge.getTransferRoot(rootHash, transfer.amount)
  )[1]
  let isTransferIdSpent: boolean = await destinationBridge.isTransferIdSpent(
    transferId
  )
  expect(isTransferIdSpent).to.eq(false)

  const tokenIndex: BigNumber = isSwapAndSend ? transfer.destinationTokenIndex : transfer.tokenIndex
  const deadline: BigNumber = isSwapAndSend ? transfer.destinationDeadline : transfer.deadline
  const amountOutMin: BigNumber = isSwapAndSend ? transfer.destinationAmountOutMin : transfer.destinationDeadline
  // Perform transaction
  await destinationBridge
    .connect(bonder)
    .withdraw(
      await transfer.recipient.getAddress(),
      transfer.amount,
      transferNonce,
      transfer.bonderFee,
      [
        tokenIndex,
        amountOutMin,
        deadline
      ],
      transferRootHash,
      transfer.amount,
      transferIdTreeIndex,
      proof,
      totalLeaves
    )

  // Validate state after transaction
  const transferRootAmountWithdrawnAfter: BigNumber = (
    await destinationBridge.getTransferRoot(rootHash, transfer.amount)
  )[1]

  // NOTE: Unbonded withdrawals do not pay the bonder
  const isSwap = !(transfer.destinationAmountOutMin.eq(0) && transfer.destinationDeadline.eq(0))
  const isDestinationL1 = isChainIdL1(transfer.chainId)
  if (isSwap || isDestinationL1) {
    await expectBalanceOf(
      destinationCanonicalToken,
      transfer.recipient,
      recipientCanonicalTokenBalanceBefore.add(transfer.amount)
    )
  } else {
    await expectBalanceOf(
      destinationHopToken,
      transfer.recipient,
      recipientHopTokenBalanceBefore.add(transfer.amount)
    )
  }

  await expectBalanceOf(destinationCanonicalToken, bonder, bonderBalanceBefore)

  expect(transferRootAmountWithdrawnAfter).to.eq(
    transferRootAmountWithdrawnBefore.add(transfer.amount)
  )
  isTransferIdSpent = await destinationBridge.isTransferIdSpent(transferId)
  expect(isTransferIdSpent).to.eq(true)
}

export const executeBridgeBondWithdrawal = async (
  destinationReceiptToken: Contract,
  destinationBridge: Contract,
  sourceBridge: Contract,
  transfer: Transfer,
  bonder: Signer,
  transferIndex: BigNumber = BigNumber.from('0')
) => {
  // Get state before transaction
  const transferNonce = await getTransferNonceFromEvent(sourceBridge, transferIndex)
  const senderBalanceBefore: BigNumber = await destinationReceiptToken.balanceOf(
    await transfer.sender.getAddress()
  )
  const bonderBalanceBefore: BigNumber = await destinationReceiptToken.balanceOf(
    await bonder.getAddress()
  )

  // Perform transaction
  await destinationBridge
    .connect(bonder)
    .bondWithdrawal(
      await transfer.recipient.getAddress(),
      transfer.amount,
      transferNonce,
      transfer.bonderFee
    )

  // Validate state after transaction
  let senderDestinationReceiptTokenBalance: BigNumber
  let recipientL1CanonicalTokenBalance: BigNumber
  if (transfer.sender === transfer.recipient) {
    senderDestinationReceiptTokenBalance = senderBalanceBefore
      .add(transfer.amount)
      .sub(transfer.bonderFee)
    recipientL1CanonicalTokenBalance = senderDestinationReceiptTokenBalance
  } else {
    senderDestinationReceiptTokenBalance = senderBalanceBefore
    recipientL1CanonicalTokenBalance = transfer.amount.sub(transfer.bonderFee)
  }
  await expectBalanceOf(
    destinationReceiptToken,
    transfer.sender,
    senderDestinationReceiptTokenBalance
  )

  await expectBalanceOf(
    destinationReceiptToken,
    transfer.recipient,
    recipientL1CanonicalTokenBalance
  )

  await expectBalanceOf(
    destinationReceiptToken,
    bonder,
    bonderBalanceBefore.add(transfer.bonderFee)
  )
}

export const executeL1BridgeBondTransferRoot = async (
  l1_bridge: Contract,
  l2_bridge: Contract,
  transfer: Transfer,
  bonder: Signer,
  timeIncrease: number,
  customTransferNonce: string | null = null
) => {
  let transferNonce: string
  if (customTransferNonce) {
    transferNonce = customTransferNonce
  } else {
    transferNonce = await getTransferNonceFromEvent(l2_bridge)
  }
  const transferId: Buffer = await transfer.getTransferId(transferNonce)
  const { rootHash } = getRootHashFromTransferId(transferId)

  // Perform transaction
  await l1_bridge
    .connect(bonder)
    .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

  // Validate state after transaction
  const currentTime: number = Math.floor(Date.now() / 1000)
  const timeSlot: number = await l1_bridge.getTimeSlot(
    currentTime + timeIncrease
  )
  const bondAmount: string = await l1_bridge.getBondForTransferAmount(
    transfer.amount
  )
  const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(
    timeSlot,
    await bonder.getAddress()
  )
  const transferBond: number = await l1_bridge.timeSlotToAmountBonded(
    timeSlot,
    await bonder.getAddress()
  )
  const transferRoot: number = await l1_bridge.getTransferRoot(
    rootHash,
    transfer.amount
  )

  // NOTE: This is going to fail sometimes, as `currentTime` will be different from the expected time, causing a 
  // timeSlot mismatch
  expect(timeSlotToAmountBonded).to.eq(bondAmount)
  expect(transferBond).to.eq(bondAmount)
  if (transfer.chainId === CHAIN_IDS.ETHEREUM.MAINNET) {
    expect(transferRoot[0]).to.eq(transfer.amount)
    expect(transferRoot[1]).to.eq(BigNumber.from('0'))
    expect(transferRoot[2].toNumber()).to.be.closeTo(
      currentTime,
      TIMESTAMP_VARIANCE
    )
  }
}

export const executeL1BridgeBondTransferRootAndSettle = async (
  l1_bridge: Contract,
  l2_bridge: Contract,
  transfer: Transfer,
  bonder: Signer,
  timeIncrease: number,
  customTransferNonce: string | null = null
) => {
  let transferNonce: string
  if (customTransferNonce) {
    transferNonce = customTransferNonce
  } else {
    transferNonce = await getTransferNonceFromEvent(l2_bridge)
  }
  const transferId: Buffer = await transfer.getTransferId(transferNonce)
  const { rootHash } = getRootHashFromTransferId(transferId)

  // Get state before transaction
  // A: Rename l1_bridge
  const bondedAmountBefore: BigNumber = await l1_bridge.getCredit(
    await bonder.getAddress()
  )

  // Perform transaction
  // A: Use arbitrary ids
  await l1_bridge
    .connect(bonder)
    .bondTransferRootAndSettle(
      rootHash,
      transfer.chainId,
      [transferId],
      transfer.amount
    )

  // Validate state after transaction
  const currentTime: number = Math.floor(Date.now() / 1000)
  const timeSlot: number = await l1_bridge.getTimeSlot(
    currentTime + timeIncrease
  )
  const bondAmount: string = await l1_bridge.getBondForTransferAmount(
    transfer.amount
  )
  const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(
    timeSlot,
    await bonder.getAddress()
  )
  const transferBond: number = await l1_bridge.timeSlotToAmountBonded(
    timeSlot,
    await bonder.getAddress()
  )
  const transferRoot: number = await l1_bridge.getTransferRoot(
    rootHash,
    transfer.amount
  )

  // NOTE: This is going to fail sometimes, as `currentTime` will be different from the expected time, causing a 
  // timeSlot mismatch
  expect(timeSlotToAmountBonded).to.eq(bondAmount)
  expect(transferBond).to.eq(bondAmount)

  expect(transferRoot[0]).to.eq(transfer.amount)
  expect(transferRoot[1]).to.eq(transfer.amount)
  expect(transferRoot[2].toNumber()).to.be.closeTo(
    currentTime,
    TIMESTAMP_VARIANCE
  )

  // Validate state after transaction
  // A: Rename l1_bridge
  const credit = await l1_bridge.getCredit(await bonder.getAddress())
  const expectedCredit: BigNumber = bondedAmountBefore
  expect(transferRoot[0]).to.eq(transfer.amount)
  expect(transferRoot[1]).to.eq(transfer.amount)
  expect(transferRoot[2].toNumber()).to.be.closeTo(
    currentTime,
    TIMESTAMP_VARIANCE
  )
  expect(credit).to.eq(expectedCredit)
}

export const executeBridgeSettleBondedWithdrawal = async (
  destinationBridge: Contract,
  sourceBridge: Contract,
  transfer: Transfer,
  bonder: Signer
) => {
  const transferNonce = await getTransferNonceFromEvent(sourceBridge)
  const transferId: Buffer = await transfer.getTransferId(transferNonce)
  const { rootHash } = getRootHashFromTransferId(transferId)
  const tree: MerkleTree = getNewMerkleTree([transferId])
  const proof: Buffer[] = tree.getProof(transferId)
  const transferIdTreeIndex = 0
  const totalLeaves = 1

  // Get state before transaction
  const bondedAmountBefore: BigNumber = await destinationBridge.getCredit(
    await bonder.getAddress()
  )

  // Perform transaction
  await destinationBridge
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

  // Validate state after transaction
  const currentTime: number = Math.floor(Date.now() / 1000)
  const transferRoot: number = await destinationBridge.getTransferRoot(
    rootHash,
    transfer.amount
  )
  const credit = await destinationBridge.getCredit(await bonder.getAddress())
  const expectedCredit: BigNumber = bondedAmountBefore
  expect(transferRoot[0]).to.eq(transfer.amount)
  expect(transferRoot[1]).to.eq(transfer.amount)
  expect(transferRoot[2].toNumber()).to.be.closeTo(
    currentTime,
    TIMESTAMP_VARIANCE
  )
  expect(credit).to.eq(expectedCredit)
}

export const executeBridgeSettleBondedWithdrawals = async (
  sourceBridge: Contract,
  destinationBridge: Contract,
  transfers: Transfer[],
  bonder: Signer,
  startingIndex: BigNumber = BigNumber.from('0')
) => {
  // Get state before transaction
  const numTransfers: BigNumber = BigNumber.from(transfers.length)
  let totalTransferAmount: BigNumber = BigNumber.from('0')

  let transferNonces: string[] = []
  let transferIds: Buffer[] = []
  for (let i = 0; i < numTransfers.toNumber(); i++) {
    transferNonces.push(await getTransferNonceFromEvent(
      destinationBridge,
      BigNumber.from(i).add(startingIndex)
    ))
    transferIds.push(await transfers[i].getTransferId(transferNonces[i]))
    totalTransferAmount = totalTransferAmount.add(transfers[i].amount)
  }

  // Get state before transaction
  const bondedAmountBefore: BigNumber = await sourceBridge.getCredit(
    await bonder.getAddress()
  )

  // Perform transaction
  await sourceBridge
    .connect(bonder)
    .settleBondedWithdrawals(
      await bonder.getAddress(),
      transferIds,
      totalTransferAmount
    )

  // Validate state after transaction
  const currentTime: number = Math.floor(Date.now() / 1000)
  let calculatedTransferIds: Buffer[] = []
  for (let i = 0; i < numTransfers.toNumber(); i++) {
    const transferNonce = await getTransferNonceFromEvent(
      destinationBridge,
      BigNumber.from(i).add(startingIndex)
    )
    calculatedTransferIds.push(await transfers[i].getTransferId(transferNonce))
  }
  const expectedMerkleTree: MerkleTree = getNewMerkleTree(calculatedTransferIds)
  const transferRoot: number = await sourceBridge.getTransferRoot(
    expectedMerkleTree.getHexRoot(),
    totalTransferAmount
  )
  const credit = await sourceBridge.getCredit(await bonder.getAddress())
  const expectedCredit: BigNumber = bondedAmountBefore
  expect(transferRoot[0]).to.eq(totalTransferAmount)
  expect(transferRoot[1]).to.eq(totalTransferAmount)
  expect(transferRoot[2].toNumber()).to.be.closeTo(
    currentTime,
    TIMESTAMP_VARIANCE
  )
  expect(credit).to.eq(expectedCredit)
}

export const executeL1BridgeChallengeTransferBond = async (
  l1_canonicalToken: Contract,
  l1_bridge: Contract,
  l2_bridge: Contract,
  amount: BigNumber,
  chainId: BigNumber,
  bonder: Signer,
  challenger: Signer,
  transfer: Transfer,
  customTransferNonce: string | null = null
) => {
  let transferNonce: string
  if (customTransferNonce) {
    transferNonce = customTransferNonce
  } else {
    transferNonce = await getTransferNonceFromEvent(l2_bridge)
  }
  const transferId: Buffer = await transfer.getTransferId(transferNonce)
  const { rootHash } = getRootHashFromTransferId(transferId)
  const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(
    amount
  )
  const transferRootId: string = await l1_bridge.getTransferRootId(
    rootHash,
    amount
  )

  // Get state before transaction
  const challengerBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(
    await challenger.getAddress()
  )
  const debitBefore: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(
    await bonder.getAddress()
  )
  const bridgeBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(
    l1_bridge.address
  )

  // Perform transaction
  await l1_canonicalToken
    .connect(challenger)
    .approve(l1_bridge.address, challengeAmount)
  await l1_bridge.connect(challenger).challengeTransferBond(rootHash, amount, chainId)

  // Validate state after transaction
  await expectBalanceOf(
    l1_canonicalToken,
    challenger,
    challengerBalanceBefore.sub(challengeAmount)
  )

  const transferBond = await l1_bridge.transferBonds(transferRootId)
  const currentTime: number = Math.floor(Date.now() / 1000)
  expect(transferBond[3].toNumber()).to.be.closeTo(
    currentTime,
    TIMESTAMP_VARIANCE
  )
  expect(transferBond[4]).to.eq(await challenger.getAddress())
  expect(transferBond[5]).to.eq(false)

  const timeSlot: string = await l1_bridge.getTimeSlot(currentTime)
  const bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(
    timeSlot,
    await bonder.getAddress()
  )
  expect(bondAmountForTimeSlot).to.eq(BigNumber.from('0'))

  expectBalanceOf(
    l1_canonicalToken,
    l1_bridge,
    bridgeBalanceBefore.add(challengeAmount)
  )

  // This will be the same, as the debit has already been counted
  const debitAfter: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(
    await bonder.getAddress()
  )
  expect(debitBefore).to.eq(debitAfter)
}

export const executeL1BridgeResolveChallenge = async (
  l1_canonicalToken: Contract,
  l1_bridge: Contract,
  originBridge: Contract,
  amount: BigNumber,
  bonder: Signer,
  challenger: Signer,
  transfer: Transfer,
  shouldResolveSuccessfully: boolean,
  didBonderWaitMinTransferRootTime: boolean = true,
  customTransferNonce: string | null = null,
  customChainId: BigNumber | null = null
) => {
  let transferNonce: string
  if (customTransferNonce) {
    transferNonce = customTransferNonce
  } else {
    transferNonce = await getTransferNonceFromEvent(originBridge)
  }
  const transferId: Buffer = await transfer.getTransferId(transferNonce)
  const { rootHash } = getRootHashFromTransferId(transferId)
  const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(
    amount
  )
  const bondAmount: BigNumber = await l1_bridge.getBondForTransferAmount(amount)
  const transferRootId: string = await l1_bridge.getTransferRootId(
    rootHash,
    amount
  )

  // Get state before transaction
  const creditBefore: BigNumber = await l1_bridge.getCredit(
    await bonder.getAddress()
  )
  const challengerBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(
    await challenger.getAddress()
  )

  // Add a custom chainId for non-happy path tests
  const chainIdToUse = customChainId || transfer.chainId

  // Perform transaction
  await l1_bridge.resolveChallenge(rootHash, amount, chainIdToUse)

  // Validate state after transaction
  const transferBond: number = await l1_bridge.transferBonds(transferRootId)
  const creditAfter: BigNumber = await l1_bridge.getCredit(
    await bonder.getAddress()
  )

  if (!shouldResolveSuccessfully) {
    expect(transferBond[5]).to.eq(true)
    let expectedCredit: BigNumber = creditBefore
    if (didBonderWaitMinTransferRootTime) {
      expectedCredit = expectedCredit.add(challengeAmount)
    } else {
      await l1_bridge.connect(challenger).unstake(challengeAmount)
    }
    expect(creditAfter).to.eq(expectedCredit)
  } else {
    expect(transferBond[5]).to.eq(true)

    // Credit should not have changed
    expect(creditAfter).to.eq(creditBefore)

    // DEAD address should have tokens
    const balanceAfter: BigNumber = await l1_canonicalToken.balanceOf(
      DEAD_ADDRESS
    )
    expect(balanceAfter.toString()).to.eq(
      BigNumber.from(challengeAmount)
        .div(4)
        .toString()
    )

    const expectedChallengerBalance = challengeAmount.mul(7).div(4)
    await l1_bridge.connect(challenger).unstake(expectedChallengerBalance)

    // Challenger should have tokens
    // NOTE: the challenge amount is subtracted to mimic the amount sent to the contract during the challenge
    const expectedChallengerTokenAmount: BigNumber = challengerBalanceBefore.add(expectedChallengerBalance)
    await expectBalanceOf(
      l1_canonicalToken,
      challenger,
      expectedChallengerTokenAmount
    )
  }
}

export const executeBridgeRescueTransferRoot = async (
  destinationPayoutToken: Contract,
  sourceBridge: Contract,
  receivingBridge: Contract,
  amount: BigNumber,
  governance: Signer,
  transfer: Transfer,
  customTransferNonce: string | null = null
) => {
  let transferNonce: string
  if (customTransferNonce) {
    transferNonce = customTransferNonce
  } else {
    transferNonce = await getTransferNonceFromEvent(sourceBridge)
  }
  const transferId: Buffer = await transfer.getTransferId(transferNonce)
  const { rootHash } = getRootHashFromTransferId(transferId)

  // Get state before transaction
  const governanceAmountBefore: BigNumber = await destinationPayoutToken.balanceOf(
    await governance.getAddress()
  )
  const transferRootAmountWithdrawnBefore: BigNumber = (
    await receivingBridge.getTransferRoot(rootHash, transfer.amount)
  )[1]

  // Perform transaction
  await receivingBridge
    .connect(governance)
    .rescueTransferRoot(
      rootHash,
      amount,
      await governance.getAddress()
    )

  // Validate state after transaction
  const transferRootAmountWithdrawnAfter: BigNumber = (
    await receivingBridge.getTransferRoot(rootHash, transfer.amount)
  )[1]
  expect(transferRootAmountWithdrawnAfter).to.eq(
    transferRootAmountWithdrawnBefore.add(transfer.amount)
  )

  await expectBalanceOf(
    destinationPayoutToken,
    governance,
    governanceAmountBefore.add(transfer.amount)
  )
}

/**
 * L2 Bridge
 */

export const executeL2BridgeSend = async (
  sourceHopBridgeToken: Contract,
  sourceBridge: Contract,
  transfer: Transfer,
  transferIndex?: BigNumber
) => {
  // Get state before transaction
  const bridgeTotalSupplyBefore: BigNumber = await sourceHopBridgeToken.totalSupply()
  const senderBalanceBefore: BigNumber = await sourceHopBridgeToken.balanceOf(
    await transfer.sender.getAddress()
  )
  const pendingAmountBefore: BigNumber = await sourceBridge.pendingAmount(
    transfer.chainId,
    await transfer.bonder.getAddress()
  )
  transferIndex = transferIndex ? transferIndex : await sourceBridge.transferNonceIncrementer()
  const maxPendingTransfers = await sourceBridge.maxPendingTransfers()
  let transferWillCommitTransfers = false
  try {
    await sourceBridge.pendingTransferIds(transfer.chainId, await transfer.bonder.getAddress(), maxPendingTransfers.sub(1))
    transferWillCommitTransfers = true
  } catch (e) {}

  const bonderAddress = (await transfer.bonder?.getAddress()) ?? ZERO_ADDRESS

  // Perform transaction
  await sourceBridge
    .connect(transfer.sender)
    .send(
      transfer.chainId,
      await transfer.recipient.getAddress(),
      transfer.amount,
      transfer.bonderFee,
      [
        transfer.tokenIndex,
        transfer.amountOutMin,
        transfer.deadline
      ],
      bonderAddress
    )

  // Perform transaction
  // Validate state after transaction
  const rootIndex = await sourceBridge.rootIndex(transfer.chainId, bonderAddress)
  const bridgeTotalSupplyAfter: BigNumber = await sourceHopBridgeToken.totalSupply()
  expect(bridgeTotalSupplyAfter).to.eq(
    bridgeTotalSupplyBefore.sub(transfer.amount)
  )
  await expectBalanceOf(
    sourceHopBridgeToken,
    transfer.sender,
    senderBalanceBefore.sub(transfer.amount)
  )

  // Verify state
  const transferNonce = await getTransferNonceFromEvent(
    sourceBridge,
    transferIndex
  )

  const pendingAmount: BigNumber = await sourceBridge.pendingAmount(
    transfer.chainId,
    await transfer.bonder.getAddress()
  )
  let expectedPendingAmount: BigNumber
  if(transferWillCommitTransfers) {
    expectedPendingAmount = transfer.amount
  } else {
    expectedPendingAmount = pendingAmountBefore.add(
      transfer.amount
    )
  }
  expect(pendingAmount).to.eq(expectedPendingAmount)

  const transfersSentEvents = (
    await sourceBridge.queryFilter(sourceBridge.filters.TransferSent())
  )
  
  const transfersSentEvent = transfersSentEvents[transferIndex.toNumber()]

  const transferSentArgs = transfersSentEvent.args
  expect(transferSentArgs.chainId).to.eq(transfer.chainId)
  expect(transferSentArgs.rootIndex).to.eq(rootIndex)
  expect(transferSentArgs.recipient).to.eq(await transfer.recipient.getAddress())
  expect(transferSentArgs.amount).to.eq(transfer.amount)
  expect(transferSentArgs.transferNonce).to.eq(transferNonce)
  expect(transferSentArgs.bonderFee).to.eq(transfer.bonderFee)
}

export const executeL2AmmWrapperSwapAndSend = async (
  sourceBridge: Contract,
  sourceCanonicalToken: Contract,
  sourceSwap: Contract,
  l2_ammWrapper: Contract,
  transfer: Transfer
) => {
  // Get state before transaction
  const senderBalanceBefore: BigNumber = await sourceCanonicalToken.balanceOf(
    await transfer.sender.getAddress()
  )
  let expectedAmountAfterSlippage: BigNumber = await sourceSwap.calculateSwap(
    ...C_TO_H_SWAP_INDICES,
    transfer.amount
  )
  const rootIndex = await sourceBridge.rootIndex(transfer.chainId, await transfer.bonder.getAddress())
  const bonderAddress = (await transfer.bonder?.getAddress()) ?? ZERO_ADDRESS

  // Perform transaction
  await sourceCanonicalToken
    .connect(transfer.sender)
    .approve(l2_ammWrapper.address, transfer.amount)
  await l2_ammWrapper
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
        transfer.destinationTokenIndex,
        transfer.destinationAmountOutMin,
        transfer.destinationDeadline
      ],
      bonderAddress
    )

  // Validate state after transaction
  await expectBalanceOf(
    sourceCanonicalToken,
    transfer.sender,
    senderBalanceBefore.sub(transfer.amount)
  )

  const transferNonce = await getTransferNonceFromEvent(sourceBridge)
  const transferAfterSlippage: Transfer = Object.assign(transfer, {
    amount: expectedAmountAfterSlippage
  })
  const isSwapAndSend: boolean = true
  const expectedPendingTransferHash: Buffer = await transferAfterSlippage.getTransferId(
    transferNonce,
    isSwapAndSend
  )

  const pendingAmount = await sourceBridge.pendingAmount(
    transfer.chainId,
    await transfer.bonder.getAddress()
  )

  expect(pendingAmount).to.eq(transferAfterSlippage.amount)
  const transfersSentEvent = (
    await sourceBridge.queryFilter(sourceBridge.filters.TransferSent())
  )[0]
  const transferSentArgs = transfersSentEvent.args

  expect(transferSentArgs.chainId).to.eq(transfer.chainId)
  expect(transferSentArgs.rootIndex).to.eq(rootIndex)
  expect(transferSentArgs.recipient).to.eq(await transfer.recipient.getAddress())
  expect(transferSentArgs.amount).to.eq(transferAfterSlippage.amount)
  expect(transferSentArgs.transferNonce).to.eq(transferNonce)
  expect(transferSentArgs.bonderFee).to.eq(transfer.bonderFee)
}

export const executeL2AmmWrapperAttemptSwap = async (
  l2_swap: Contract,
  l2_ammWrapper: Contract,
  l2_canonicalToken: Contract,
  l2_hopBridgeToken: Contract,
  sender: Signer,
  recipient: Signer,
  amount: BigNumber,
  amountOutMin: BigNumber,
  deadline: BigNumber,
  shouldSwapSuccessfully: boolean = true
) => {
  // Get state before transaction
  const senderHopTokenBalanceBefore: BigNumber = await l2_hopBridgeToken.balanceOf(
    await sender.getAddress()
  )
  const recipientHopTokenBalanceBefore: BigNumber = await l2_hopBridgeToken.balanceOf(
    await recipient.getAddress()
  )
  const recipientCanonicalTokenBalanceBefore: BigNumber = await l2_canonicalToken.balanceOf(
    await recipient.getAddress()
  )

  const expectedAmountAfterSlippage: BigNumber = await l2_swap.calculateSwap(...H_TO_C_SWAP_INDICES, amount)

  // Perform transaction
  await l2_hopBridgeToken
    .connect(sender)
    .approve(l2_ammWrapper.address, amount)
  await l2_ammWrapper
    .connect(sender)
    .attemptSwap(
      await recipient.getAddress(),
      amount,
      [
        '1',
        amountOutMin,
        deadline
      ]
    )

  // Validate state after transaction
  await expectBalanceOf(
    l2_hopBridgeToken,
    sender,
    senderHopTokenBalanceBefore.sub(amount)
  )

  if (shouldSwapSuccessfully) {
    await expectBalanceOf(
      l2_canonicalToken,
      recipient,
      recipientCanonicalTokenBalanceBefore.add(expectedAmountAfterSlippage)
    )
  } else {
    await expectBalanceOf(
      l2_hopBridgeToken,
      recipient,
      recipientHopTokenBalanceBefore.add(amount)
    )
  }
}

export const executeL2BridgeCommitTransfers = async (
  l2_bridge: Contract,
  transfers: Transfer[],
  bonder: Signer,
  startingIndex: BigNumber = BigNumber.from('0'),
  didSwapAndSend: boolean = false
) => {
  // Get state before transaction
  const destinationChainId: BigNumber = transfers[0].chainId
  const numTransfers: BigNumber = BigNumber.from(transfers.length)
  let expectedPendingAmount: BigNumber = BigNumber.from('0')

  for (let i = 0; i < numTransfers.toNumber(); i++) {
    // All transfers passed in here should have the same chainId
    expect(destinationChainId).to.eq(transfers[i].chainId)

    const transferNonce = await getTransferNonceFromEvent(
      l2_bridge,
      BigNumber.from(i).add(startingIndex)
    )

    const pendingTransferId: string = await l2_bridge.pendingTransferIds(
      destinationChainId,
      await transfers[i].bonder.getAddress(),
      i
    )

    const expectedPendingTransferId: string = await transfers[i].getTransferIdHex(
      transferNonce,
      didSwapAndSend
    )

    expect(pendingTransferId).to.eq(
      expectedPendingTransferId
    )

    expectedPendingAmount = expectedPendingAmount.add(transfers[i].amount)
  }

  let pendingAmount: BigNumber = await l2_bridge.pendingAmount(
    transfers[0].chainId,
    await transfers[0].bonder.getAddress()
  )

  expect(pendingAmount).to.eq(expectedPendingAmount)

  // Perform transaction
  await l2_bridge.connect(bonder).commitTransfers(destinationChainId, await transfers[0].bonder.getAddress())

  // Validate state after transaction
  const lastCommitTime: BigNumber = await l2_bridge.lastCommitTime(
    destinationChainId,
    await transfers[0].bonder.getAddress()
  )
  const currentTime: number = Math.floor(Date.now() / 1000)
  expect(lastCommitTime.toNumber()).to.be.closeTo(
    currentTime,
    TIMESTAMP_VARIANCE
  )

  const expectedErrorMsg: string =
    'VM Exception while processing transaction: invalid opcode'
  try {
    await l2_bridge.pendingTransferIds(
      destinationChainId, 
      await bonder.getAddress(),
      0
    )
    throw new Error(
      'There should not be a pending transfer ID for chainId in this slot.'
    )
  } catch (err) {
    expect(err.message).to.eq(expectedErrorMsg)
  }

  // Verify state post-transaction
  pendingAmount = await l2_bridge.pendingAmount(
    destinationChainId,
    await bonder.getAddress()
  )
  expect(pendingAmount).to.eq('0')

  let transferIds: Buffer[] = []
  for (let i = 0; i < numTransfers.toNumber(); i++) {
    const transferNonce = await getTransferNonceFromEvent(
      l2_bridge,
      BigNumber.from(i).add(startingIndex)
    )
    const transferId: Buffer = await transfers[i].getTransferId(transferNonce, didSwapAndSend)
    transferIds.push(transferId)
  }
  const expectedMerkleTree: MerkleTree = getNewMerkleTree(transferIds)

  // There should only be a single TransfersCommitted event
  const transfersCommittedEvent = (
    await l2_bridge.queryFilter(l2_bridge.filters.TransfersCommitted())
  )

  const transfersCommittedArgs = transfersCommittedEvent[transfersCommittedEvent.length - 1].args
  expect(transfersCommittedArgs.rootHash).to.eq(expectedMerkleTree.getHexRoot())
  const pendingChainAmounts = transfersCommittedArgs.totalAmount
  expect(pendingChainAmounts).to.eq(expectedPendingAmount)
}

export const executeL2BridgeBondWithdrawalAndDistribute = async (
  sourceBridge: Contract,
  l2_hopBridgeToken: Contract,
  l2_bridge: Contract,
  l2_canonicalToken: Contract,
  l2_swap: Contract,
  transfer: Transfer,
  bonder: Signer,
  actualTransferAmount: BigNumber,
  transferIndex: BigNumber = BigNumber.from('0')
) => {
  // Get state before transaction
  const transferNonce = await getTransferNonceFromEvent(
    sourceBridge,
    transferIndex
  )
  const bonderBalanceBefore: BigNumber = await l2_hopBridgeToken.balanceOf(
    await bonder.getAddress()
  )
  const recipientCanonicalTokenBalanceBefore: BigNumber = await l2_canonicalToken.balanceOf(
    await transfer.recipient.getAddress()
  )

  const swapAmount: BigNumber = actualTransferAmount.sub(transfer.bonderFee)
  let expectedRecipientAmountAfterSlippage: BigNumber
  if (swapAmount.eq(0)) {
    expectedRecipientAmountAfterSlippage = BigNumber.from('0')
  } else {
    expectedRecipientAmountAfterSlippage = await l2_swap.calculateSwap(
      ...H_TO_C_SWAP_INDICES,
      swapAmount
    )
  }

  // Perform transaction
  await l2_bridge
    .connect(bonder)
    .bondWithdrawalAndDistribute(
      await transfer.recipient.getAddress(),
      transfer.amount,
      transferNonce,
      transfer.bonderFee,
      [
        '1',
        transfer.amountOutMin,
        transfer.deadline
      ]
    )
  
  // Validate state after transaction
  await expectBalanceOf(l2_hopBridgeToken, transfer.recipient, 0)

  await expectBalanceOf(
    l2_hopBridgeToken,
    bonder,
    bonderBalanceBefore.add(transfer.bonderFee)
  )
  await expectBalanceOf(
    l2_canonicalToken,
    transfer.recipient,
    recipientCanonicalTokenBalanceBefore.add(expectedRecipientAmountAfterSlippage)
  )
}

/**
 * Canonical Bridge Messages
 */

export const getAddBonderMessage = (
  newBonderAddress: string
) => {
  const ABI = [
    'function addBonder(address bonder)'
  ]
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('addBonder', [
    newBonderAddress
  ])
}

export const getRemoveBonderMessage = (
  bonderAddress: string
) => {
  const ABI = [
    'function removeBonder(address bonder)'
  ]
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('removeBonder', [
    bonderAddress
  ])
}

export const getSetL1GovernanceMessage = (l1_governanceAddress: string) => {
  const ABI = ['function setL1Governance(address _l1Governance)']
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setL1Governance', [l1_governanceAddress])
}

export const getSetL1BridgeConnectorMessage = (l1_bridge: Contract | string) => {
  const address = getAddressFromContractOrString(l1_bridge)
  const ABI = ['function setL1BridgeConnector(address _l1BridgeAddress)']
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setL1BridgeConnector', [address])
}

export const getSetL1CallerMessage = (
  l1_messengerWrapper: Contract | string
) => {
  const address = getAddressFromContractOrString(l1_messengerWrapper)
  const ABI = [
    'function setL1Caller(address _l1Caller)'
  ]
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setL1Caller', [
    address
  ])
}

export const getSetAmmWrapperMessage = (
  l2_ammWrapper: Contract | string
) => {
  const address = getAddressFromContractOrString(l2_ammWrapper)
  const ABI = ['function setAmmWrapper(address _ammWrapper)']
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setAmmWrapper', [address])
}

export const getSetDefaultGasLimitUint32Message = (
  defaultGasLimit: BigNumber
) => {
  const ABI = ['function setDefaultGasLimit(uint32 _defaultGasLimit)']
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setDefaultGasLimit', [
    defaultGasLimit
  ])
}

export const getSetDefaultGasLimitUint256Message = (
  defaultGasLimit: BigNumber
) => {
  const ABI = ['function setDefaultGasLimit(uint256 _defaultGasLimit)']
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setDefaultGasLimit', [
    defaultGasLimit
  ])
}

export const getSetHopBridgeTokenOwnerMessage = (newOwnerAddress: string) => {
  const ABI = ['function setHopBridgeTokenOwner(address newOwner)']
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setHopBridgeTokenOwner', [
    newOwnerAddress
  ])
}

export const getAddActiveChainIdsMessage = (chainIds: BigNumber[]) => {
  const ABI = ['function addActiveChainIds(uint256[] calldata chainIds)']
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('addActiveChainIds', [chainIds])
}

export const getRemoveActiveChainIdsMessage = (chainIds: BigNumber[]) => {
  const ABI = ['function removeActiveChainIds(uint256[] calldata chainIds)']
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('removeActiveChainIds', [
    chainIds
  ])
}

export const getSetMaxPendingTransfersMessage = (
  maxPendingTransfers: BigNumber
) => {
  const ABI = ['function setMaxPendingTransfers(uint256 _maxPendingTransfers)']
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setMaxPendingTransfers', [
    maxPendingTransfers
  ])
}

export const getSetMinimumForceCommitDelayMessage = (
  minimumForceCommitDelay: BigNumber
) => {
  const ABI = [
    'function setMinimumForceCommitDelay(uint256 _minimumForceCommitDelay)'
  ]
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setMinimumForceCommitDelay', [
    minimumForceCommitDelay
  ])
}

export const getSetMinimumBonderFeeRequirementsMessage = (
  minBonderBps: BigNumber,
  minBonderFeeAbsolute: BigNumber
) => {
  const ABI = [
    'function setMinimumBonderFeeRequirements(uint256 _minBonderBps, uint256 _minBonderFeeAbsolute)'
  ]
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setMinimumBonderFeeRequirements', [
    minBonderBps,
    minBonderFeeAbsolute
  ])
}

export const getSetMessengerMessage = (
  messenger: Contract | string
) => {
  const address = getAddressFromContractOrString(messenger)
  const ABI = ['function setMessenger(address _messenger)']
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setMessenger', [address])
}

export const getSetMessengerProxyMessage = (
  messengerProxy: Contract | string
) => {
  const address = getAddressFromContractOrString(messengerProxy)
  const ABI = ['function setMessengerProxy(address _messengerProxy)']
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setMessengerProxy', [address])
}

export const getSetFxRootTunnelMessage = (
  l1_messengerWrapperAddress:  string
) => {
  const address = getAddressFromContractOrString(l1_messengerWrapperAddress)
  const ABI = ['function setFxRootTunnel(address _fxRootTunnel)']
  const ethersInterface = new ethersUtils.Interface(ABI)
  return ethersInterface.encodeFunctionData('setFxRootTunnel', [address])
}

const getAddressFromContractOrString = (input: Contract | string): string => {
  if (typeof input === 'string') {
    return input
  } else {
    return input.address
  }
}
