import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber } from 'ethers'

import { setUpDefaults, revertSnapshot, takeSnapshot } from '../shared/utils'
import { fixture } from '../shared/fixtures'
import { IFixture } from '../shared/interfaces'

import {
  CHAIN_IDS,
  DEFAULT_H_BRIDGE_TOKEN_NAME,
  DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
  DEFAULT_H_BRIDGE_TOKEN_DECIMALS
} from '../../config/constants'

import {
  executeCanonicalMessengerSendMessage,
  getSetHopBridgeTokenOwnerMessage
} from '../shared/contractFunctionWrappers'

describe('L1_Bridge', () => {
  let _fixture: IFixture
  let l1ChainId: BigNumber
  let l2ChainId: BigNumber

  let user: Signer
  let governance: Signer

  let l1_messenger: Contract

  let l2_hopBridgeToken: Contract
  let l2_bridge: Contract
  let l2_messenger: Contract

  let beforeAllSnapshotId: string
  let snapshotId: string

  before(async () => {
    beforeAllSnapshotId = await takeSnapshot()

    l1ChainId = CHAIN_IDS.ETHEREUM.KOVAN
    l2ChainId = CHAIN_IDS.OPTIMISM.TESTNET_1

    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture, l2ChainId)
    ;({
      user,
      governance,
      l1_messenger,
      l2_hopBridgeToken,
      l2_bridge,
      l2_messenger
    } = _fixture)
  })

  after(async () => {
    await revertSnapshot(beforeAllSnapshotId)
  })

  beforeEach(async () => {
    snapshotId = await takeSnapshot()
  })

  afterEach(async () => {
    await revertSnapshot(snapshotId)
  })

  /**
   * End to end tests
   */

  it('Should correctly deploy an ERC20 and set the defined values', async () => {
    const expectedName: string = DEFAULT_H_BRIDGE_TOKEN_NAME
    const expectedSymbol: string = DEFAULT_H_BRIDGE_TOKEN_SYMBOL
    const expectedDecimals: number = DEFAULT_H_BRIDGE_TOKEN_DECIMALS

    const name: string = await l2_hopBridgeToken.name()
    const symbol: string = await l2_hopBridgeToken.symbol()
    const decimals: number = await l2_hopBridgeToken.decimals()
    const totalSupply: BigNumber = await l2_hopBridgeToken.totalSupply()

    expect(name).to.eq(expectedName)
    expect(symbol).to.eq(expectedSymbol)
    expect(decimals).to.eq(expectedDecimals)
    expect(totalSupply).to.be.above(BigNumber.from('0'))
  })

  it('Should allow the owner to mint tokens', async () => {
    // Set the owner to a known address for testing purposes
    const message: string = getSetHopBridgeTokenOwnerMessage(
      await user.getAddress()
    )
    await executeCanonicalMessengerSendMessage(
      l1_messenger,
      l2_bridge,
      l2_messenger,
      governance,
      message
    )

    const mintAmount: BigNumber = BigNumber.from('13371377')
    const userBalanceBefore: BigNumber = await l2_hopBridgeToken.balanceOf(
      await user.getAddress()
    )
    const totalSupplyBefore: BigNumber = await l2_hopBridgeToken.totalSupply()

    await l2_hopBridgeToken
      .connect(user)
      .mint(await user.getAddress(), mintAmount)

    const userBalanceAfter: BigNumber = await l2_hopBridgeToken.balanceOf(
      await user.getAddress()
    )
    const totalSupplyAfter: BigNumber = await l2_hopBridgeToken.totalSupply()

    expect(userBalanceAfter).to.eq(userBalanceBefore.add(mintAmount))
    expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(mintAmount))
  })

  it('Should allow the owner to burn tokens', async () => {
    // Set the owner to a known address for testing purposes
    const message: string = getSetHopBridgeTokenOwnerMessage(
      await user.getAddress()
    )
    await executeCanonicalMessengerSendMessage(
      l1_messenger,
      l2_bridge,
      l2_messenger,
      governance,
      message
    )

    const mintAmount: BigNumber = BigNumber.from('13371377')
    const userBalanceBefore: BigNumber = await l2_hopBridgeToken.balanceOf(
      await user.getAddress()
    )
    const totalSupplyBefore: BigNumber = await l2_hopBridgeToken.totalSupply()

    await l2_hopBridgeToken
      .connect(user)
      .mint(await user.getAddress(), mintAmount)

    let userBalanceAfter: BigNumber = await l2_hopBridgeToken.balanceOf(
      await user.getAddress()
    )
    let totalSupplyAfter: BigNumber = await l2_hopBridgeToken.totalSupply()

    expect(userBalanceAfter).to.eq(userBalanceBefore.add(mintAmount))
    expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(mintAmount))

    await l2_hopBridgeToken
      .connect(user)
      .burn(await user.getAddress(), mintAmount)

    userBalanceAfter = await l2_hopBridgeToken.balanceOf(
      await user.getAddress()
    )
    totalSupplyAfter = await l2_hopBridgeToken.totalSupply()

    expect(userBalanceAfter).to.eq(userBalanceBefore)
    expect(totalSupplyAfter).to.eq(totalSupplyBefore)
  })

  it('Should not allow an arbitrary address to mint tokens', async () => {
    const expectedErrorMsg: string = 'Ownable: caller is not the owner'
    const mintAmount: BigNumber = BigNumber.from('13371377')
    await expect(
      l2_hopBridgeToken.connect(user).mint(await user.getAddress(), mintAmount)
    ).to.be.revertedWith(expectedErrorMsg)
  })

  it('Should not allow an arbitrary address to burn tokens', async () => {
    const expectedErrorMsg: string = 'Ownable: caller is not the owner'
    const mintAmount: BigNumber = BigNumber.from('13371377')
    await expect(
      l2_hopBridgeToken.connect(user).burn(await user.getAddress(), mintAmount)
    ).to.be.revertedWith(expectedErrorMsg)
  })
})
