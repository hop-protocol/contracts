import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'

import { fixture } from '../shared/fixtures'
import { setUpDefaults } from '../shared/utils'
import { IFixture } from '../shared/interfaces'

import {
  CHAIN_IDS,
  DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT
} from '../../config/constants'

export const MAX_NUM_SENDS_BEFORE_COMMIT = 10

describe('Optimism Messenger Wrapper', () => {
  let _fixture: IFixture

  let l1ChainId: BigNumber
  let l2ChainId: BigNumber

  let l1_messenger: Contract
  let l1_bridge: Contract
  let l1_messengerWrapper: Contract
  let l2_bridge: Contract

  beforeEach(async () => {
    l1ChainId = CHAIN_IDS.ETHEREUM.KOVAN
    l2ChainId = CHAIN_IDS.OPTIMISM.HOP_TESTNET
    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture, l2ChainId)
    ;({ l1_messenger, l1_bridge, l1_messengerWrapper, l2_bridge } = _fixture)
  })

  /**
   * Happy Path
   */

  it('Should set the correct values in the constructor (Optimism)', async () => {
    const expectedL1BridgeAddress: string = l1_bridge.address
    const expectedL2BridgeAddress: string = l2_bridge.address
    const expectedDefaultGasLimit: number = DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT
    const expectedL1MessengerAddress: string = l1_messenger.address

    const l1BridgeAddress: string = await l1_messengerWrapper.l1BridgeAddress()
    const l2BridgeAddress: string = await l1_messengerWrapper.l2BridgeAddress()
    const defaultGasLimit: string = await l1_messengerWrapper.defaultGasLimit()
    const l1MessengerAddress: string = await l1_messengerWrapper.l1MessengerAddress()

    expect(expectedL1BridgeAddress).to.eq(l1BridgeAddress)
    expect(expectedL2BridgeAddress).to.eq(l2BridgeAddress)
    expect(expectedDefaultGasLimit).to.eq(defaultGasLimit)
    expect(expectedL1MessengerAddress).to.eq(l1MessengerAddress)
  })
})
