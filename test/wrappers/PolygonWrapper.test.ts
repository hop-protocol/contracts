import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Contract, BigNumber, Signer, utils as ethersUtils } from 'ethers'

import { fixture } from '../shared/fixtures'
import { setUpDefaults } from '../shared/utils'
import { IFixture } from '../shared/interfaces'

import {
  CHAIN_IDS,
  ONE_ADDRESS
} from '../../config/constants'

import {
  getPolygonCheckpointManagerAddress
} from '../../config/utils'

import {
  getSetL1BridgeAddressMessage
} from '../shared/contractFunctionWrappers'

export const MAX_NUM_SENDS_BEFORE_COMMIT = 10

describe('Polygon Wrapper', () => {
  let _fixture: IFixture

  let user: Signer

  let l1ChainId: BigNumber
  let l2ChainId: BigNumber

  let l1_bridge: Contract
  let l1_messengerWrapper: Contract
  let l2_messenger: Contract
  let l2_messengerProxy: Contract

  let fxRoot: Contract

  beforeEach(async () => {
    l1ChainId = CHAIN_IDS.ETHEREUM.GOERLI
    l2ChainId = CHAIN_IDS.POLYGON.MUMBAI

    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture)
    ;({
      user,
      l1_bridge,
      l1_messengerWrapper,
      l2_messenger,
      l2_messengerProxy,
      fxRoot
    } = _fixture)
  })

  /**
   * Happy Path
   */

  it('Should set the correct values in the constructor', async () => {
    const expectedL1BridgeAddress: string = l1_bridge.address
    const expectedCheckpointManager: string = getPolygonCheckpointManagerAddress(l1ChainId)
    const expectedFxRoot: string = fxRoot.address
    const expectedFxChildTunnel: string = l2_messengerProxy.address

    const l1BridgeAddress: string = await l1_messengerWrapper.l1BridgeAddress()
    const checkpointManager: string = await l1_messengerWrapper.checkpointManager()
    const fxRootAddress: string = await l1_messengerWrapper.fxRoot()
    const fxChildTunnel: string = await l1_messengerWrapper.fxChildTunnel()

    expect(expectedL1BridgeAddress).to.eq(l1BridgeAddress)
    expect(expectedCheckpointManager).to.eq(checkpointManager)
    expect(expectedFxRoot).to.eq(fxRootAddress)
    expect(expectedFxChildTunnel).to.eq(fxChildTunnel)
  })

  it('Should allow anyone to send a cross domain message', async () => {
    const message: string = getSetL1BridgeAddressMessage(ONE_ADDRESS)
    await l1_messengerWrapper.connect(user).sendCrossDomainMessage(message)

    const messengerWrapperMessage: string = ethersUtils.defaultAbiCoder.encode(
      ['address', 'bytes'],
      [await user.getAddress(), message]
    )

    const fxRootMessage: string = ethersUtils.defaultAbiCoder.encode(
      ['address', 'address', 'bytes'],
      [l1_messengerWrapper.address, l2_messengerProxy.address, messengerWrapperMessage]
    )

    const actualNextMessage: string = (await l2_messenger.nextMessage()).message
    expect(fxRootMessage).to.eq(actualNextMessage)
  })

  it('Should verify the sender', async () => {
    // If this function succeeds then the test is a success
    const arbitraryMessage: string = ethersUtils.defaultAbiCoder.encode(
      ['address'],
      [ONE_ADDRESS]
    )
    await l1_messengerWrapper.verifySender(l1_messengerWrapper.address, arbitraryMessage)
  })

  /**
   * Happy Path
   */

  it('Should throw because the sender is invalid', async () => {
    const expectedErrorMsg: string = 'L1_PLGN_WPR: Caller must be this contract'
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

  it('Should throw because the fxChildTunnel can only be set once', async () => {
    const expectedErrorMsg: string = 'FxBaseRootTunnel: CHILD_TUNNEL_ALREADY_SET'
    await expect(
      l1_messengerWrapper.setFxChildTunnel(
        ONE_ADDRESS
      )
    ).to.be.revertedWith(expectedErrorMsg)
  })

})
