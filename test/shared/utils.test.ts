import { expect } from 'chai'
import * as utils from './utils'
import { BigNumber } from 'ethers'

describe('Utils test', () => {
  it('Should return the specificTransferNonce', async () => {
    const chainId: BigNumber = BigNumber.from('100')
    const transferIndex: BigNumber = BigNumber.from('0')
    const transferNonce = utils.getTransferNonce(transferIndex, chainId)

    const ans = '0x050fddd1f83b16b7aea90e72cbc86458777a8c329c6d1685fbc33adbc0e7d5000'

    let count = BigNumber.from('0')
    for (let i = 0; i < 500; i++) {
      console.log(i)
      const transferNonce = utils.getTransferNonce(count, chainId)
      console.log(transferNonce)
      console.log(transferNonce === ans)
      count = count.add('1')
    }
    
    // expect(transferNonce).to.eq(123)
  })
})