import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
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
    ;({ mockBridge, transfers } = _fixture)
  })

  after(async() => {
    await revertSnapshot(beforeAllSnapshotId)
  })

  beforeEach(async() => {
    snapshotId = await takeSnapshot()
  })

  afterEach(async() => {
    await revertSnapshot(snapshotId)
  })

  /**
   * Happy Path
   */

  // TODO: Test settleBondedWithdrawals() (it was added with contract upgrades)

  it('Should get the correct transfer id', async () => {
    for (let i = 0; i < transfers.length; i++) {
      const transfer: Transfer = transfers[i]
      const transferNonce: string = getTransferNonce(BigNumber.from('0'), transfer.chainId)
      const expectedTransferId: Buffer = await transfer.getTransferId(transferNonce)
      const transferId = await mockBridge.getTransferId(
        transfer.chainId,
        await transfer.sender.getAddress(),
        await transfer.recipient.getAddress(),
        transfer.amount,
        transferNonce,
        transfer.relayerFee,
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

  /**
   * Non-Happy Path
   */

  it('Should not allow a withdrawal because of an invalid proof', async () => {
    const transfer: Transfer = transfers[0]
    const arbitraryProof: string[] = [ARBITRARY_ROOT_HASH, ARBITRARY_ROOT_HASH]

    const expectedErrorMsg: string = 'BRG: Invalid transfer proof'

    await expect(
      mockBridge.withdraw(
        await transfer.sender.getAddress(),
        await transfer.recipient.getAddress(),
        transfer.amount,
        getTransferNonce(BigNumber.from('0'), transfer.chainId),
        transfer.relayerFee,
        ARBITRARY_ROOT_HASH,
        arbitraryProof
      )
    ).to.be.revertedWith(expectedErrorMsg)
  })

  it('Should not allow a withdrawal because the transfer root is not found', async () => {
    const transfer: Transfer = transfers[0]

    // Set up transfer
    transfer.chainId = await mockBridge.getChainId()
    transfer.amountOutMin = BigNumber.from(0)
    transfer.deadline = BigNumber.from(0)

    // TODO: This can use the helper function getRootHashFromTransferId()
    const transferNonce: string = getTransferNonce(BigNumber.from('0'), transfer.chainId)
    const transferId: Buffer = await transfer.getTransferId(transferNonce)
    const tree: MerkleTree = new MerkleTree([transferId])
    const transferRootHash: Buffer = tree.getRoot()
    const proof: Buffer[] = tree.getProof(transferId)

    const expectedErrorMsg: string = 'BRG: Transfer root not found'

    // TODO: The second to last param should be the ID. How is this working with the hash?
    await expect(
      mockBridge.withdraw(
        await transfer.sender.getAddress(),
        await transfer.recipient.getAddress(),
        transfer.amount,
        transferNonce,
        transfer.relayerFee,
        transferRootHash,
        proof
      )
    ).to.be.revertedWith(expectedErrorMsg)
  })
})
