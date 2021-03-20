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
  DEFAULT_MESSENGER_WRAPPER_GAS_CALL_VALUE,
  ZERO_ADDRESS
} from '../../config/constants'

export const MAX_NUM_SENDS_BEFORE_COMMIT = 10

describe('Arbitrum Messenger Wrapper', () => {
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
    await setUpDefaults(_fixture, l2ChainId)
    ;({ l1_messenger, l1_bridge, l1_messengerWrapper, l2_bridge } = _fixture)
  })

  /**
   * Happy Path
   */

  it('Should set the correct values in the constructor (Arbitrum)', async () => {
    const expectedL1BridgeAddress: string = l1_bridge.address
    const expectedL2BridgeAddress: string = l2_bridge.address
    const expectedDefaultGasLimit: number = DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT
    const expectedArbInbox: string = l1_messenger.address
    const expectedArbBridge: string = ZERO_ADDRESS
    const expectedDefaultGasPrice: number = DEFAULT_MESSENGER_WRAPPER_GAS_PRICE
    const expectedDefaultCallValue: number = DEFAULT_MESSENGER_WRAPPER_GAS_CALL_VALUE

    const l1BridgeAddress: string = await l1_messengerWrapper.l1BridgeAddress()
    const l2BridgeAddress: string = await l1_messengerWrapper.l2BridgeAddress()
    const defaultGasLimit: number = await l1_messengerWrapper.defaultGasLimit()
    const arbInbox: string = await l1_messengerWrapper.arbInbox()
    const arbBridge: string = await l1_messengerWrapper.arbBridge()
    const defaultGasPrice: string = await l1_messengerWrapper.defaultGasPrice()
    const defaultCallValue: string = await l1_messengerWrapper.defaultCallValue()

    expect(expectedL1BridgeAddress).to.eq(l1BridgeAddress)
    expect(expectedL2BridgeAddress).to.eq(l2BridgeAddress)
    expect(expectedDefaultGasLimit).to.eq(defaultGasLimit)
    expect(expectedArbInbox).to.eq(arbInbox)
    expect(expectedArbBridge).to.eq(arbBridge)
    expect(expectedDefaultGasPrice).to.eq(defaultGasPrice)
    expect(expectedDefaultCallValue).to.eq(defaultCallValue)
  })
})
