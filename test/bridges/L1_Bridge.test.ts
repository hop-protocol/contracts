import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber, utils } from 'ethers'
import Transfer from '../../lib/Transfer'
import MerkleTree from '../../lib/MerkleTree'

import {
  setUpDefaults,
  expectBalanceOf,
  getOriginalSignerBalances,
  getRootHashFromTransferId,
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
  LIQUIDITY_PROVIDER_UNISWAP_AMOUNT,
  CHALLENGER_INITIAL_BALANCE,
  ZERO_ADDRESS,
  SECONDS_IN_A_DAY,
  TIMESTAMP_VARIANCE,
  DEAD_ADDRESS,
  ARBITRARY_ROOT_HASH
} from '../../config/constants'

describe('L1_Bridge', () => {
  let _fixture: IFixture
  let l2ChainId: BigNumber
  let l22ChainId: BigNumber

  let user: Signer
  let bonder: Signer
  let relayer: Signer
  let challenger: Signer
  let otherUser: Signer

  let l1_canonicalToken: Contract
  let l1_bridge: Contract
  let l1_messenger: Contract
  let l1_messengerWrapper: Contract
  let l2_canonicalToken: Contract
  let l2_bridge: Contract
  let l2_messenger: Contract
  let l2_uniswapRouter: Contract
  let l22_canonicalToken: Contract
  let l22_bridge: Contract
  let l22_messenger: Contract
  let l22_uniswapRouter: Contract

  let transfers: Transfer[]

  let originalBondedAmount: BigNumber
  let user_l1_canonicalTokenOriginalBalance: BigNumber
  let bonder_l1_canonicalTokenOriginalBalance: BigNumber
  let challenger_l1_canonicalTokenOriginalBalance: BigNumber
  let user_l2_canonicalTokenOriginalBalance: BigNumber
  let bonder_l2_canonicalTokenOriginalBalance: BigNumber
  let challenger_l2_canonicalTokenOriginalBalance: BigNumber
  let user_l2_bridgeTokenOriginalBalance: BigNumber
  let bonder_l2_bridgeTokenOriginalBalance: BigNumber
  let challenger_l2_bridgeTokenOriginalBalance: BigNumber

  let beforeAllSnapshotId: string
  let snapshotId: string

  before(async () => {
    beforeAllSnapshotId = await takeSnapshot()

    l2ChainId = CHAIN_IDS.OPTIMISM.TESTNET_1
    l22ChainId = CHAIN_IDS.ARBITRUM.TESTNET_3

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
      l1_messengerWrapper,
      l2_canonicalToken,
      l2_bridge,
      l2_messenger,
      l2_uniswapRouter,
      transfers
    } = _fixture)

    const l1AlreadySetOpts = {
      l1BridgeAddress: l1_bridge.address,
      l1CanonicalTokenAddress: l1_canonicalToken.address
    }
    _fixture = await fixture(l22ChainId, l1AlreadySetOpts)
    await setUpDefaults(_fixture, l22ChainId)
    ;({
      l2_canonicalToken: l22_canonicalToken,
      l2_bridge: l22_bridge,
      l2_messenger: l22_messenger,
      l2_uniswapRouter: l22_uniswapRouter
    } = _fixture)

    ;({
      originalBondedAmount,
      user_l1_canonicalTokenOriginalBalance,
      bonder_l1_canonicalTokenOriginalBalance,
      challenger_l1_canonicalTokenOriginalBalance,
      user_l2_canonicalTokenOriginalBalance,
      bonder_l2_canonicalTokenOriginalBalance,
      challenger_l2_canonicalTokenOriginalBalance,
      user_l2_bridgeTokenOriginalBalance,
      bonder_l2_bridgeTokenOriginalBalance,
      challenger_l2_bridgeTokenOriginalBalance
    } = await getOriginalSignerBalances(
      user,
      bonder,
      challenger,
      l1_bridge,
      l2_bridge,
      l1_canonicalToken,
      l2_canonicalToken
    ))
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
    await l1_bridge.connect(bonder).stake(await bonder.getAddress(), bondAmount)
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
      user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
      user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
      user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      otherUser,
      transfer.amount.sub(transfer.relayerFee)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      bonder,
      bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
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
      .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
    await l2_messenger.relayNextMessage()

    // Validate balances
    await expectBalanceOf(
      l1_canonicalToken,
      user,
      user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
      user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
      user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      otherUser,
      transfer.amount.sub(transfer.relayerFee)
    )
    await expectBalanceOf(
      l1_canonicalToken,
      bonder,
      bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
    )

    // Validate state before commitTransfers
    const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(BigNumber.from('0'))
    const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
    const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
    expect(pendingAmountChainId).to.eq(transfer.chainId)
    expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

    // Bonder commits transfers
    await l2_bridge
      .connect(bonder)
      .commitTransfers(transfer.chainId)

    // Validate state after commitTransfers()
    const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
    const expectedCommitTimeForChainId: number = Date.now()
    expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
      expectedCommitTimeForChainId,
      TIMESTAMP_VARIANCE
    )
    const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
    try {
      await l2_bridge.pendingAmountChainIds(0)
      throw new Error('There should not be a pending amount chainId in this slot.')
    } catch (err) {
      expect(err.message).to.eq(expectedErrorMsg)
    }
    try {
      await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      throw new Error('There should not be a pending transfer ID for chainId in this slot.')
    } catch (err) {
      expect(err.message).to.eq(expectedErrorMsg)
    }

    // Set up transfer root
    const transferId: Buffer = transfer.getTransferId()
    const { rootHash } = getRootHashFromTransferId(transferId)

    // Bonder bonds the transfer root
    await l1_bridge
      .connect(bonder)
      .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

    const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
    const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
    const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
    const transferBond: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
    let transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
    expect(timeSlotToAmountBonded).to.eq(bondAmount)
    expect(transferBond).to.eq(bondAmount)
    expect(transferRoot[0]).to.eq(transfer.amount)
    expect(transferRoot[1]).to.eq(BigNumber.from('0'))

    // Bonder settles withdrawals
    await l1_bridge
      .connect(bonder)
      .settleBondedWithdrawals(await bonder.getAddress(), [ transferId ], transfer.amount)

    transferRoot = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
    const credit = await l1_bridge.getCredit(await bonder.getAddress())
    const expectedCredit: BigNumber = originalBondedAmount.add(transfer.amount)
    expect(transferRoot[0]).to.eq(transfer.amount)
    expect(transferRoot[1]).to.eq(transfer.amount)
    expect(credit).to.eq(expectedCredit)

    // Message gets relayed to L1 and bonder confirms the transfer root
    await l1_messenger.relayNextMessage()

    const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount)
    const transferRootConfirmed: boolean = await l1_bridge.transferRootConfirmed(transferRootId)
    const transferBondByTransferRootId = await l1_bridge.transferBonds(transferRootId)
    expect(transferRootConfirmed).to.eq(true)
    expect(transferBondByTransferRootId[0]).to.eq(await bonder.getAddress())
    expect(transferBondByTransferRootId[1].mul(1000).toNumber()).to.be.closeTo(
      expectedCommitTimeForChainId,
      TIMESTAMP_VARIANCE
    )
    expect(transferBondByTransferRootId[2]).to.eq(transfer.amount)
    expect(transferBondByTransferRootId[3]).to.eq(0)
    expect(transferBondByTransferRootId[4]).to.eq(ZERO_ADDRESS)
    expect(transferBondByTransferRootId[5]).to.eq(false)
  })

  /**
   * Unit tests
   */

  describe('constructor', async () => {
    it('Should get the correct chainId', async () => {
      const chainId = await l1_bridge.getChainId()
      const expectedChainId = 1
      expect(chainId).to.eq(expectedChainId)
    })

    it('Should set the collateral token address and the bonder address in the constructor', async () => {
      const collateralTokenAddress = await l1_bridge.l1CanonicalToken()
      const isBonder = await l1_bridge.getIsBonder(await bonder.getAddress())
      expect(collateralTokenAddress).to.eq(l1_canonicalToken.address)
      expect(isBonder).to.eq(true)
    })
  })

  describe('sendToL2', async () => {
    it('Should send tokens across the bridge via sendToL2', async () => {
      const tokenAmount = user_l1_canonicalTokenOriginalBalance
      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, tokenAmount)
      await l1_bridge
        .connect(user)
        .sendToL2(l2ChainId.toString(), await user.getAddress(), tokenAmount)
      await l2_messenger.relayNextMessage()

      await expectBalanceOf(l1_canonicalToken, user, tokenAmount.sub(tokenAmount))
      await expectBalanceOf(l2_bridge, user, tokenAmount)
      expect(await l1_bridge.chainBalance(l2ChainId)).to.eq(LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.add(INITIAL_BONDED_AMOUNT).add(tokenAmount))
    })
  })

  describe('sendToL2AndAttemptToSwap', async () => {
    it('Should send tokens across the bridge and swap via sendToL2AndAttemptSwap', async () => {
      const tokenAmount = user_l1_canonicalTokenOriginalBalance
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

      await expectBalanceOf(l1_canonicalToken, user, tokenAmount.sub(tokenAmount))
      await expectBalanceOf(l2_canonicalToken, user, expectedAmountAfterSlippage)
      await expectBalanceOf(l2_bridge, user, 0)
      expect(await l1_bridge.chainBalance(l2ChainId)).to.eq(LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.add(INITIAL_BONDED_AMOUNT).add(tokenAmount))
    })
  })

  describe('bondTransferRoot', async () => {
    it('Should send a transaction from L2 to L1 and bond the transfer root on L1', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      // Set up transfer root
      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      // Bonder bonds the transfer root
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferBond: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(transferBond).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))
    })

    it('Should send a transaction from L2 to L2 and bond the transfer root on L1', async () => {
      // Set up transfer
      let transfer: any = transfers[0]
      transfer.chainId = CHAIN_IDS.ETHEREUM.MAINNET
      transfer.amountOutMin = BigNumber.from(0)
      transfer.deadline = BigNumber.from(0)

      let l2Transfer: any = transfers[0]
      l2Transfer.chainId = l22ChainId
      l2Transfer.amountOutMin = BigNumber.from(0)
      l2Transfer.deadline = BigNumber.from(0)

      // Instantiate a sender and recipient Signer
      const sender: Signer = user
      const recipient: Signer = otherUser
      expect(transfer.sender).to.eq(await sender.getAddress())
      expect(transfer.recipient).to.eq(await recipient.getAddress())

      // User moves funds to first L2
      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge
        .connect(user)
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(l2_bridge, user, transfer.amount)

      // User moves funds to the other l2
      await l2_bridge
        .connect(user)
        .send(
          l2Transfer.chainId,
          l2Transfer.recipient,
          l2Transfer.amount,
          l2Transfer.transferNonce,
          l2Transfer.relayerFee,
          l2Transfer.amountOutMin,
          l2Transfer.deadline
        )

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        0
      )
      await expectBalanceOf(l2_bridge, user, 0)
      await expectBalanceOf(l22_bridge, user, 0)

      await l22_bridge
        .connect(bonder)
        .bondWithdrawalAndAttemptSwap(
          l2Transfer.sender,
          l2Transfer.recipient,
          l2Transfer.amount,
          l2Transfer.transferNonce,
          l2Transfer.relayerFee,
          l2Transfer.amountOutMin,
          l2Transfer.deadline
        )

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l22_bridge,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      // Set up transfer root
      const transferId: Buffer = l2Transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      // Bonder bonds the transfer root
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, l2Transfer.chainId, l2Transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(l2Transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferBond: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(transferBond).to.eq(bondAmount)

      const nextMessage = await l22_messenger.nextMessage()
      const ABI: string[] = [ "function setTransferRoot(bytes32, uint256)" ]
      const setTransferRootInterface = new utils.Interface(ABI)
      const expectedMessage: string  = setTransferRootInterface.encodeFunctionData("setTransferRoot", [ rootHash, l2Transfer.amount ])
      expect(nextMessage[0]).to.eq(l22_bridge.address)
      expect(nextMessage[1]).to.eq(expectedMessage)
    })
  })

  describe('confirmTransferRoot', async () => {
    it('Should send a transaction from L2 to L1 and commit the transfers on L1', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      // Send the committed transfer the L1
      await l1_messenger.relayNextMessage()

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
      const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount);
      const transferRootConfirmed: boolean = await l1_bridge.transferRootConfirmed(transferRootId)
      const transferRoot = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(transferRootConfirmed).to.eq(true)
      expect(await l1_bridge.chainBalance(l2ChainId)).to.eq(LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.add(INITIAL_BONDED_AMOUNT))
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))
    })

    it('Should send a transaction from L2 to L2 and commit the transfers on L1', async () => {
      // Set up transfer
      let transfer: any = transfers[0]
      transfer.chainId = CHAIN_IDS.ETHEREUM.MAINNET
      transfer.amountOutMin = BigNumber.from(0)
      transfer.deadline = BigNumber.from(0)

      let l2Transfer: any = transfers[0]
      l2Transfer.chainId = l22ChainId
      l2Transfer.amountOutMin = BigNumber.from(0)
      l2Transfer.deadline = BigNumber.from(0)

      // Instantiate a sender and recipient Signer
      const sender: Signer = user
      const recipient: Signer = otherUser
      expect(transfer.sender).to.eq(await sender.getAddress())
      expect(transfer.recipient).to.eq(await recipient.getAddress())

      // User moves funds to first L2
      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge
        .connect(user)
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(l2_bridge, user, transfer.amount)

      // User moves funds to the other l2
      await l2_bridge
        .connect(user)
        .send(
          l2Transfer.chainId,
          l2Transfer.recipient,
          l2Transfer.amount,
          l2Transfer.transferNonce,
          l2Transfer.relayerFee,
          l2Transfer.amountOutMin,
          l2Transfer.deadline
        )

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        0
      )
      await expectBalanceOf(l2_bridge, user, 0)
      await expectBalanceOf(l22_bridge, user, 0)

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      // Send the committed transfer the L1
      await l1_messenger.relayNextMessage()

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
      const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount);
      const transferRootConfirmed: boolean = await l1_bridge.transferRootConfirmed(transferRootId)
      expect(transferRootConfirmed).to.eq(true)
      expect(await l1_bridge.chainBalance(l22ChainId)).to.eq(LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.add(INITIAL_BONDED_AMOUNT))

      const nextMessage = await l22_messenger.nextMessage()
      const ABI: string[] = [ "function setTransferRoot(bytes32, uint256)" ]
      const setTransferRootInterface = new utils.Interface(ABI)
      const expectedMessage: string  = setTransferRootInterface.encodeFunctionData("setTransferRoot", [ rootHash, l2Transfer.amount ])
      expect(nextMessage[0]).to.eq(l22_bridge.address)
      expect(nextMessage[1]).to.eq(expectedMessage)
    })
  })

  describe('challengeTransferBond', async () => {
    it('Should send a transaction from L2 to L1, bond withdrawal on L1, and challenge the transfer bond', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
      const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount)

      // Bonder bonds the transfer root
      const debitBeforeBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)
      await l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)

      await expectBalanceOf(
        l1_canonicalToken,
        challenger,
        challenger_l1_canonicalTokenOriginalBalance.sub(challengeAmount)
      )

      const transferBond = await l1_bridge.transferBonds(transferRootId)
      expect(transferBond[3].mul(1000).toNumber()).to.be.closeTo(
        Date.now(),
        TIMESTAMP_VARIANCE
      )
      expect(transferBond[4]).to.eq(await challenger.getAddress())
      expect(transferBond[5]).to.eq(false)

      bondAmountForTimeSlot = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      expect(bondAmountForTimeSlot).to.eq(BigNumber.from('0'))

      const debitAfterBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      expect(debitAfterBond).to.eq(debitBeforeBond.add(bondAmount))
    })
  })
  describe('resolveChallenge', async () => {
    it('Should send a transaction from L2 to L1, bond withdrawal on L1, challenge the transfer bond, and resolve unsuccessfully', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
      const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount)

      // Bonder bonds the transfer root
      const debitBeforeBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      const bridgeBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(l1_bridge.address)
      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)
      await l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)

      await expectBalanceOf(
        l1_canonicalToken,
        challenger,
        challenger_l1_canonicalTokenOriginalBalance.sub(challengeAmount)
      )

      let transferBond = await l1_bridge.transferBonds(transferRootId)
      expect(transferBond[3].mul(1000).toNumber()).to.be.closeTo(
        Date.now(),
        TIMESTAMP_VARIANCE
      )
      expect(transferBond[4]).to.eq(await challenger.getAddress())
      expect(transferBond[5]).to.eq(false)

      bondAmountForTimeSlot = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      expect(bondAmountForTimeSlot).to.eq(BigNumber.from('0'))

      const debitAfterBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      expect(debitAfterBond).to.eq(debitBeforeBond.add(bondAmount))

      // Resolve the challenge
      const numDaysToWait: number = 9 * SECONDS_IN_A_DAY
      await increaseTime(numDaysToWait)
      await l1_messenger.relayNextMessage()

      const creditBeforeChallenge: BigNumber = await l1_bridge.getCredit(await bonder.getAddress())
      await l1_bridge.resolveChallenge(rootHash, transfer.amount)

      transferBond = await l1_bridge.transferBonds(transferRootId)
      expect(transferBond[5]).to.eq(true)
      expectBalanceOf(l1_canonicalToken, l1_bridge, bridgeBalanceBefore.add(challengeAmount))
      const creditAfterChallenge: BigNumber = await l1_bridge.getCredit(await bonder.getAddress())
      expect(creditAfterChallenge).to.eq(creditBeforeChallenge.add(bondAmount).add(challengeAmount))
    })

    it('Should send a transaction from L2 to L1, bond withdrawal on L1, challenge the transfer bond, and resolve successfully', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      const expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
      const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount)

      // Bonder bonds the transfer root
      const debitBeforeBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: BigNumber = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)
      await l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)

      await expectBalanceOf(
        l1_canonicalToken,
        challenger,
        challenger_l1_canonicalTokenOriginalBalance.sub(challengeAmount)
      )

      let transferBond = await l1_bridge.transferBonds(transferRootId)
      expect(transferBond[3].mul(1000).toNumber()).to.be.closeTo(
        Date.now(),
        TIMESTAMP_VARIANCE
      )
      expect(transferBond[4]).to.eq(await challenger.getAddress())
      expect(transferBond[5]).to.eq(false)

      bondAmountForTimeSlot = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      expect(bondAmountForTimeSlot).to.eq(BigNumber.from('0'))

      const debitAfterBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      expect(debitAfterBond).to.eq(debitBeforeBond.add(bondAmount))

      // Resolve the challenge
      const numDaysToWait: number = 9 * SECONDS_IN_A_DAY
      await increaseTime(numDaysToWait)
    
      // Message is not relayed successfully

      const creditBeforeChallenge: BigNumber = await l1_bridge.getCredit(await bonder.getAddress())
      await l1_bridge.resolveChallenge(rootHash, transfer.amount)

      transferBond = await l1_bridge.transferBonds(transferRootId)
      expect(transferBond[5]).to.eq(true)

      // Credit should not have changed
      const creditAfterChallenge: BigNumber = await l1_bridge.getCredit(await bonder.getAddress())
      expect(creditAfterChallenge).to.eq(creditBeforeChallenge)

      // DEAD address should have tokens
      const balanceAfter: BigNumber = await l1_canonicalToken.balanceOf(DEAD_ADDRESS)
      expect(balanceAfter.toString()).to.eq(BigNumber.from(challengeAmount).div(4).toString())

      // Challenger should have tokens
      // NOTE: the challenge amount is subtracted to mimic the amount sent to the contract during the challenge
      const expectedChallengerTokenAmount: BigNumber = challenger_l1_canonicalTokenOriginalBalance.sub(challengeAmount).add(challengeAmount.mul(7).div(4))
      await expectBalanceOf(l1_canonicalToken, challenger, expectedChallengerTokenAmount)
    })
  })

  // TODO: Test extreme relayer fees (0, max)
  // TODO: Test the same recipient
  /**
   * Non-Happy Path
   */

  describe('sendToL2', async () => {
    it('Should not allow a transfer to L2 via sendToL2 if the messenger wrapper for the L2 is not defined', async () => {
      const tokenAmount = user_l1_canonicalTokenOriginalBalance
      const invalidChainId: BigNumber = BigNumber.from('123')
      const expectedErrorMsg: string = 'L1_BRG: chainId not supported'

      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, tokenAmount)

      await expect(
        l1_bridge
          .connect(user)
          .sendToL2(invalidChainId, await user.getAddress(), tokenAmount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2 if the user did not approve the token transfer to the L1 Bridge', async () => {
      const tokenAmount = user_l1_canonicalTokenOriginalBalance
      const expectedErrorMsg: string = ' ERC20: transfer amount exceeds allowance'

      await expect(
        l1_bridge
          .connect(user)
          .sendToL2(l2ChainId, await user.getAddress(), tokenAmount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2 if the user does not have the tokens to transfer to the L1 Bridge', async () => {
      const tokenAmount = user_l1_canonicalTokenOriginalBalance
      const expectedErrorMsg: string = 'ERC20: transfer amount exceeds balance'

      // Send all tokens away from user's address
      const userBalance: BigNumber = await l1_canonicalToken.balanceOf(await user.getAddress())
      await l1_canonicalToken.connect(user).transfer(DEAD_ADDRESS, userBalance)
      expectBalanceOf(l1_canonicalToken, user, BigNumber.from('0'))

      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, tokenAmount)

      await expect(
        l1_bridge
          .connect(user)
          .sendToL2(l2ChainId, await user.getAddress(), tokenAmount)
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('sendToL2AndAttemptSwap', async () => {
    it('Should not allow a transfer to L2 via sendToL2AndAttemptSwap if the messenger wrapper for the L2 is not defined', async () => {
      const tokenAmount = user_l1_canonicalTokenOriginalBalance
      const invalidChainId: BigNumber = BigNumber.from('123')
      const expectedErrorMsg: string = 'L1_BRG: chainId not supported'

      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, tokenAmount)

      await expect(
        l1_bridge
          .connect(user)
          .sendToL2AndAttemptSwap(invalidChainId, await user.getAddress(), tokenAmount, DEFAULT_AMOUNT_OUT_MIN, DEFAULT_DEADLINE)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2AndAttemptSwap if the user did not approve the token transfer to the L1 Bridge', async () => {
      const tokenAmount = user_l1_canonicalTokenOriginalBalance
      const expectedErrorMsg: string = ' ERC20: transfer amount exceeds allowance'

      await expect(
        l1_bridge
          .connect(user)
          .sendToL2AndAttemptSwap(l2ChainId, await user.getAddress(), tokenAmount, DEFAULT_AMOUNT_OUT_MIN, DEFAULT_DEADLINE)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2AndAttemptSwap if the user does not have the tokens to transfer to the L1 Bridge', async () => {
      const tokenAmount = user_l1_canonicalTokenOriginalBalance
      const expectedErrorMsg: string = 'ERC20: transfer amount exceeds balance'

      // Send all tokens away from user's address
      const userBalance: BigNumber = await l1_canonicalToken.balanceOf(await user.getAddress())
      await l1_canonicalToken.connect(user).transfer(DEAD_ADDRESS, userBalance)
      expectBalanceOf(l1_canonicalToken, user, BigNumber.from('0'))

      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, tokenAmount)

      await expect(
        l1_bridge
          .connect(user)
          .sendToL2AndAttemptSwap(l2ChainId, await user.getAddress(), tokenAmount, DEFAULT_AMOUNT_OUT_MIN, DEFAULT_DEADLINE)
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

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

    it('Should not allow a transfer root to be bonded that exceeds the bonders credit', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(await bonder.getAddress(), BigNumber.from(1))

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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )

      await l2_bridge.commitTransfers(transfer.chainId)
      await l1_messenger.relayNextMessage()

      // Bonder attempts to bond already-confirmed transfer root from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])
      const expectedErrorMsg: string = 'L1_BRG: Transfer Root has already been confirmed'

      await expect(
        l1_bridge.connect(bonder).bondTransferRoot(tree.getRoot(), transfer.chainId, transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root has already been bonded', async () => {
      let transfer: any = transfers[0]

      // User withdraws from L1 bridge
      const transferId: Buffer = transfer.getTransferId()
      const tree: MerkleTree = new MerkleTree([transferId])

      await l1_canonicalToken
        .connect(bonder)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge.connect(bonder).stake(await bonder.getAddress(), BigNumber.from(1))

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
      await l1_bridge.connect(bonder).stake(await bonder.getAddress(), BigNumber.from(1))

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
      await l1_bridge.connect(bonder).stake(await bonder.getAddress(), BigNumber.from(1))

      const chainId: BigNumber = CHAIN_IDS.OPTIMISM.TESTNET_1
      const amount: BigNumber = BigNumber.from(1)
      const expectedErrorMsg: string = 'L1_BRG: chainId not supported'

      await expect(
        l1_bridge
          .connect(bonder)
          .bondTransferRoot(tree.getRoot(), chainId, amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('confirmTransferRoot', async () => {
    it('Should not allow a transfer root to be confirmed by anybody except the L2_Bridge', async () => {
      // TODO -- wait until the `onlyL2Bridge` modifier has been implemented
    })

    it('Should not allow a transfer root to be confirmed if it was already confirmed', async () => {
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )

      await l2_bridge.commitTransfers(transfer.chainId)
      await l1_messenger.relayNextMessage()

      // The only way for this to happen in production is for the canonical messenger to relay the same message twice.
      // Our Mock Messenger allows for this and reverts with the bridge's error message

      const expectedErrorMsg: string = 'L1_BRG: TransferRoot already confirmed'
      await expect(
        l1_messenger.relayNextMessage()
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be confirmed if a mainnet transfer root amount is 0', async () => {
      // This is not possible to check, as `L2_Bridge.send()` and `L2_Bridge.swapAndSend()` perform this check
      // and disallow it on that level.
    })

    it('Should not allow a transfer root to be confirmed if the messenger wrapper for the L2 is not defined', async () => {
      // Set up transfer
      let transfer: any = transfers[0]
      transfer.chainId = CHAIN_IDS.ETHEREUM.MAINNET
      transfer.amountOutMin = BigNumber.from(0)
      transfer.deadline = BigNumber.from(0)

      let l2Transfer: any = transfers[0]
      l2Transfer.chainId = l22ChainId
      l2Transfer.amountOutMin = BigNumber.from(0)
      l2Transfer.deadline = BigNumber.from(0)

      // Instantiate a sender and recipient Signer
      const sender: Signer = user
      const recipient: Signer = otherUser
      expect(transfer.sender).to.eq(await sender.getAddress())
      expect(transfer.recipient).to.eq(await recipient.getAddress())

      // User moves funds to first L2
      await l1_canonicalToken
        .connect(user)
        .approve(l1_bridge.address, transfer.amount)
      await l1_bridge
        .connect(user)
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(l2_bridge, user, transfer.amount)

      // User moves funds to the other l2
      await l2_bridge
        .connect(user)
        .send(
          l2Transfer.chainId,
          l2Transfer.recipient,
          l2Transfer.amount,
          l2Transfer.transferNonce,
          l2Transfer.relayerFee,
          l2Transfer.amountOutMin,
          l2Transfer.deadline
        )

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        0
      )
      await expectBalanceOf(l2_bridge, user, 0)
      await expectBalanceOf(l22_bridge, user, 0)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      // Unset the supported chainId for this test
      await l1_bridge.setCrossDomainMessengerWrapper(l22ChainId, ZERO_ADDRESS)

      expectedErrorMsg = 'L1_BRG: chainId not supported'
      await expect(
        l1_messenger.relayNextMessage()
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('challengeTransferBond', async () => {
    it('Should not allow a transfer root to be challenged if the transfer root has already been confirmed', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      // Bonder bonds the transfer root
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      // Confirm the transfer root
      await l1_messenger.relayNextMessage()

      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)

      expectedErrorMsg = 'L1_BRG: Transfer root has already been confirmed'
      await expect(
        l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if the transfer root is challenged after the challenge period', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      // Bonder bonds the transfer root
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      // Wait until after the challenge period
      const challengePeriod: BigNumber = await l1_bridge.challengePeriod()
      await increaseTime(challengePeriod.toNumber())

      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)

      expectedErrorMsg = 'L1_BRG: Transfer root cannot be challenged after challenge period'
      await expect(
        l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if the transfer root has already been challenged', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
      const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount)

      // Bonder bonds the transfer root
      const debitBeforeBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)
      await l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)

      await expectBalanceOf(
        l1_canonicalToken,
        challenger,
        challenger_l1_canonicalTokenOriginalBalance.sub(challengeAmount)
      )

      const transferBond = await l1_bridge.transferBonds(transferRootId)
      expect(transferBond[3].mul(1000).toNumber()).to.be.closeTo(
        Date.now(),
        TIMESTAMP_VARIANCE
      )
      expect(transferBond[4]).to.eq(await challenger.getAddress())
      expect(transferBond[5]).to.eq(false)

      bondAmountForTimeSlot = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      expect(bondAmountForTimeSlot).to.eq(BigNumber.from('0'))

      const debitAfterBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      expect(debitAfterBond).to.eq(debitBeforeBond.add(bondAmount))

      expectedErrorMsg = 'L1_BRG: Transfer root already challenged'
      await expect(
        l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if the challenger does not approve the tokens to challenge with', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      // Bonder bonds the transfer root
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      expectedErrorMsg = 'ERC20: transfer amount exceeds allowance'
      await expect(
        l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if the challenger does not have enough tokens to challenge with', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      // Bonder bonds the transfer root
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      const challengerBalance: BigNumber = await l1_canonicalToken.balanceOf(await challenger.getAddress())
      await l1_canonicalToken.connect(challenger).transfer(DEAD_ADDRESS, challengerBalance)
      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)

      expectedErrorMsg = 'ERC20: transfer amount exceeds balance'
      await expect(
        l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if an arbitrary root hash is passed in', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      // Bonder bonds the transfer root
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      const challengerBalance: BigNumber = await l1_canonicalToken.balanceOf(await challenger.getAddress())
      await l1_canonicalToken.connect(challenger).transfer(DEAD_ADDRESS, challengerBalance)
      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)

      expectedErrorMsg = 'L1_BRG: Transfer root cannot be challenged after challenge period'
      await expect(
        l1_bridge.connect(challenger).challengeTransferBond(ARBITRARY_ROOT_HASH, transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if an incorrect originalAmount is passed in', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      // Bonder bonds the transfer root
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)

      expectedErrorMsg = 'L1_BRG: Transfer root cannot be challenged after challenge period'
      await expect(
        l1_bridge.connect(challenger).challengeTransferBond(rootHash, BigNumber.from('13371337'))
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('resolveChallenge', async () => {
    it('Should not allow a transfer root challenge to be resolved if the transfer root was never challenged', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      // Bonder bonds the transfer root
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      // Resolve the challenge
      const tree: MerkleTree = new MerkleTree([transferId])

      const numDaysToWait: number = 9 * SECONDS_IN_A_DAY
      await increaseTime(numDaysToWait)
      await l1_messenger.relayNextMessage()

      expectedErrorMsg = 'L1_BRG: Transfer root has not been challenged'
      await expect(
        l1_bridge.connect(challenger).resolveChallenge(tree.getRoot(), transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root challenge to be resolved if the transfer root challenge period is not over', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
      const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount)

      // Bonder bonds the transfer root
      const debitBeforeBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)
      await l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)

      await expectBalanceOf(
        l1_canonicalToken,
        challenger,
        challenger_l1_canonicalTokenOriginalBalance.sub(challengeAmount)
      )

      const transferBond = await l1_bridge.transferBonds(transferRootId)
      expect(transferBond[3].mul(1000).toNumber()).to.be.closeTo(
        Date.now(),
        TIMESTAMP_VARIANCE
      )
      expect(transferBond[4]).to.eq(await challenger.getAddress())
      expect(transferBond[5]).to.eq(false)

      bondAmountForTimeSlot = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      expect(bondAmountForTimeSlot).to.eq(BigNumber.from('0'))

      const debitAfterBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      expect(debitAfterBond).to.eq(debitBeforeBond.add(bondAmount))

      // Resolve the challenge
      // Do not increase the time
      await l1_messenger.relayNextMessage()

      const tree: MerkleTree = new MerkleTree([transferId])

      expectedErrorMsg = 'L1_BRG: Challenge period has not ended'
      await expect(
        l1_bridge.connect(challenger).resolveChallenge(tree.getRoot(), transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root challenge to be resolved if an arbitrary root hash is passed in', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
      const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount)

      // Bonder bonds the transfer root
      const debitBeforeBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)
      await l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)

      await expectBalanceOf(
        l1_canonicalToken,
        challenger,
        challenger_l1_canonicalTokenOriginalBalance.sub(challengeAmount)
      )

      const transferBond = await l1_bridge.transferBonds(transferRootId)
      expect(transferBond[3].mul(1000).toNumber()).to.be.closeTo(
        Date.now(),
        TIMESTAMP_VARIANCE
      )
      expect(transferBond[4]).to.eq(await challenger.getAddress())
      expect(transferBond[5]).to.eq(false)

      bondAmountForTimeSlot = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      expect(bondAmountForTimeSlot).to.eq(BigNumber.from('0'))

      const debitAfterBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      expect(debitAfterBond).to.eq(debitBeforeBond.add(bondAmount))

      // Resolve the challenge
      // Do not increase the time
      await l1_messenger.relayNextMessage()

      expectedErrorMsg = 'L1_BRG: Transfer root has not been challenged'
      await expect(
        l1_bridge.connect(challenger).resolveChallenge(ARBITRARY_ROOT_HASH, transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root challenge to be resolved if it has already been resolved', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
      const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount)

      // Bonder bonds the transfer root
      const debitBeforeBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      const bridgeBalanceBefore: BigNumber = await l1_canonicalToken.balanceOf(l1_bridge.address)
      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)
      await l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)

      await expectBalanceOf(
        l1_canonicalToken,
        challenger,
        challenger_l1_canonicalTokenOriginalBalance.sub(challengeAmount)
      )

      let transferBond = await l1_bridge.transferBonds(transferRootId)
      expect(transferBond[3].mul(1000).toNumber()).to.be.closeTo(
        Date.now(),
        TIMESTAMP_VARIANCE
      )
      expect(transferBond[4]).to.eq(await challenger.getAddress())
      expect(transferBond[5]).to.eq(false)

      bondAmountForTimeSlot = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      expect(bondAmountForTimeSlot).to.eq(BigNumber.from('0'))

      const debitAfterBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      expect(debitAfterBond).to.eq(debitBeforeBond.add(bondAmount))

      // Resolve the challenge
      const numDaysToWait: number = 9 * SECONDS_IN_A_DAY
      await increaseTime(numDaysToWait)
      await l1_messenger.relayNextMessage()

      const creditBeforeChallenge: BigNumber = await l1_bridge.getCredit(await bonder.getAddress())
      await l1_bridge.resolveChallenge(rootHash, transfer.amount)

      transferBond = await l1_bridge.transferBonds(transferRootId)
      expect(transferBond[5]).to.eq(true)

      expectBalanceOf(l1_canonicalToken, l1_bridge, bridgeBalanceBefore.add(challengeAmount))
      const creditAfterChallenge: BigNumber = await l1_bridge.getCredit(await bonder.getAddress())
      expect(creditAfterChallenge).to.eq(creditBeforeChallenge.add(bondAmount).add(challengeAmount))

      expectedErrorMsg = 'L1_BRG: Transfer root already resolved'
      await expect(
        l1_bridge.connect(challenger).resolveChallenge(rootHash, transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root challenge to be resolved if an incorrect originalAmount is passed in', async () => {
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
        .sendToL2(l2ChainId, await user.getAddress(), transfer.amount)
      await l2_messenger.relayNextMessage()

      // Validate balances
      await expectBalanceOf(
        l1_canonicalToken,
        user,
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
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
        user_l1_canonicalTokenOriginalBalance.sub(transfer.amount)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        otherUser,
        transfer.amount.sub(transfer.relayerFee)
      )
      await expectBalanceOf(
        l1_canonicalToken,
        bonder,
        bonder_l1_canonicalTokenOriginalBalance.add(transfer.relayerFee)
      )

      // Validate state before commitTransfers
      const pendingAmountChainId = await l2_bridge.pendingAmountChainIds(0)
      const pendingTransferIdsForChainId: string = await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
      const expectedPendingTransferIdsForChainId: string = transfer.getTransferIdHex()
      expect(pendingAmountChainId).to.eq(transfer.chainId)
      expect(pendingTransferIdsForChainId).to.eq(expectedPendingTransferIdsForChainId)

      // Bonder commits transfers
      await l2_bridge
        .connect(bonder)
        .commitTransfers(transfer.chainId)

      // Validate state after commitTransfers()
      const lastCommitTimeForChainId: BigNumber = await l2_bridge.lastCommitTimeForChainId(transfer.chainId)
      const expectedCommitTimeForChainId: number = Date.now()
      expect(lastCommitTimeForChainId.mul(1000).toNumber()).to.be.closeTo(
        expectedCommitTimeForChainId,
        TIMESTAMP_VARIANCE
      )
      let expectedErrorMsg: string = 'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingAmountChainIds(0)
        throw new Error('There should not be a pending amount chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
      try {
        await l2_bridge.pendingTransferIdsForChainId(transfer.chainId, 0)
        throw new Error('There should not be a pending transfer ID for chainId in this slot.')
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }

      const transferId: Buffer = transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
      const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount)

      // Bonder bonds the transfer root
      const debitBeforeBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      await l1_bridge
        .connect(bonder)
        .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)

      const timeSlot: string = await l1_bridge.getTimeSlot(Math.floor(Date.now() / 1000))
      const bondAmount: string = await l1_bridge.getBondForTransferAmount(transfer.amount)
      const timeSlotToAmountBonded: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      let bondAmountForTimeSlot: number = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      const transferRoot: number = await l1_bridge.getTransferRoot(rootHash, transfer.amount)
      expect(timeSlotToAmountBonded).to.eq(bondAmount)
      expect(bondAmountForTimeSlot).to.eq(bondAmount)
      expect(transferRoot[0]).to.eq(transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))

      const challengeAmount: BigNumber = await l1_bridge.getChallengeAmountForTransferAmount(transfer.amount)
      await l1_canonicalToken
        .connect(challenger)
        .approve(l1_bridge.address, challengeAmount)
      await l1_bridge.connect(challenger).challengeTransferBond(rootHash, transfer.amount)

      await expectBalanceOf(
        l1_canonicalToken,
        challenger,
        challenger_l1_canonicalTokenOriginalBalance.sub(challengeAmount)
      )

      const transferBond = await l1_bridge.transferBonds(transferRootId)
      expect(transferBond[3].mul(1000).toNumber()).to.be.closeTo(
        Date.now(),
        TIMESTAMP_VARIANCE
      )
      expect(transferBond[4]).to.eq(await challenger.getAddress())
      expect(transferBond[5]).to.eq(false)

      bondAmountForTimeSlot = await l1_bridge.timeSlotToAmountBonded(timeSlot)
      expect(bondAmountForTimeSlot).to.eq(BigNumber.from('0'))

      const debitAfterBond: BigNumber = await l1_bridge.getDebitAndAdditionalDebit(await bonder.getAddress())
      expect(debitAfterBond).to.eq(debitBeforeBond.add(bondAmount))

      // Resolve the challenge
      // Do not increase the time
      await l1_messenger.relayNextMessage()

      const tree: MerkleTree = new MerkleTree([transferId])

      expectedErrorMsg = 'L1_BRG: Transfer root has not been challenged'
      await expect(
        l1_bridge.connect(challenger).resolveChallenge(tree.getRoot(), BigNumber.from('13371337'))
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  // TODO: Edge cases
})
