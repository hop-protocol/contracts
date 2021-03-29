import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Contract, BigNumber, Signer } from 'ethers'
import MerkleTree from '../../lib/MerkleTree'
import Transfer from '../../lib/Transfer'

import { fixture } from '../shared/fixtures'
import {
  getTransferNonce,
  setUpDefaults,
  revertSnapshot,
  takeSnapshot
} from '../shared/utils'
import { IFixture } from '../shared/interfaces'

import { CHAIN_IDS, ARBITRARY_ROOT_HASH } from '../../config/constants'

describe('Bridge', () => {
  let _fixture: IFixture

  let bonder: Signer

  let l1ChainId: BigNumber
  let l2ChainId: BigNumber

  let mockBridge: Contract

  let transfers: Transfer[]

  let beforeAllSnapshotId: string
  let snapshotId: string

  before(async () => {
    beforeAllSnapshotId = await takeSnapshot()

    l1ChainId = CHAIN_IDS.ETHEREUM.KOVAN
    l2ChainId = CHAIN_IDS.OPTIMISM.TESTNET_1
    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture, l2ChainId)
    ;({ bonder, mockBridge, transfers } = _fixture)
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
   * Happy Path
   */

  it('Should get the correct transfer id', async () => {
    for (let i = 0; i < transfers.length; i++) {
      const transfer: Transfer = transfers[i]
      const transferNonce: string = getTransferNonce(
        BigNumber.from('0'),
        transfer.chainId
      )
      const expectedTransferId: Buffer = await transfer.getTransferId(
        transferNonce
      )
      const transferId = await mockBridge.getTransferId(
        transfer.chainId,
        await transfer.recipient.getAddress(),
        transfer.amount,
        transferNonce,
        transfer.bonderFee,
        transfer.amountOutMin,
        transfer.deadline
      )
      expect(transferId).to.eq('0x' + expectedTransferId.toString('hex'))
    }
  })

  it('Should get the correct chainId', async () => {
    const expectedChainId = 1
    const chainId = await mockBridge.getChainId()
    expect(chainId).to.eq(expectedChainId)
  })

  it('Should get the correct transferRoot', async () => {
    const expectedTransferRootId: string =
      '0x1d2412fbc997e6119c879bd18d25205aab0a2d98c6958cc176b5d9009fd1063b'

    const transfer: Transfer = transfers[0]
    const transferNonceIncrementer: BigNumber = BigNumber.from('0')
    const transferNonce: string = getTransferNonce(
      transferNonceIncrementer,
      transfer.chainId
    )
    const transferId: Buffer = await transfer.getTransferId(transferNonce)
    const tree: MerkleTree = new MerkleTree([transferId])
    const transferRootHash: Buffer = tree.getRoot()

    const transferRootId: string = await mockBridge.getTransferRootId(
      transferRootHash,
      transfer.amount
    )
    expect(transferRootId).to.eq(expectedTransferRootId)
  })

  it('Should get the correct transferRoot', async () => {
    // Verified with real data by tests in L1 and L2 bridge
  })

  it('Should get the correct bondedWithdrawalAmount', async () => {
    // Verified with real data by tests in L1 and L2 bridge
  })

  it('Should get the correct isTransferIdSpent', async () => {
    // Verified with real data by tests in L1 and L2 bridge
  })

  /**
   * Non-Happy Path
   */

  it('Should not allow a user to withdrawal because of an invalid proof', async () => {
    const transfer: Transfer = transfers[0]
    const arbitraryProof: string[] = [ARBITRARY_ROOT_HASH, ARBITRARY_ROOT_HASH]

    const expectedErrorMsg: string = 'BRG: Invalid transfer proof'

    await expect(
      mockBridge.withdraw(
        await transfer.recipient.getAddress(),
        transfer.amount,
        getTransferNonce(BigNumber.from('0'), transfer.chainId),
        transfer.bonderFee,
        transfer.amountOutMin,
        transfer.deadline,
        ARBITRARY_ROOT_HASH,
        transfer.amount,
        arbitraryProof
      )
    ).to.be.revertedWith(expectedErrorMsg)
  })

  it('Should not allow a user to withdrawal because the transfer root is not found', async () => {
    const transfer: Transfer = transfers[0]

    // Set up transfer
    transfer.chainId = await mockBridge.getChainId()
    transfer.amountOutMin = BigNumber.from(0)
    transfer.deadline = BigNumber.from(0)

    // TODO: This can use the helper function getRootHashFromTransferId()
    const transferNonce: string = getTransferNonce(
      BigNumber.from('0'),
      transfer.chainId
    )
    const transferId: Buffer = await transfer.getTransferId(transferNonce)
    const tree: MerkleTree = new MerkleTree([transferId])
    const transferRootHash: Buffer = tree.getRoot()
    const proof: Buffer[] = tree.getProof(transferId)

    const expectedErrorMsg: string = 'BRG: Transfer root not found'

    await expect(
      mockBridge.withdraw(
        await transfer.recipient.getAddress(),
        transfer.amount,
        transferNonce,
        transfer.bonderFee,
        transfer.amountOutMin,
        transfer.deadline,
        transferRootHash,
        transfer.amount,
        proof
      )
    ).to.be.revertedWith(expectedErrorMsg)
  })

  it('Should not allow a user to withdraw because the amount withdrawn exceeds the transfer root total', async () => {
    // This is not possible in the current contracts.
  })
})
