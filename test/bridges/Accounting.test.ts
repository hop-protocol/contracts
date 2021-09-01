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
  let l1_registry: Contract

  let beforeAllSnapshotId: string
  let snapshotId: string

  before(async () => {
    beforeAllSnapshotId = await takeSnapshot()

    l1ChainId = CHAIN_IDS.ETHEREUM.KOVAN
    l2ChainId = CHAIN_IDS.OPTIMISM.OPTIMISM_TESTNET
    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture)
    ;({ bonder, user, governance, otherUser, mockAccounting, l1_registry } = _fixture)
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
    expect(credit).to.eq(0)
    expect(rawDebit).to.eq(0)
    expect(debit).to.eq(0)

    await mockAccounting.stake(await bonder.getAddress(), stakeAmount.mul(2))
    credit = await mockAccounting.getCredit(await bonder.getAddress())
    rawDebit = await mockAccounting.getRawDebit(await bonder.getAddress())
    debit = await mockAccounting.getDebitAndAdditionalDebit(
      await bonder.getAddress()
    )
    expect(credit).to.eq(stakeAmount.mul(2))
    expect(rawDebit).to.eq(0)
    expect(debit).to.eq(0)

    await mockAccounting.connect(bonder).unstake(stakeAmount)
    credit = await mockAccounting.getCredit(await bonder.getAddress())
    rawDebit = await mockAccounting.getRawDebit(await bonder.getAddress())
    debit = await mockAccounting.getDebitAndAdditionalDebit(
      await bonder.getAddress()
    )
    expect(credit).to.eq(stakeAmount)
    expect(rawDebit).to.eq(0)
    expect(debit).to.eq(0)
  })

  it('Should add a bonder, stake to increase the credit with both bonders, and subsequently unstake to increase the debit with both bonders', async () => {
    const otherBonder: Signer = governance
    const stakeAmount: BigNumber = BigNumber.from(10)

    await l1_registry.connect(governance).addBonder(await otherBonder.getAddress())

    await mockAccounting.stake(await bonder.getAddress(), stakeAmount)
    let credit = await mockAccounting.getCredit(await bonder.getAddress())
    let rawDebit = await mockAccounting.getRawDebit(await bonder.getAddress())
    let debit = await mockAccounting.getDebitAndAdditionalDebit(
      await bonder.getAddress()
    )
    expect(credit).to.eq(stakeAmount)
    expect(rawDebit).to.eq(0)
    expect(debit).to.eq(0)

    await mockAccounting.stake(await otherBonder.getAddress(), stakeAmount)
    credit = await mockAccounting.getCredit(await otherBonder.getAddress())
    rawDebit = await mockAccounting.getRawDebit(await otherBonder.getAddress())
    debit = await mockAccounting.getDebitAndAdditionalDebit(
      await otherBonder.getAddress()
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
    expect(credit).to.eq(0)
    expect(rawDebit).to.eq(0)
    expect(debit).to.eq(0)

    await mockAccounting.connect(otherBonder).unstake(stakeAmount)
    credit = await mockAccounting.getCredit(await otherBonder.getAddress())
    rawDebit = await mockAccounting.getRawDebit(await otherBonder.getAddress())
    debit = await mockAccounting.getDebitAndAdditionalDebit(
      await otherBonder.getAddress()
    )
    expect(credit).to.eq(0)
    expect(rawDebit).to.eq(0)
    expect(debit).to.eq(0)
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
    expect(credit).to.eq(0)
    expect(rawDebit).to.eq(0)
    expect(debit).to.eq(0)
  })

  it('Should allow anyone to unstake', async () => {
    const stakeAmount: BigNumber = BigNumber.from(0)

    await mockAccounting.connect(otherUser).unstake(stakeAmount)
  })


  /**
   * Non-Happy Path
   */

  it('Should not allow an arbitrary address to add a bonder', async () => {
    // This cannot be tested here, as `_requireIsGovernance()` is virtual in Accounting.sol
  })

  it('Should not allow an arbitrary address to remove a bonder', async () => {
    // This cannot be tested here, as `_requireIsGovernance()` is virtual in Accounting.sol
  })
})
