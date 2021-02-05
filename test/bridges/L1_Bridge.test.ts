import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber } from 'ethers'
import Transfer from '../../lib/Transfer'
import MerkleTree from '../../lib/MerkleTree'

import { setUpDefaults, expectBalanceOf, increaseTime } from '../shared/utils'
import { fixture } from '../shared/fixtures'
import { IFixture } from '../shared/interfaces'

import {
  CHAIN_IDS,
  DEFAULT_AMOUNT_OUT_MIN,
  DEFAULT_DEADLINE,
  USER_INITIAL_BALANCE,
  BONDER_INITIAL_BALANCE,
  CHALLENGER_INITIAL_BALANCE,
  ZERO_ADDRESS
} from '../../config/constants'

describe('L1_Bridge', () => {
  let _fixture: IFixture
  let l2ChainId: BigNumber

  let user: Signer
  let bonder: Signer
  let relayer: Signer
  let challenger: Signer
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
      challenger,
      otherUser,
      l1_canonicalToken,
      l1_bridge,
      l1_messenger,
      l2_canonicalToken,
      l2_bridge,
      l2_messenger,
      l2_uniswapRouter,
      transfers
    } = _fixture)
  })

  /**
   * End to end tests
   */

  it('Should allow bonder to deposit bond and then withdraw bond', async () => {
    await l1_canonicalToken
      .connect(bonder)
      .approve(l1_bridge.address, BONDER_INITIAL_BALANCE)
    await l1_bridge.connect(bonder).stake(BONDER_INITIAL_BALANCE)
    await l1_bridge.connect(bonder).unstake(BONDER_INITIAL_BALANCE)
  })

  it.only('Should bond a transfer root when a user sends from L2 to L1 via the canonical messenger', async () => {
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

    const senderOriginalBalance: BigNumber = await l1_canonicalToken.balanceOf(
      await sender.getAddress()
    )
    const recipientOriginalBalance: BigNumber = await l1_canonicalToken.balanceOf(
      await recipient.getAddress()
    )

    // User moves funds to L2
    await l1_canonicalToken
      .connect(user)
      .approve(l1_bridge.address, transfer.amount)
    await l1_bridge
      .connect(user)
      .sendToL2(l2ChainId.toString(), await user.getAddress(), transfer.amount)
    await l2_messenger.relayNextMessage()
    await expectBalanceOf(l2_bridge, user, transfer.amount)

    // User moves funds back to L1 across the liquidity bridge
    await l2_bridge
      .connect(user)
      .send(
        transfer.chainId,
        transfer.recipient,
        transfer.amount,
        transfer.transferNonce,
        transfer.relayerFee,
        transfer.amountOutMin,
        transfer.deadline
      )

    // User should have less balance now
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      USER_INITIAL_BALANCE.sub(transfer.amount)
    )

    await l2_bridge.commitTransfers()
    await l1_messenger.relayNextMessage()

    await l1_canonicalToken
      .connect(bonder)
      .approve(l1_bridge.address, BONDER_INITIAL_BALANCE)
    await l1_bridge.connect(bonder).stake(BONDER_INITIAL_BALANCE)

    console.log(
      await l1_bridge.getCrossDomainMessengerWrapper(
        CHAIN_IDS.ARBITRUM.TESTNET_3
      )
    )
    // Bond the transfer root on L1
    // TODO: I do not believe this will work when `_sendCrossDomainMessage()` on L2_Bridge is implemented
    const transfersCommittedEvent = (
      await l2_bridge.queryFilter(l2_bridge.filters.TransfersCommitted())
    )[0]
    // await l1_bridge.connect(bonder).bondTransferRoot(transfersCommittedEvent.args.root, [CHAIN_IDS.ETHEREUM.MAINNET], [transfer.amount])
    await l1_bridge
      .connect(bonder)
      .bondTransferRoot(
        transfersCommittedEvent.args.root,
        [CHAIN_IDS.ARBITRUM.TESTNET_3],
        [transfer.amount]
      )

    // User withdraws from L1 bridge
    const transferHash: Buffer = transfer.getTransferHash()
    const tree: MerkleTree = new MerkleTree([transferHash])
    const transferRootHash: Buffer = tree.getRoot()
    const proof: Buffer[] = tree.getProof(transferHash)

    await l1_bridge
      .connect(relayer)
      .withdraw(
        transfer.sender,
        transfer.recipient,
        transfer.amount,
        transfer.transferNonce,
        transfer.relayerFee,
        transferRootHash,
        proof
      )

    await expectBalanceOf(l1_canonicalToken, relayer, transfer.relayerFee)
    await expectBalanceOf(
      l1_canonicalToken,
      sender,
      senderOriginalBalance.sub(transfer.amount)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      recipient,
      recipientOriginalBalance.add(transfer.amount).sub(transfer.relayerFee)
    )
  })

  it('Should send a transaction on L2 and confirm an already bonded transfer root on L1', async () => {
    // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
  })

  it('Should send a transaction on L2 and confirm a not-yet-bonded transfer root on L1', async () => {
    // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
  })

  it('Should challenge a malicious transfer root', async () => {
    let transfer: any = transfers[0]
    transfer.chainId = CHAIN_IDS.OPTIMISM.TESTNET_1

    // Set up test params
    const expectedChallengeStartTime: number = Date.now()
    const expectedCreatedAtTime: number = expectedChallengeStartTime

    // Bonder stakes assets
    await l1_canonicalToken
      .connect(bonder)
      .approve(l1_bridge.address, BONDER_INITIAL_BALANCE)
    await l1_bridge.connect(bonder).stake(BONDER_INITIAL_BALANCE)

    // Set up transfer root
    const transferHash: Buffer = transfer.getTransferHash()
    const tree: MerkleTree = new MerkleTree([transferHash])
    const transferRootHash: Buffer = tree.getRoot()

    // Bonder bonds transfer root
    const chainIds: BigNumber[] = [transfer.chainId]
    const amounts: BigNumber[] = [transfer.amount]
    await l1_bridge
      .connect(bonder)
      .bondTransferRoot(transferRootHash, chainIds, amounts)

    // Get current debit
    const originalDebit = await l1_bridge.getDebit()

    // Challenger challenges transfer bond
    const challengeAmount: BigNumber = l1_bridge.getChallengeAmountForTransferAmount(
      transfer.amount
    )
    await l1_canonicalToken
      .connect(challenger)
      .approve(l1_bridge.address, challengeAmount)
    await l1_bridge.connect(challenger).challengeTransferBond(transferRootHash)

    // Validate balances
    // TODO: This requires the L2 Bridge to confirm the transfer, or else the transfer will have a total of 0
    // await expectBalanceOf(l1_canonicalToken, challenger, CHALLENGER_INITIAL_BALANCE.sub(transfer.amount))

    // Validate transfer bond
    const transferBond = await l1_bridge.transferBonds(transferRootHash)
    const amountHash = await l1_bridge.getAmountHash(chainIds, amounts)

    expect(transferBond[0].mul(1000).toNumber()).to.be.closeTo(
      expectedChallengeStartTime,
      1000000
    )
    expect(transferBond[1]).to.eq(amountHash)
    expect(transferBond[2]).to.eq(false)
    expect(transferBond[3].mul(1000).toNumber()).to.be.closeTo(
      expectedCreatedAtTime,
      1000000
    )
    expect(transferBond[4]).to.eq(await challenger.getAddress())

    // Validate time slot bond
    // TODO: Validate the time slot
    // const bondAmount: BigNumber = await l1_bridge.getBondForTransferAmount(transfer.amount)
    // const timeSlot: BigNumber = await l1_bridge.getTimeSlot(expectedChallengeStartTime)
    // const newTimeSlotToAmountBonded: BigNumber = await l1_bridge.timeSlotToAmountBonded(timeSlot)
    // expect(originalTimeSlotToAmountBonded).to.eq(newTimeSlotToAmountBonded.add(bondAmount))

    // Validate accounting
    // TODO: Validate the accounting
    // const newDebit = await l1_bridge.getDebit()
    // expect(originalDebit).to.eq(newDebit.sub(bondAmount))
  })

  it('Should successfully challenge a malicious transfer root', async () => {
    let transfer: any = transfers[0]
    transfer.chainId = CHAIN_IDS.OPTIMISM.TESTNET_1

    // User withdraws from L1 bridge
    const tree = new MerkleTree([transfer.getTransferHash()])

    // Bonder stakes assets
    await l1_canonicalToken
      .connect(bonder)
      .approve(l1_bridge.address, BONDER_INITIAL_BALANCE)
    await l1_bridge.connect(bonder).stake(BONDER_INITIAL_BALANCE)

    // Bonder bonds transfer root
    const chainIds: BigNumber[] = [transfer.chainId]
    const amounts: BigNumber[] = [transfer.amount]
    await l1_bridge
      .connect(bonder)
      .bondTransferRoot(tree.getRoot(), chainIds, amounts)

    // Challenger challenges transfer bond
    await l1_canonicalToken
      .connect(challenger)
      .approve(l1_bridge.address, transfer.amount)
    await l1_bridge.connect(challenger).challengeTransferBond(tree.getRoot())
    const numDaysToWait: number = 9
    await increaseTime(numDaysToWait)

    await l1_bridge.connect(challenger).resolveChallenge(tree.getRoot())

    // TODO: Validate all state
  })

  it('Should unsuccessfully challenge a malicious transfer root', async () => {
    // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
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
    await l1_canonicalToken
      .connect(user)
      .approve(l1_bridge.address, tokenAmount)
    await l1_bridge
      .connect(user)
      .sendToL2(l2ChainId.toString(), await user.getAddress(), tokenAmount)
    await l2_messenger.relayNextMessage()
    await expectBalanceOf(l2_bridge, user, tokenAmount)
  })

  it('Should send tokens across the bridge and swap via sendToL2AndAttemptSwap', async () => {
    const tokenAmount = USER_INITIAL_BALANCE
    const expectedAmounts: BigNumber[] = await l2_uniswapRouter.getAmountsOut(
      tokenAmount,
      [l2_canonicalToken.address, l2_bridge.address]
    )
    const expectedAmountAfterSlippage: BigNumber = expectedAmounts[1]

    await l1_canonicalToken
      .connect(user)
      .approve(l1_bridge.address, tokenAmount)
    await l1_bridge
      .connect(user)
      .sendToL2AndAttemptSwap(
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

  describe('bondTransferRoot', async () => {
    it('Should not allow a transfer root to be bonded unless it is called by the bonder', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferHash: Buffer = transfer.getTransferHash()
      const tree: MerkleTree = new MerkleTree([transferHash])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(transfer.amount)

      const chainIds: BigNumber[] = [CHAIN_IDS.ARBITRUM.TESTNET_3]
      const amounts: BigNumber[] = [BigNumber.from(1)]
      const expectedErrorMsg: string = 'ACT: Caller is not bonder'

      await expect(
        l1_bridge
          .connect(user)
          .bondTransferRoot(tree.getRoot(), chainIds, amounts)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded that exceeds the committee bond', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferHash: Buffer = transfer.getTransferHash()
      const tree: MerkleTree = new MerkleTree([transferHash])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(BigNumber.from(1))

      const chainIds: BigNumber[] = [CHAIN_IDS.OPTIMISM.TESTNET_1]
      const amounts: BigNumber[] = [BONDER_INITIAL_BALANCE.mul(2)]
      const expectedErrorMsg: string = 'ACT: Not enough available credit'

      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainIds, amounts)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the chainIds and amounts are of different length', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferHash: Buffer = transfer.getTransferHash()
      const tree: MerkleTree = new MerkleTree([transferHash])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(transfer.amount)

      const chainIds: BigNumber[] = [CHAIN_IDS.ARBITRUM.TESTNET_3]
      const amounts: BigNumber[] = [BigNumber.from(1), BigNumber.from(2)]
      const expectedErrorMsg: string =
        'L1_BRG: chainIds and chainAmounts must be the same length'

      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainIds, amounts)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root has already been confirmed', async () => {
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

      // User moves funds to L2
      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge
        .connect(user)
        .sendToL2(
          l2ChainId.toString(),
          await user.getAddress(),
          transfer.amount
        )
      await l2_messenger.relayNextMessage()
      await expectBalanceOf(l2_bridge, user, transfer.amount)

      // User moves funds back to L1 across the liquidity bridge
      await l2_bridge
        .connect(user)
        .send(
          transfer.chainId,
          transfer.recipient,
          transfer.amount,
          transfer.transferNonce,
          transfer.relayerFee,
          transfer.amountOutMin,
          transfer.deadline
        )

      // User should have less balance now
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        USER_INITIAL_BALANCE.sub(transfer.amount)
      )

      await l2_bridge.commitTransfers()
      await l1_messenger.relayNextMessage()

      // User withdraws from L1 bridge
      const transferHash: Buffer = transfer.getTransferHash()
      const tree: MerkleTree = new MerkleTree([transferHash])
      const transferRootHash: Buffer = tree.getRoot()
      const proof: Buffer[] = tree.getProof(transferHash)

      // TODO: Uncomment this when _sendCrossDomainMessage on L2_Bridge is implemented
      // const chainIds: BigNumber[] = [CHAIN_IDS.OPTIMISM.TESTNET_1]
      // const amounts: BigNumber[] = [BigNumber.from(1)]
      // const expectedErrorMsg: string = 'L1_BRG: Transfer Root has already been confirmed'

      // await expect(
      //   l1_bridge.connect(bonder).bondTransferRoot(tree.getRoot(), chainIds, amounts)
      // ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root has already been bonded', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferHash: Buffer = transfer.getTransferHash()
      const tree: MerkleTree = new MerkleTree([transferHash])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(BigNumber.from(1))

      const chainIds: BigNumber[] = [CHAIN_IDS.OPTIMISM.TESTNET_1]
      const amounts: BigNumber[] = [BigNumber.from(1)]
      const expectedErrorMsg: string =
        'L1_BRG: Transfer Root has already been bonded'

      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(tree.getRoot(), chainIds, amounts)
      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainIds, amounts)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root was already set', async () => {
      // This is not possible, as the only way to get to this code on the L1_Bridge would be to bond the same
      // mainnet transfer root twice, however this will be blocked by the bond reuse check prior to execution here
    })

    it('Should not allow a transfer root to be bonded if a mainnet transfer root amount is 0', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferHash: Buffer = transfer.getTransferHash()
      const tree: MerkleTree = new MerkleTree([transferHash])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(BigNumber.from(1))

      const chainIds: BigNumber[] = [CHAIN_IDS.ETHEREUM.MAINNET]
      const amounts: BigNumber[] = [BigNumber.from(0)]
      const expectedErrorMsg: string =
        'BRG: Cannot set TransferRoot amount of 0'

      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainIds, amounts)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if any of amounts in a mainnet transfer root amount array is 0', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferHash: Buffer = transfer.getTransferHash()
      const tree: MerkleTree = new MerkleTree([transferHash])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(BigNumber.from(1))

      const chainIds: BigNumber[] = [
        CHAIN_IDS.OPTIMISM.TESTNET_1,
        CHAIN_IDS.ETHEREUM.MAINNET
      ]
      const amounts: BigNumber[] = [BigNumber.from(1), BigNumber.from(0)]
      const expectedErrorMsg: string =
        'BRG: Cannot set TransferRoot amount of 0'

      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainIds, amounts)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the the messenger wrapper is not set', async () => {
      let transfer: any = transfers[0]

      // Unset messenger wrapper address
      await l1_bridge.setCrossDomainMessengerWrapper(
        CHAIN_IDS.OPTIMISM.TESTNET_1,
        ZERO_ADDRESS
      )

      // User withdraws from L1 bridge
      const transferHash: Buffer = transfer.getTransferHash()
      const tree: MerkleTree = new MerkleTree([transferHash])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(BigNumber.from(1))

      const chainIds: BigNumber[] = [CHAIN_IDS.OPTIMISM.TESTNET_1]
      const amounts: BigNumber[] = [BigNumber.from(1)]
      const expectedErrorMsg: string =
        'Transaction reverted: function call to a non-contract account'

      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainIds, amounts)
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('confirmTransferRoot', async () => {
    it('Should not allow a transfer root to be confirmed by anybody except the L2_Bridge', async () => {
      let transfer: any = transfers[0]

      const transferHash: Buffer = transfer.getTransferHash()
      const tree: MerkleTree = new MerkleTree([transferHash])

      const chainIds: BigNumber[] = [CHAIN_IDS.OPTIMISM.TESTNET_1]
      const amounts: BigNumber[] = [BigNumber.from(1)]
      const expectedErrorMsg: string = 'TODO'

      // TODO: Uncomment this when the `onlyL2Bridge` modifier has been implemented
      // await expect(
      //   l1_bridge.connect(bonder).confirmTransferRoot(tree.getRoot(), chainIds, amounts)
      // ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be confirmed if it was already confirmed', async () => {
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })

    it('Should not allow a transfer root to be confirmed if the transfer root was already set', async () => {
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })

    it('Should not allow a transfer root to be confirmed if a mainnet transfer root amount is 0', async () => {
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })

    it('Should not allow a transfer root to be confirmed if the chainIds and chainAmounts do not match the values coming from the L2 bridge', async () => {
      // const expectedErrorMsg: string = 'L1_BRG: Amount hash is invalid'
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })
  })

  describe('challengeTransferRoot', async () => {
    it('Should not allow a transfer root to be challenged if the transfer root has already been confirmed', async () => {
      // const expectedErrorMsg: string = 'L1_BRG: Transfer root has already been confirmed'
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })

    it('Should not allow a transfer root to be challenged if the transfer root has already been confirmed', async () => {
      // const expectedErrorMsg: string = 'L1_BRG: Transfer root cannot be challenged after challenge period'
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })

    it('Should not allow a transfer root to be challenged if the challenger does not have enough tokens to challenge with', async () => {
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })
  })

  describe('resolveChallenge', async () => {
    it('Should not allow a transfer root challenge to be resolved if the transfer root was never challenged', async () => {
      // const expectedErrorMsg: string = 'L1_BRG: Transfer root has not been challenged'
      // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
    })

    it('Should not allow a transfer root challenge to be resolved if the transfer root challenge period is not over', async () => {
      let transfer: any = transfers[0]
      transfer.chainId = CHAIN_IDS.OPTIMISM.TESTNET_1

      // User withdraws from L1 bridge
      const tree = new MerkleTree([transfer.getTransferHash()])

      // Bonder stakes assets
      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, BONDER_INITIAL_BALANCE)
      await l1_bridge.connect(bonder).stake(BONDER_INITIAL_BALANCE)

      // Bonder bonds transfer root
      const chainIds: BigNumber[] = [transfer.chainId]
      const amounts: BigNumber[] = [transfer.amount]
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(tree.getRoot(), chainIds, amounts)

      // Challenger challenges transfer bond
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(challenger).challengeTransferBond(tree.getRoot())

      const expectedErrorMsg: string = 'L1_BRG: Challenge period has not ended'
      await expect(
        l1_bridge.connect(challenger).resolveChallenge(tree.getRoot())
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  // TODO: Edge cases
})
