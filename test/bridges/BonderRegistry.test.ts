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
  let governance: Signer

  let l1_registry: Contract

  let beforeAllSnapshotId: string
  let snapshotId: string

  const bonderCredit = BigNumber.from(0);

  before(async () => {
    beforeAllSnapshotId = await takeSnapshot()

    l1ChainId = CHAIN_IDS.ETHEREUM.KOVAN
    l2ChainId = CHAIN_IDS.OPTIMISM.OPTIMISM_TESTNET
    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture)
    ;({ bonder, governance, l1_registry } = _fixture)
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
    const isBonder = await l1_registry.isBonderAllowed(await bonder.getAddress(), bonderCredit)
    expect(true).to.eq(isBonder)
  })

  it('Should add a new bonder', async () => {
    let isBonder: boolean = await l1_registry.isBonderAllowed(ONE_ADDRESS, bonderCredit)
    expect(isBonder).to.eq(false)

    await l1_registry.connect(governance).addBonder(ONE_ADDRESS)

    isBonder = await l1_registry.isBonderAllowed(ONE_ADDRESS, bonderCredit)
    expect(isBonder).to.eq(true)
  })

  it('Should add a new bonder then remove them', async () => {
    let isBonder: boolean = await l1_registry.isBonderAllowed(ONE_ADDRESS, bonderCredit)
    expect(isBonder).to.eq(false)

    await l1_registry.connect(governance).addBonder(ONE_ADDRESS)

    isBonder = await l1_registry.isBonderAllowed(ONE_ADDRESS, bonderCredit)
    expect(isBonder).to.eq(true)

    await l1_registry.connect(governance).removeBonder(ONE_ADDRESS)

    isBonder = await l1_registry.isBonderAllowed(ONE_ADDRESS, bonderCredit)
    expect(isBonder).to.eq(false)
  })

  it('Should not allow someone to add a bonder that already exists', async () => {
    const expectedErrorMsg: string = 'BR: Address is already bonder'
    await expect(
      l1_registry.connect(governance).addBonder(await bonder.getAddress())
    ).to.be.revertedWith(expectedErrorMsg)
  })

  it('Should not allow someone to remove a bonder that does not exists', async () => {
    const expectedErrorMsg: string = 'BR: Address is not bonder'
    await expect(
      l1_registry.connect(governance).removeBonder(ONE_ADDRESS)
    ).to.be.revertedWith(expectedErrorMsg)
  })
})
