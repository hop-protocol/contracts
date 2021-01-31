import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber } from 'ethers'

import { setUpDefaults } from '../shared/utils'
import { fixture } from '../shared/fixtures'
import { IFixture } from '../shared/interfaces'

import { expectBalanceOf } from '../../config/utils'
import {
  CHAIN_IDS,
  DEFAULT_AMOUNT_OUT_MIN,
  DEFAULT_DEADLINE,
  USER_INITIAL_BALANCE,
  COMMITTEE_INITIAL_BALANCE 
} from '../../config/constants'

describe("L1_Bridge", () => {
  let _fixture: IFixture
  let l2ChainId: BigNumber

  let user: Signer
  let bonder: Signer

  let l1_canonicalToken: Contract
  let l1_bridge: Contract
  let l2_canonicalToken: Contract
  let l2_bridge: Contract
  let l2_messenger: Contract

  beforeEach(async () => {
    l2ChainId = CHAIN_IDS.OPTIMISM.TESTNET_1
    _fixture = await fixture(l2ChainId)
    await setUpDefaults(_fixture, l2ChainId)

    ;({ 
      user,
      bonder,
      l1_canonicalToken,
      l1_bridge,
      l2_canonicalToken,
      l2_bridge,
      l2_messenger
    } = _fixture);
  })

  /**
   * End to end tests
   */

  it('Should allow bonder to deposit bond and then withdraw bond', async () => {
    await l1_canonicalToken.connect(bonder).approve(l1_bridge.address, COMMITTEE_INITIAL_BALANCE)
    await l1_bridge.connect(bonder).stake(COMMITTEE_INITIAL_BALANCE)
    await l1_bridge.connect(bonder).unstake(COMMITTEE_INITIAL_BALANCE)
  })

  /**
   * Unit tests
   */

  it('Should get the correct chainId', async () => {
    const chainId = await l1_bridge.getChainId()
    const expectedChainId = 1
    expect(chainId).to.eq(expectedChainId)
  })

  it('Should set the collateral token address and the bonder address in the constructor', async () => {
    const collateralTokenAddress = await l1_bridge.l1CanonicalToken()
    const bonderAddress = await l1_bridge.getBonder()
    expect(collateralTokenAddress).to.eq(l1_canonicalToken.address)
    expect(bonderAddress).to.eq(await bonder.getAddress())
  })

  it('Should send tokens across the bridge via sendToL2', async () => {
    const tokenAmount = USER_INITIAL_BALANCE
    await l1_canonicalToken.connect(user).approve(l1_bridge.address, tokenAmount)
    await l1_bridge.connect(user).sendToL2(l2ChainId.toString(), await user.getAddress(), tokenAmount)
    await l2_messenger.relayNextMessage()
    await expectBalanceOf(l2_bridge, user, tokenAmount)
  })

  it('Should send tokens across the bridge and swap via sendToL2AndAttemptSwap', async () => {
    const tokenAmount = USER_INITIAL_BALANCE
    await l1_canonicalToken.connect(user).approve(l1_bridge.address, tokenAmount)
    await l1_bridge.connect(user).sendToL2AndAttemptSwap(
      l2ChainId.toString(),
      await user.getAddress(),
      tokenAmount,
      DEFAULT_AMOUNT_OUT_MIN,
      DEFAULT_DEADLINE
    )
    await l2_messenger.relayNextMessage()

    const amountAfterSlippage = BigNumber.from('332999331997327989311957')
    await expectBalanceOf(l2_canonicalToken, user, amountAfterSlippage)
  })
})