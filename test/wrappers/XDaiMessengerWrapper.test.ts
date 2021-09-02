import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Contract, ContractFactory, BigNumber, utils as ethersUtils } from 'ethers'

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
  
  let L2_Bridge: ContractFactory

  beforeEach(async () => {
    l1ChainId = CHAIN_IDS.ETHEREUM.KOVAN
    l2ChainId = CHAIN_IDS.XDAI.SOKOL

    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture)
    ;({ l1_messenger, l1_bridge, l1_messengerWrapper, l2_bridge, L2_Bridge } = _fixture)
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

    const l1BridgeAddress: string = await l1_messengerWrapper.owner()
    const l1MessengerAddress: string = await l1_messengerWrapper.l1MessengerAddress()
    const defaultGasLimit: number = await l1_messengerWrapper.defaultGasLimit()
    const actualL2ChainId: string = await l1_messengerWrapper.l2ChainId()

    expect(expectedL1BridgeAddress).to.eq(l1BridgeAddress)
    expect(expectedL1MessengerAddress).to.eq(l1MessengerAddress)
    expect(expectedDefaultGasLimit).to.eq(defaultGasLimit)
    expect(expectedL2ChainId).to.eq(actualL2ChainId)
  })

  /**
   * Non-happy Path
   */

  it('Should throw because the sender is invalid', async () => {
    const expectedErrorMsg: string = 'L2_XDAI_CNR: Caller is not the expected sender'
    const arbitraryMessage: string = ethersUtils.defaultAbiCoder.encode(
      ['address'],
      [ONE_ADDRESS]
    )
    await expect(
      L2_Bridge.attach(l1_messengerWrapper.address).setAmmWrapper(l1_messengerWrapper.address)
    ).to.be.revertedWith(expectedErrorMsg)
  })
})
