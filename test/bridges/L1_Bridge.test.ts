import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber } from 'ethers'
import Transfer from '../../lib/Transfer'
import MerkleTree from '../../lib/MerkleTree'

import { setUpDefaults, expectBalanceOf } from '../shared/utils'
import { fixture } from '../shared/fixtures'
import { IFixture } from '../shared/interfaces'

import {
  CHAIN_IDS,
  DEFAULT_AMOUNT_OUT_MIN,
  DEFAULT_DEADLINE,
  USER_INITIAL_BALANCE,
  BONDER_INITIAL_BALANCE
} from '../../config/constants'

describe("L1_Bridge", () => {
  let _fixture: IFixture
  let l2ChainId: BigNumber

  let user: Signer
  let bonder: Signer
  let relayer: Signer
  let otherUser: Signer

  let l1_canonicalToken: Contract
  let l1_bridge: Contract
  let l1_messenger: Contract
  let l2_canonicalToken: Contract
  let l2_bridge: Contract
  let l2_messenger: Contract
  let l2_uniswapRouter: Contract

  let transfers: Transfer[]

  beforeEach(async () => {
    l2ChainId = CHAIN_IDS.OPTIMISM.TESTNET_1
    _fixture = await fixture(l2ChainId)
    await setUpDefaults(_fixture, l2ChainId)

    ;({ 
      user,
      bonder,
      relayer,
      otherUser,
      l1_canonicalToken,
      l1_bridge,
      l1_messenger,
      l2_canonicalToken,
      l2_bridge,
      l2_messenger,
      l2_uniswapRouter,
      transfers
    } = _fixture);
  })

  /**
   * End to end tests
   */

  it('Should allow bonder to deposit bond and then withdraw bond', async () => {
    await l1_canonicalToken.connect(bonder).approve(l1_bridge.address, BONDER_INITIAL_BALANCE)
    await l1_bridge.connect(bonder).stake(BONDER_INITIAL_BALANCE)
    await l1_bridge.connect(bonder).unstake(BONDER_INITIAL_BALANCE)
  })

  it('Should bond a transfer root when a user sends from L2 to L1 via the canonical messenger', async () => {
    // Set up transfer 
    let transfer: any = transfers[0]
    transfer.chainId = CHAIN_IDS.ETHEREUM.MAINNET
    transfer.amountOutMin = BigNumber.from(0)
    transfer.deadline = BigNumber.from(0)

    // Instantiate a sender and recipient Signer
    const sender: Signer = user
    const recipient: Signer = otherUser
    expect(transfer.sender).to.eq(await sender.getAddress())
    expect(transfer.recipient).to.eq(await recipient.getAddress())

    const senderOriginalBalance: BigNumber = await l1_canonicalToken.balanceOf(await sender.getAddress())
    const recipientOriginalBalance: BigNumber = await l1_canonicalToken.balanceOf(await recipient.getAddress())

    // User moves funds to L2
    await l1_canonicalToken.connect(user).approve(l1_bridge.address, transfer.amount)
    await l1_bridge.connect(user).sendToL2(l2ChainId.toString(), await user.getAddress(), transfer.amount)
    await l2_messenger.relayNextMessage()
    await expectBalanceOf(l2_bridge, user, transfer.amount)

    // User moves funds back to L1 across the liquidity bridge
    await l2_bridge.connect(user).send(
      transfer.chainId,
      transfer.recipient,
      transfer.amount,
      transfer.transferNonce,
      transfer.relayerFee,
      transfer.amountOutMin,
      transfer.deadline
    )

    // User should have less balance now
    await expectBalanceOf(l1_canonicalToken, user, USER_INITIAL_BALANCE.sub(transfer.amount))

    await l2_bridge.commitTransfers()
    await l1_messenger.relayNextMessage()

    await l1_canonicalToken.connect(bonder).approve(l1_bridge.address, BONDER_INITIAL_BALANCE)
    await l1_bridge.connect(bonder).stake(BONDER_INITIAL_BALANCE)

    // Bond the transfer root on L1
    const transfersCommittedEvent = (await l2_bridge.queryFilter(l2_bridge.filters.TransfersCommitted()))[0]
    await l1_bridge.connect(bonder).bondTransferRoot(transfersCommittedEvent.args.root, [CHAIN_IDS.ETHEREUM.MAINNET], [transfer.amount])

    // User withdraws from L1 bridge
    const transferHash: Buffer = transfer.getTransferHash()
    const tree: MerkleTree = new MerkleTree([ transferHash ])
    const transferRootHash: Buffer = tree.getRoot()
    const proof: Buffer[] = tree.getProof(transferHash)

    await l1_bridge.connect(relayer).withdraw(
      transfer.sender,
      transfer.recipient,
      transfer.amount,
      transfer.transferNonce,
      transfer.relayerFee,
      transferRootHash,
      proof
    )

    await expectBalanceOf(l1_canonicalToken, relayer, transfer.relayerFee)
    await expectBalanceOf(l1_canonicalToken, sender, senderOriginalBalance.sub(transfer.amount))
    await expectBalanceOf(l1_canonicalToken, recipient, recipientOriginalBalance.add(transfer.amount).sub(transfer.relayerFee))
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
    const expectedAmounts: BigNumber[] = await l2_uniswapRouter.getAmountsOut(tokenAmount, [l2_canonicalToken.address, l2_bridge.address])
    const expectedAmountAfterSlippage: BigNumber = expectedAmounts[1]

    await l1_canonicalToken.connect(user).approve(l1_bridge.address, tokenAmount)
    await l1_bridge.connect(user).sendToL2AndAttemptSwap(
      l2ChainId.toString(),
      await user.getAddress(),
      tokenAmount,
      DEFAULT_AMOUNT_OUT_MIN,
      DEFAULT_DEADLINE
    )
    await l2_messenger.relayNextMessage()

    await expectBalanceOf(l2_canonicalToken, user, expectedAmountAfterSlippage)
  })

  // TODO: Test extreme relayer fees (0, max)
  // TODO: Test the same recipient
  /**
   * Non-Happy Path
   */

  // require(_chainIds.length == _chainAmounts.length, "L1_BRG: chainIds and chainAmounts must be the same length");
  // require(transferRootConfirmed[_transferRootHash] == false, "L1_BRG: Transfer Root has already been confirmed");
  // require(transferBonds[_transferRootHash].createdAt == 0, "L1_BRG: Transfer Root has already been bonded");

  describe('bondTransferRoot', async () => {
    it('Should not allow a transfer root to be bonded unless it is called by the bonder', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferHash: Buffer = transfer.getTransferHash()
      const tree: MerkleTree = new MerkleTree([ transferHash ])

      await l1_canonicalToken.connect(bonder).approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(transfer.amount)

      const chainIds: BigNumber[] = [CHAIN_IDS.ARBITRUM.TESTNET_3]
      const amounts: BigNumber[] = [BigNumber.from(1)]
      const expectedErrorMsg: string = 'ACT: Caller is not bonder'

      await expect(
        l1_bridge.connect(user).bondTransferRoot(tree.getRoot(), chainIds, amounts)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded that exceeds the committee bond', async () => {
      // TODO - Error: Transaction reverted: function call to a non-contract accoun
      // let transfer: any = transfers[0]

      // // User withdraws from L1 bridge
      // const transferHash: Buffer = transfer.getTransferHash()
      // const tree: MerkleTree = new MerkleTree([ transferHash ])

      // await l1_canonicalToken.connect(bonder).approve(l1_bridge.address, transfer.amount)
      // await l1_bridge.connect(bonder).stake(BigNumber.from(1))

      // const chainIds: BigNumber[] = [CHAIN_IDS.ARBITRUM.TESTNET_3]
      // const amounts: BigNumber[] = [BigNumber.from(1)]
      // const expectedErrorMsg: string = 'ACT: Not enough available credit'

      // await expect(
      //   l1_bridge.connect(bonder).bondTransferRoot(transfersCommittedEvent.args.root, chainIds, amounts)
      // ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the chainIds and amounts are of different length', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferHash: Buffer = transfer.getTransferHash()
      const tree: MerkleTree = new MerkleTree([ transferHash ])

      await l1_canonicalToken.connect(bonder).approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(transfer.amount)

      const chainIds: BigNumber[] = [CHAIN_IDS.ARBITRUM.TESTNET_3]
      const amounts: BigNumber[] = [BigNumber.from(1), BigNumber.from(2)]
      const expectedErrorMsg: string = 'L1_BRG: chainIds and chainAmounts must be the same length'

      await expect(
        l1_bridge.connect(bonder).bondTransferRoot(tree.getRoot(), chainIds, amounts)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root has already been confirmed', async () => {
      // TODO: Error: Transaction reverted: function call to a non-contract account
      // let transfer: any = transfers[0]

      // // User withdraws from L1 bridge
      // const transferHash: Buffer = transfer.getTransferHash()
      // const tree: MerkleTree = new MerkleTree([ transferHash ])

      // await l1_canonicalToken.connect(bonder).approve(l1_bridge.address, transfer.amount)
      // await l1_bridge.connect(bonder).stake(transfer.amount)

      // const chainIds: BigNumber[] = [CHAIN_IDS.ARBITRUM.TESTNET_3]
      // const amounts: BigNumber[] = [BigNumber.from(1)]
      // const expectedErrorMsg: string = 'L1_BRG: Transfer Root has already been confirmed'

      // await expect(
      //   l1_bridge.connect(bonder).bondTransferRoot(tree.getRoot(), chainIds, amounts)
      // ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root has already been bonded', async () => {
      // const expectedErrorMsg: string = 'L1_BRG: Transfer Root has already been bonded'
      // TODO
    })

    it('Should not allow a transfer root to be bonded if the transfer root was already set', async () => {
      // const expectedErrorMsg: string = 'BRG: Transfer root already set
      // TODO -- might be covered by "...if the transfer root has already been confirmed"
    })

    it('Should not allow a transfer root to be bonded if the the transfer root amount is 0', async () => {
      // const expectedErrorMsg: string = 'BRG: Cannot set TransferRoot amount of 0'
      // TODO
      // TODO x2 -- try this with an array where only a one element of the array is 0
    })
  })

  // it('Should not allow a transfer root that exceeds the committee bond', async () => {
  //   let transfer: any = transfers[0]

  //   // User withdraws from L1 bridge
  //   const tree = new MerkleTree([ transfer.getTransferHash() ])

  //   await l1_poolToken.connect(committee).approve(l1_bridge.address, '1')
  //   await l1_bridge.connect(committee).stake('1')

  //   await expect(
  //     l1_bridge.connect(committee).bondTransferRoot(tree.getRoot(), transfer.amount)
  //   ).to.be.reverted
  // })

  // it('Should successfully challenge a malicious transfer root', async () => {
  //   const transfer = new Transfer({
  //     chainId: MAINNET_CHAIN_ID,
  //     sender: await user.getAddress(),
  //     recipient: await user.getAddress(),
  //     amount: BigNumber.from('100'),
  //     transferNonce: 0,
  //     relayerFee: BigNumber.from('0'),
  //     amountOutMin: BigNumber.from('0'),
  //     deadline: BigNumber.from('0')
  //   })

  //   // User withdraws from L1 bridge
  //   const tree = new MerkleTree([ transfer.getTransferHash() ])

  //   await l1_poolToken.connect(committee).approve(l1_bridge.address, LIQUIDITY_PROVIDER_INITIAL_BALANCE)
  //   await l1_bridge.connect(committee).stake(LIQUIDITY_PROVIDER_INITIAL_BALANCE)

  //   await l1_bridge.connect(committee).bondTransferRoot(tree.getRoot(), [transfer.chainId], [transfer.amount])

  //   await l1_poolToken.connect(challenger).approve(l1_bridge.address, BigNumber.from('10'))
  //   await l1_bridge.connect(challenger).challengeTransferBond(tree.getRoot())

  //   await ethers.provider.send("evm_increaseTime", [60 * 60 * 24 * 9]) // 9 days

  //   await l1_bridge.connect(challenger).resolveChallenge(tree.getRoot())
  // })
})