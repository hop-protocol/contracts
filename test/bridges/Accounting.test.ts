import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber } from 'ethers'

import { fixture } from '../shared/fixtures'
import { IFixture } from '../shared/interfaces'
import { setUpDefaults, revertSnapshot, takeSnapshot } from '../shared/utils'

import { CHAIN_IDS, ONE_ADDRESS } from '../../config/constants'

describe('Accounting', () => {
  let _fixture: IFixture
  let l1ChainId: BigNumber
  let l2ChainId: BigNumber

  let bonder: Signer
  let user: Signer
  let governance: Signer
  let otherUser: Signer

  let mockAccounting: Contract

  let beforeAllSnapshotId: string
  let snapshotId: string

  before(async () => {
    beforeAllSnapshotId = await takeSnapshot()

    l1ChainId = CHAIN_IDS.ETHEREUM.KOVAN
    l2ChainId = CHAIN_IDS.OPTIMISM.TESTNET_1
    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture, l2ChainId)
    ;({ bonder, user, governance, otherUser, mockAccounting } = _fixture)
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
   * Happy Path
   */

  it('Should get the correct bonder address', async () => {
    const isBonder = await mockAccounting.getIsBonder(await bonder.getAddress())
    expect(true).to.eq(isBonder)
  })

  it('Should get the correct credit', async () => {
    const expectedCredit: BigNumber = BigNumber.from(0)
    const credit: BigNumber = await mockAccounting.getCredit(
      await bonder.getAddress()
    )
    expect(credit).to.eq(expectedCredit)
  })

  it('Should get the correct raw debit', async () => {
    const expectedDebit: BigNumber = BigNumber.from(0)
    const debit: BigNumber = await mockAccounting.getRawDebit(
      await bonder.getAddress()
    )
    expect(debit).to.eq(expectedDebit)
  })

  it('Should get the correct debit', async () => {
    const expectedDebit: BigNumber = BigNumber.from(0)
    const debit: BigNumber = await mockAccounting.getDebitAndAdditionalDebit(
      await bonder.getAddress()
    )
    expect(debit).to.eq(expectedDebit)
  })

  it('Should add a new bonder', async () => {
    let isBonder: boolean = await mockAccounting.getIsBonder(ONE_ADDRESS)
    expect(isBonder).to.eq(false)

    await mockAccounting.connect(governance).addBonder(ONE_ADDRESS)

    isBonder = await mockAccounting.getIsBonder(ONE_ADDRESS)
    expect(isBonder).to.eq(true)
  })

  it('Should add a new bonder then remove them', async () => {
    let isBonder: boolean = await mockAccounting.getIsBonder(ONE_ADDRESS)
    expect(isBonder).to.eq(false)

    await mockAccounting.connect(governance).addBonder(ONE_ADDRESS)

    isBonder = await mockAccounting.getIsBonder(ONE_ADDRESS)
    expect(isBonder).to.eq(true)

    await mockAccounting.connect(governance).removeBonder(ONE_ADDRESS)

    isBonder = await mockAccounting.getIsBonder(ONE_ADDRESS)
    expect(isBonder).to.eq(false)
  })

  it('Should stake and increase the credit', async () => {
    const stakeAmount: BigNumber = BigNumber.from(10)

    await mockAccounting.stake(await bonder.getAddress(), stakeAmount)
    let credit = await mockAccounting.getCredit(await bonder.getAddress())
    let rawDebit = await mockAccounting.getRawDebit(await bonder.getAddress())
    let debit = await mockAccounting.getDebitAndAdditionalDebit(
      await bonder.getAddress()
    )
    expect(credit).to.eq(stakeAmount)
    expect(rawDebit).to.eq(0)
    expect(debit).to.eq(0)

    await mockAccounting.stake(await bonder.getAddress(), stakeAmount)
    credit = await mockAccounting.getCredit(await bonder.getAddress())
    rawDebit = await mockAccounting.getRawDebit(await bonder.getAddress())
    debit = await mockAccounting.getDebitAndAdditionalDebit(
      await bonder.getAddress()
    )
    expect(credit).to.eq(stakeAmount.mul(2))
    expect(rawDebit).to.eq(0)
    expect(debit).to.eq(0)
  })

  it('Should stake to increase the credit and subsequently unstake to increase the debit', async () => {
    const stakeAmount: BigNumber = BigNumber.from(10)

    await mockAccounting.stake(await bonder.getAddress(), stakeAmount)
    let credit = await mockAccounting.getCredit(await bonder.getAddress())
    let rawDebit = await mockAccounting.getRawDebit(await bonder.getAddress())
    let debit = await mockAccounting.getDebitAndAdditionalDebit(
      await bonder.getAddress()
    )
    expect(credit).to.eq(stakeAmount)
    expect(rawDebit).to.eq(0)
    expect(debit).to.eq(0)

    await mockAccounting.connect(bonder).unstake(stakeAmount)
    credit = await mockAccounting.getCredit(await bonder.getAddress())
    rawDebit = await mockAccounting.getRawDebit(await bonder.getAddress())
    debit = await mockAccounting.getDebitAndAdditionalDebit(
      await bonder.getAddress()
    )
    expect(credit).to.eq(stakeAmount)
    expect(rawDebit).to.eq(stakeAmount)
    expect(debit).to.eq(stakeAmount)

    await mockAccounting.stake(await bonder.getAddress(), stakeAmount.mul(2))
    credit = await mockAccounting.getCredit(await bonder.getAddress())
    rawDebit = await mockAccounting.getRawDebit(await bonder.getAddress())
    debit = await mockAccounting.getDebitAndAdditionalDebit(
      await bonder.getAddress()
    )
    expect(credit).to.eq(stakeAmount.mul(3))
    expect(rawDebit).to.eq(stakeAmount)
    expect(debit).to.eq(stakeAmount)

    await mockAccounting.connect(bonder).unstake(stakeAmount)
    credit = await mockAccounting.getCredit(await bonder.getAddress())
    rawDebit = await mockAccounting.getRawDebit(await bonder.getAddress())
    debit = await mockAccounting.getDebitAndAdditionalDebit(
      await bonder.getAddress()
    )
    expect(credit).to.eq(stakeAmount.mul(3))
    expect(rawDebit).to.eq(stakeAmount.mul(2))
    expect(debit).to.eq(stakeAmount.mul(2))
  })

  it('Should stake many times with different users and then unstake', async () => {
    const stakeAmount: BigNumber = BigNumber.from(10)

    await mockAccounting
      .connect(bonder)
      .stake(await bonder.getAddress(), stakeAmount)
    await mockAccounting
      .connect(user)
      .stake(await bonder.getAddress(), stakeAmount)
    await mockAccounting
      .connect(otherUser)
      .stake(await bonder.getAddress(), stakeAmount)

    let credit = await mockAccounting.getCredit(await bonder.getAddress())
    let rawDebit = await mockAccounting.getRawDebit(await bonder.getAddress())
    let debit = await mockAccounting.getDebitAndAdditionalDebit(
      await bonder.getAddress()
    )
    expect(credit).to.eq(stakeAmount.mul(3))
    expect(rawDebit).to.eq(0)
    expect(debit).to.eq(0)

    await mockAccounting.connect(bonder).unstake(stakeAmount.mul(3))
    credit = await mockAccounting.getCredit(await bonder.getAddress())
    rawDebit = await mockAccounting.getRawDebit(await bonder.getAddress())
    debit = await mockAccounting.getDebitAndAdditionalDebit(
      await bonder.getAddress()
    )
    expect(credit).to.eq(stakeAmount.mul(3))
    expect(rawDebit).to.eq(stakeAmount.mul(3))
    expect(debit).to.eq(stakeAmount.mul(3))
  })

  /**
   * Non-Happy Path
   */

  it('Should not allow a higher debit than credit', async () => {
    const expectedErrorMsg: string = 'ACT: Not enough available credit'
    const stakeAmount: BigNumber = BigNumber.from(10)

    await expect(
      mockAccounting.connect(bonder).unstake(stakeAmount)
    ).to.be.revertedWith(expectedErrorMsg)
  })

  it('Should not allow someone to stake on a non-bonder address', async () => {
    const expectedErrorMsg: string =
      'VM Exception while processing transaction: revert ACT: Address is not bonder'
    const stakeAmount: BigNumber = BigNumber.from(10)

    await expect(
      mockAccounting.stake(ONE_ADDRESS, stakeAmount)
    ).to.be.revertedWith(expectedErrorMsg)
  })

  it('Should not allow someone to add a bonder that already exists', async () => {
    const expectedErrorMsg: string = 'ACT: Address is already bonder'
    await expect(
      mockAccounting.connect(governance).addBonder(await bonder.getAddress())
    ).to.be.revertedWith(expectedErrorMsg)
  })

  it('Should not allow someone to remove a bonder that does not exists', async () => {
    const expectedErrorMsg: string = 'ACT: Address is not bonder'
    await expect(
      mockAccounting.connect(governance).removeBonder(ONE_ADDRESS)
    ).to.be.revertedWith(expectedErrorMsg)
  })

  it('Should not allow an arbitrary address to add a bonder', async () => {
    // This cannot be tested here, as `_requireIsGovernance()` is virtual in Accounting.sol
  })

  it('Should not allow an arbitrary address to remove a bonder', async () => {
    // This cannot be tested here, as `_requireIsGovernance()` is virtual in Accounting.sol
  })
})
