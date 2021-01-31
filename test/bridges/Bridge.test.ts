import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber } from 'ethers'
import Transfer from '../../lib/Transfer'

import { fixture } from '../shared/fixtures'
import { setUpDefaults, generateAmountHash } from '../shared/utils'
import { IFixture} from '../shared/interfaces'

import { CHAIN_IDS } from '../../config/constants'

describe("Bridge", () => {
  let _fixture: IFixture

  let bonder: Signer

  let bridge: Contract
  let transfers: Transfer[]

  beforeEach(async () => {
    const l2ChainId: BigNumber = CHAIN_IDS.OPTIMISM.TESTNET_1
    _fixture = await fixture(l2ChainId)
    await setUpDefaults(_fixture, l2ChainId)

    ;({ 
      bonder,
      bridge,
      transfers
    } = _fixture);
  })

  /**
   * Happy Path
   */

  it('Should get the correct transfer hash', async () => {
    for (let i = 0; i < transfers.length; i++) {
      const transfer: Transfer = transfers[i]
      const expectedTransferHash: Buffer = transfer.getTransferHash()
      const transferHash = await bridge.getTransferHash(
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
    const amountHash = await bridge.getAmountHash(chainIds, amounts)
    expect(amountHash).to.eq('0x' + expectedAmountHash.toString('hex'))
  })

  it('Should get the correct chainId', async () => {
    const expectedChainId = 1
    const chainId = await bridge.getChainId()
    expect(chainId).to.eq(expectedChainId)
  })

  /**
   * Non-Happy Path
   */

   // TODO

})