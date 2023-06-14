import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'

import { fixture } from '../shared/fixtures'
import { setUpDefaults } from '../shared/utils'
import { IFixture } from '../shared/interfaces'
import { generateArbitrumAliasAddress } from '../../config/utils'

import {
  CHAIN_IDS,
  DEFAULT_MAX_SUBMISSION_COST,
  DEFAULT_MAX_GAS,
  DEFAULT_GAS_PRICE_BID
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
    l1ChainId = CHAIN_IDS.ETHEREUM.GOERLI
    l2ChainId = CHAIN_IDS.ARBITRUM.ARBITRUM_TESTNET

    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture)
    ;({ l1_messenger, l1_bridge, l1_messengerWrapper, l2_bridge } = _fixture)
  })

  /**
   * Happy Path
   */

  it('Should set the correct values in the constructor', async () => {
    const expectedL1BridgeAddress: string = l1_bridge.address
    const expectedL2BridgeAddress: string = l2_bridge.address
    const expectedArbInbox: string = l1_messenger.address
    const expectedMaxSubmissionCost: BigNumber = BigNumber.from(
      '10000000000000000'
    )
    const expectedL1MessengerWrapperAlias: string = generateArbitrumAliasAddress(
      l1_messengerWrapper.address
    )
    const expectedMaxGas: number = DEFAULT_MAX_GAS
    const expectedGasPriceBid: number = DEFAULT_GAS_PRICE_BID

    const l1BridgeAddress: string = await l1_messengerWrapper.l1BridgeAddress()
    const l2BridgeAddress: string = await l1_messengerWrapper.l2BridgeAddress()
    const arbInbox: string = await l1_messengerWrapper.arbInbox()
    const maxSubmissionCost: number = await l1_messengerWrapper.maxSubmissionCost()
    const l1MessengerWrapperAlias: string = await l1_messengerWrapper.l1MessengerWrapperAlias()
    const maxGas: number = await l1_messengerWrapper.maxGas()
    const gasPriceBid: number = await l1_messengerWrapper.gasPriceBid()

    expect(expectedL1BridgeAddress).to.eq(l1BridgeAddress)
    expect(expectedL2BridgeAddress).to.eq(l2BridgeAddress)
    expect(expectedArbInbox).to.eq(arbInbox)
    expect(expectedMaxSubmissionCost).to.eq(maxSubmissionCost)
    expect(expectedL1MessengerWrapperAlias).to.eq(l1MessengerWrapperAlias)
    expect(expectedMaxGas).to.eq(maxGas)
    expect(expectedGasPriceBid).to.eq(gasPriceBid)
  })
})
