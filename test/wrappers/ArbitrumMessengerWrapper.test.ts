import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'

import { fixture } from '../shared/fixtures'
import { setUpDefaults } from '../shared/utils'
import { IFixture } from '../shared/interfaces'

import {
  CHAIN_IDS,
  DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT,
  DEFAULT_MESSENGER_WRAPPER_GAS_PRICE,
  DEFAULT_MESSENGER_WRAPPER_CALL_VALUE,
  ZERO_ADDRESS
} from '../../config/constants'

export const MAX_NUM_SENDS_BEFORE_COMMIT = 10

// Not implemented
describe.skip('Arbitrum Messenger Wrapper', () => {
  let _fixture: IFixture

  let l1ChainId: BigNumber
  let l2ChainId: BigNumber

  let l1_messenger: Contract
  let l1_bridge: Contract
  let l1_messengerWrapper: Contract
  let l2_bridge: Contract

  beforeEach(async () => {
    l1ChainId = CHAIN_IDS.ETHEREUM.KOVAN
    l2ChainId = CHAIN_IDS.ARBITRUM.TESTNET_4

    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture)
    ;({ l1_messenger, l1_bridge, l1_messengerWrapper, l2_bridge } = _fixture)
  })

  /**
   * Happy Path
   */

  it('Should set the correct values in the constructor', async () => {
    const expectedL1BridgeAddress: string = l1_bridge.address

    const l1BridgeAddress: string = await l1_messengerWrapper.owner()

    expect(expectedL1BridgeAddress).to.eq(l1BridgeAddress)
  })
})
