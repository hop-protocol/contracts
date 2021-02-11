import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber } from 'ethers'
import Transfer from '../../lib/Transfer'
import MerkleTree from '../../lib/MerkleTree'

import {
  setUpDefaults,
  expectBalanceOf,
  getTransferRootId,
  increaseTime,
  revertSnapshot,
  takeSnapshot
} from '../shared/utils'
import { fixture } from '../shared/fixtures'
import { IFixture } from '../shared/interfaces'

import {
  CHAIN_IDS,
  DEFAULT_AMOUNT_OUT_MIN,
  DEFAULT_DEADLINE,
  USER_INITIAL_BALANCE,
  BONDER_INITIAL_BALANCE,
  INITIAL_BONDED_AMOUNT,
  CHALLENGER_INITIAL_BALANCE,
  ZERO_ADDRESS,
  SECONDS_IN_A_DAY
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

  let beforeAllSnapshotId: string
  let snapshotId: string

  before(async () => {
    beforeAllSnapshotId = await takeSnapshot()

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

  after(async() => {
    await revertSnapshot(beforeAllSnapshotId)
  })

  // Take snapshot before each test and revert after each test
  beforeEach(async() => {
    snapshotId = await takeSnapshot()
  })

  afterEach(async() => {
    await revertSnapshot(snapshotId)
  })

  /**
   * End to end tests
   */

  it('Should allow bonder to stake and unstake', async () => {
    const bondAmount: BigNumber = BigNumber.from('100')
    await l1_canonicalToken
      .connect(bonder)
      .approve(l1_bridge.address, bondAmount)
    await l1_bridge.connect(bonder).stake(bondAmount)
    await l1_bridge.connect(bonder).unstake(bondAmount)
  })

  it('Should allow a user to send from L2 to L1 and perform a bonded withdrawal', async () => {
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
      .sendToL2(l2ChainId.toString(), await user.getAddress(), transfer.amount)
    await l2_messenger.relayNextMessage()

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      USER_INITIAL_BALANCE.sub(transfer.amount)
    )
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

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      USER_INITIAL_BALANCE.sub(transfer.amount)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      otherUser,
      0
    )
    await expectBalanceOf(l2_bridge, user, 0)

    await l1_bridge
      .connect(bonder)
      .bondWithdrawal(
        transfer.sender,
        transfer.recipient,
        transfer.amount,
        transfer.transferNonce,
        transfer.relayerFee
      )

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      USER_INITIAL_BALANCE.sub(transfer.amount)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      otherUser,
      transfer.amount.sub(transfer.relayerFee)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      bonder,
      BONDER_INITIAL_BALANCE.sub(INITIAL_BONDED_AMOUNT).add(transfer.relayerFee)
    )
  })

  it('Should send a transaction from L2 to L1, perform a bonded withdrawal, and confirm an already bonded transfer root on L1', async () => {
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
      .sendToL2(l2ChainId.toString(), await user.getAddress(), transfer.amount)
    await l2_messenger.relayNextMessage()

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      USER_INITIAL_BALANCE.sub(transfer.amount)
    )
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

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      USER_INITIAL_BALANCE.sub(transfer.amount)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      otherUser,
      0
    )
    await expectBalanceOf(l2_bridge, user, 0)

    await l1_bridge
      .connect(bonder)
      .bondWithdrawal(
        transfer.sender,
        transfer.recipient,
        transfer.amount,
        transfer.transferNonce,
        transfer.relayerFee
      )

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      USER_INITIAL_BALANCE.sub(transfer.amount)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      otherUser,
      transfer.amount.sub(transfer.relayerFee)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      bonder,
      BONDER_INITIAL_BALANCE.sub(INITIAL_BONDED_AMOUNT).add(transfer.relayerFee)
    )

    // Bonder commits transfers
    await l2_bridge
      .connect(bonder)
      .commitTransfers(transfer.chainId)

    // Set up transfer root
    const transferId: Buffer = transfer.getTransferId()
    const tree: MerkleTree = new MerkleTree([transferId])
    const rootHash: Buffer = tree.getRoot()
    const proof: Buffer[] = tree.getProof(transferId)

    // Bonder bonds the transfer root
    await l1_bridge
      .connect(bonder)
      .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)


    // Bonder settles withdrawals
    await l1_bridge
      .connect(bonder)
      .settleBondedWithdrawals([ transferId ])

    // Message gets relayed to L1 and bonder confirms the transfer root
    await l1_messenger.relayNextMessage()
    await l1_bridge
      .connect(bonder)
      .confirmTransferRoot(rootHash, transfer.chainId, transfer.amount)


      
  })

  it('Should send a transaction from L2 to L1 and confirm a not-yet-bonded transfer root on L1', async () => {
    // TODO -- wait until `L2_Bridge._sendCrossDomainMessage()` is implemented
  })

  it('Should challenge a malicious transfer root', async () => {
    let transfer: any = transfers[0]
    transfer.chainId = CHAIN_IDS.OPTIMISM.TESTNET_1

    // Set up test params
    const expectedChallengeStartTime: number = Date.now()
    const expectedCreatedAtTime: number = expectedChallengeStartTime

    // Set up transfer root
    const transferId: Buffer = transfer.getTransferId()
    const tree: MerkleTree = new MerkleTree([transferId])
    const rootHash: Buffer = tree.getRoot()
    const rootHashHex: string = tree.getHexRoot()

    // Bonder bonds transfer root
    const chainId: BigNumber = transfer.chainId
    const amount: BigNumber = transfer.amount
    await l1_bridge
      .connect(bonder)
      .bondTransferRoot(rootHash, chainId, amount)

    // Get current debit
    const originalDebit = await l1_bridge.getDebit()

    // Challenger challenges transfer bond
    const challengeAmount: BigNumber = l1_bridge.getChallengeAmountForTransferAmount(
      transfer.amount
    )
    await l1_canonicalToken
      .connect(challenger)
      .approve(l1_bridge.address, challengeAmount)
    await l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)

    // Validate balances
    // TODO: This requires the L2 Bridge to confirm the transfer, or else the transfer will have a total of 0
    // await expectBalanceOf(l1_canonicalToken, challenger, CHALLENGER_INITIAL_BALANCE.sub(transfer.amount))

    // Validate transfer bond
    const transferRootId: string = await getTransferRootId(rootHashHex, transfer.amount)
    const transferBond = await l1_bridge.transferBonds(transferRootId)

    expect(transferBond[0].mul(1000).toNumber()).to.be.closeTo(
      expectedChallengeStartTime,
      1000000
    )
    expect(transferBond[1]).to.eq(transfer.amount)
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
    const tree = new MerkleTree([transfer.getTransferId()])

    // Bonder bonds transfer root
    const chainId: BigNumber = transfer.chainId
    const amount: BigNumber = transfer.amount
    await l1_bridge
      .connect(bonder)
      .bondTransferRoot(tree.getRoot(), chainId, amount)

    // Challenger challenges transfer bond
    await l1_canonicalToken
      .connect(challenger)
      .approve(l1_bridge.address, transfer.amount)
    await l1_bridge.connect(challenger).challengeTransferBond(tree.getRoot(), transfer.amount)
    const numDaysToWait: number = 9 * SECONDS_IN_A_DAY
    await increaseTime(numDaysToWait)

    await l1_bridge.connect(challenger).resolveChallenge(tree.getRoot(), transfer.amount)

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
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      const chainId: BigNumber = CHAIN_IDS.ARBITRUM.TESTNET_3
      const amount: BigNumber = BigNumber.from(1)
      const expectedErrorMsg: string = 'ACT: Caller is not bonder'

      await expect(
        l1_bridge
          .connect(user)
          .bondTransferRoot(tree.getRoot(), chainId, amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded that exceeds the committee bond', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(BigNumber.from(1))

      const chainId: BigNumber = CHAIN_IDS.OPTIMISM.TESTNET_1
      const amount: BigNumber = BONDER_INITIAL_BALANCE.mul(2)
      const expectedErrorMsg: string = 'ACT: Not enough available credit'

      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainId, amount)
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

      await l2_bridge.commitTransfers(transfer.chainId)
      await l1_messenger.relayNextMessage()

      // User withdraws from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])
      const rootHash: Buffer = tree.getRoot()
      const proof: Buffer[] = tree.getProof(transferId)

      // TODO: Uncomment this when _sendCrossDomainMessage on L2_Bridge is implemented
      // const chainId: BigNumber = CHAIN_IDS.OPTIMISM.TESTNET_1
      // const amount: BigNumber = BigNumber.from(1)
      // const expectedErrorMsg: string = 'L1_BRG: Transfer Root has already been confirmed'

      // await expect(
      //   l1_bridge.connect(bonder).bondTransferRoot(tree.getRoot(), chainId, amount)
      // ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root has already been bonded', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(BigNumber.from(1))

      const chainId: BigNumber = CHAIN_IDS.OPTIMISM.TESTNET_1
      const amount: BigNumber = BigNumber.from(1)
      const expectedErrorMsg: string =
        'L1_BRG: Transfer Root has already been bonded'

      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(tree.getRoot(), chainId, amount)
      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainId, amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root was already set', async () => {
      // This is not possible, as the only way to get to this code on the L1_Bridge would be to bond the same
      // mainnet transfer root twice, however this will be blocked by the bond reuse check prior to execution here
    })

    it('Should not allow a transfer root to be bonded if a mainnet transfer root amount is 0', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(BigNumber.from(1))

      const chainId: BigNumber = CHAIN_IDS.ETHEREUM.MAINNET
      const amount: BigNumber = BigNumber.from(0)
      const expectedErrorMsg: string =
        'BRG: Cannot set TransferRoot amount of 0'

      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainId, amount)
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
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(BigNumber.from(1))

      const chainId: BigNumber = CHAIN_IDS.OPTIMISM.TESTNET_1
      const amount: BigNumber = BigNumber.from(1)
      const expectedErrorMsg: string =
        'Transaction reverted: function call to a non-contract account'

      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainId, amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('confirmTransferRoot', async () => {
    it('Should not allow a transfer root to be confirmed by anybody except the L2_Bridge', async () => {
      let transfer: any = transfers[0]

      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      const chainId: BigNumber = CHAIN_IDS.OPTIMISM.TESTNET_1
      const amount: BigNumber = BigNumber.from(1)
      const expectedErrorMsg: string = 'TODO'

      // TODO: Uncomment this when the `onlyL2Bridge` modifier has been implemented
      // await expect(
      //   l1_bridge.connect(bonder).confirmTransferRoot(tree.getRoot(), chainId, amount)
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
      const tree = new MerkleTree([transfer.getTransferId()])

      // Bonder bonds transfer root
      const chainId: BigNumber = transfer.chainId
      const amount: BigNumber = transfer.amount
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(tree.getRoot(), chainId, amount)

      // Challenger challenges transfer bond
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(challenger).challengeTransferBond(tree.getRoot(), transfer.amount)

      const expectedErrorMsg: string = 'L1_BRG: Challenge period has not ended'
      await expect(
        l1_bridge.connect(challenger).resolveChallenge(tree.getRoot(), transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  // TODO: Edge cases
})
