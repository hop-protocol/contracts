import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Contract, BigNumber, utils as ethersUtils } from 'ethers'

import { fixture } from '../shared/fixtures'
import { setUpDefaults } from '../shared/utils'
import { IFixture } from '../shared/interfaces'
import { getXDaiAmbAddresses } from '../../config/utils'

import {
  CHAIN_IDS,
  DEFAULT_MESSENGER_WRAPPER_GAS_LIMIT,
  DEFAULT_MESSENGER_WRAPPER_GAS_PRICE,
  DEFAULT_MESSENGER_WRAPPER_CALL_VALUE,
  ZERO_ADDRESS,
  ONE_ADDRESS
} from '../../config/constants'

export const MAX_NUM_SENDS_BEFORE_COMMIT = 10

describe('XDai Messenger Wrapper', () => {
  let _fixture: IFixture

  let l1ChainId: BigNumber
  let l2ChainId: BigNumber

  let l1_messenger: Contract
  let l1_bridge: Contract
  let l1_messengerWrapper: Contract
  let l2_bridge: Contract

  beforeEach(async () => {
    l1ChainId = CHAIN_IDS.ETHEREUM.MAINNET
    l2ChainId = CHAIN_IDS.XDAI.XDAI

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
    const expectedL1MessengerAddress: string = l1_messenger.address
    const expectedDefaultGasLimit: number = 1000000
    const expectedL2ChainId: string = ethersUtils.hexZeroPad(l2ChainId.toHexString(), 32)
    const expectedAmbBridge: string = getXDaiAmbAddresses(l1ChainId)

    const l1BridgeAddress: string = await l1_messengerWrapper.l1BridgeAddress()
    const l2BridgeAddress: string = await l1_messengerWrapper.l2BridgeAddress()
    const l1MessengerAddress: string = await l1_messengerWrapper.l1MessengerAddress()
    const defaultGasLimit: number = await l1_messengerWrapper.defaultGasLimit()
    const actualL2ChainId: string = await l1_messengerWrapper.l2ChainId()
    const ambBridge: string = await l1_messengerWrapper.ambBridge()

    expect(expectedL1BridgeAddress).to.eq(l1BridgeAddress)
    expect(expectedL2BridgeAddress).to.eq(l2BridgeAddress)
    expect(expectedL1MessengerAddress).to.eq(l1MessengerAddress)
    expect(expectedDefaultGasLimit).to.eq(defaultGasLimit)
    expect(expectedL2ChainId).to.eq(actualL2ChainId)
    expect(expectedAmbBridge).to.eq(ambBridge)
  })

  /**
   * Non-happy Path
   */

  it('Should throw because the sender is invalid', async () => {
    const expectedErrorMsg: string = 'MW: Sender must be the L1 Bridge'
    const arbitraryMessage: string = ethersUtils.defaultAbiCoder.encode(
      ['address'],
      [ONE_ADDRESS]
    )
    await expect(
      l1_messengerWrapper.sendCrossDomainMessage(
        arbitraryMessage
      )
    ).to.be.revertedWith(expectedErrorMsg)
  })

  it('Should throw because messageSender() is invalid', async () => {
    const expectedErrorMsg: string = 'L2_XDAI_BRG: Invalid cross-domain sender'
    const arbitraryMessage: string = ethersUtils.defaultAbiCoder.encode(
      ['address'],
      [ONE_ADDRESS]
    )
    await expect(
      l1_messengerWrapper.verifySender(
        ONE_ADDRESS,
        arbitraryMessage
      )
    ).to.be.revertedWith(expectedErrorMsg)
  })
})
