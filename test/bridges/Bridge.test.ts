import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Contract, BigNumber, Signer } from 'ethers'
import MerkleTree from '../../lib/MerkleTree'
import Transfer from '../../lib/Transfer'

import { fixture } from '../shared/fixtures'
import { setUpDefaults, generateAmountHash } from '../shared/utils'
import { IFixture } from '../shared/interfaces'

import { CHAIN_IDS } from '../../config/constants'

describe('Bridge', () => {
  let _fixture: IFixture

  let mockBridge: Contract
  let transfers: Transfer[]

  let l2ChainId: BigNumber

  beforeEach(async () => {
    l2ChainId = CHAIN_IDS.OPTIMISM.TESTNET_1
    _fixture = await fixture(l2ChainId)
    await setUpDefaults(_fixture, l2ChainId)
    ;({ mockBridge, transfers } = _fixture)
  })

  /**
   * Happy Path
   */

  it('Should get the correct transfer hash', async () => {
    for (let i = 0; i < transfers.length; i++) {
      const transfer: Transfer = transfers[i]
      const expectedTransferHash: Buffer = transfer.getTransferHash()
      const transferHash = await mockBridge.getTransferHash(
        transfer.chainId,
        transfer.sender,
        transfer.recipient,
        transfer.amount,
        transfer.transferNonce,
        transfer.relayerFee,
        transfer.amountOutMin,
        transfer.deadline
      )
      expect(transferHash).to.eq('0x' + expectedTransferHash.toString('hex'))
    }
  })

  it('Should get the correct amount hash', async () => {
    const chainIds: Number[] = [10, 79377087078960]
    const amounts: Number[] = [123, 999]

    const expectedAmountHash: Buffer = generateAmountHash(chainIds, amounts)
    const amountHash = await mockBridge.getAmountHash(chainIds, amounts)
    expect(amountHash).to.eq('0x' + expectedAmountHash.toString('hex'))
  })

  it('Should get the correct amount hash with arbitrary values and array lengths', async () => {
    const chainIds: Number[] = [10, 79377087078960]
    const amounts: Number[] = [123, 999, 1, 2, 3, 4, 5, 6]

    const expectedAmountHash: Buffer = generateAmountHash(chainIds, amounts)
    const amountHash = await mockBridge.getAmountHash(chainIds, amounts)
    expect(amountHash).to.eq('0x' + expectedAmountHash.toString('hex'))
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
    const arbitraryRootHash: string =
      '0x7465737400000000000000000000000000000000000000000000000000000000'
    const arbitraryProof: string[] = [arbitraryRootHash, arbitraryRootHash]

    const expectedErrorMsg: string = 'BRG: Invalid transfer proof'

    await expect(
      mockBridge.withdraw(
        transfer.sender,
        transfer.recipient,
        transfer.amount,
        transfer.transferNonce,
        transfer.relayerFee,
        arbitraryRootHash,
        arbitraryProof
      )
    ).to.be.revertedWith(expectedErrorMsg)
  })

  it.only('Should not allow a withdrawal because the transfer root is not found', async () => {
    const transfer: Transfer = transfers[0]

    // Set up transfer
    transfer.chainId = await mockBridge.getChainId()
    transfer.amountOutMin = BigNumber.from(0)
    transfer.deadline = BigNumber.from(0)

    const transferHash: Buffer = transfer.getTransferHash()
    const tree: MerkleTree = new MerkleTree([transferHash])
    const transferRootHash: Buffer = tree.getRoot()
    const proof: Buffer[] = tree.getProof(transferHash)

    const expectedErrorMsg: string = 'BRG: Transfer root not found'

    await expect(
      mockBridge.withdraw(
        transfer.sender,
        transfer.recipient,
        transfer.amount,
        transfer.transferNonce,
        transfer.relayerFee,
        transferRootHash,
        proof
      )
    ).to.be.revertedWith(expectedErrorMsg)
  })
})
