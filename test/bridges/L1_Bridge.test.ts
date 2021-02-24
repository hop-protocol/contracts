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
import {
  executeL1BridgeSendToL2,
  executeL1BridgeSendToL2AndAttemptToSwap,
  executeL1BridgeBondWithdrawal,
  executeL1BridgeBondTransferRoot,
  executeL1BridgeSettleBondedWithdrawals,
  executeL1BridgeChallengeTransferBond,
  executeL1BridgeResolveChallenge,
  executeL2BridgeSend,
  executeL2BridgeCommitTransfers,
  executeL2BridgeBondWithdrawalAndAttemptSwap
} from '../shared/contractFunctionWrappers'
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
  let transfer: Transfer
  let l2Transfer: Transfer

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

    transfer = Object.assign(transfers[0], {})
    l2Transfer = Object.assign(transfers[1], {})
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
    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_bridge,
      l2_messenger,
      transfer.sender,
      transfer.amount,
      l2ChainId
    )

    await executeL2BridgeSend(
      l2_bridge,
      transfer
    )

    await executeL1BridgeBondWithdrawal(
      l1_canonicalToken,
      l1_bridge,
      transfer,
      bonder
    )
  })

  it('Should send a transaction from L2 to L1, perform a bonded withdrawal, and confirm an already bonded transfer root on L1', async () => {
    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_bridge,
      l2_messenger,
      transfer.sender,
      transfer.amount,
      l2ChainId
    )

    await executeL2BridgeSend(
      l2_bridge,
      transfer
    )

    await executeL1BridgeBondWithdrawal(
      l1_canonicalToken,
      l1_bridge,
      transfer,
      bonder
    )

    await executeL2BridgeCommitTransfers(
      l2_bridge,
      transfer,
      bonder
    )

    const transferId: Buffer = await transfer.getTransferId()
    const { rootHash } = getRootHashFromTransferId(transferId)

    await executeL1BridgeBondTransferRoot(
      l1_bridge,
      transfer,
      bonder,
      rootHash
    )

    await executeL1BridgeSettleBondedWithdrawals(
      l1_bridge,
      transfer,
      bonder,
      transferId,
      rootHash
    )

    await l1_messenger.relayNextMessage()

    const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, transfer.amount)
    const transferRootConfirmed: boolean = await l1_bridge.transferRootConfirmed(transferRootId)
    const transferBondByTransferRootId = await l1_bridge.transferBonds(transferRootId)
    const expectedCommitTimeForChainId: number = Date.now()
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
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await l2_messenger.relayNextMessage()

      expect(await l1_bridge.chainBalance(l2ChainId)).to.eq(LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.add(INITIAL_BONDED_AMOUNT).add(transfer.amount))
    })
  })

  describe('sendToL2AndAttemptToSwap', async () => {
    it('Should send tokens across the bridge and swap via sendToL2AndAttemptSwap', async () => {
      const expectedAmounts: BigNumber[] = await l2_uniswapRouter.getAmountsOut(
        transfer.amount,
        [l2_canonicalToken.address, l2_bridge.address]
      )
      const expectedAmountAfterSlippage: BigNumber = expectedAmounts[1]

      await executeL1BridgeSendToL2AndAttemptToSwap(
        l1_canonicalToken,
        l1_bridge,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await l2_messenger.relayNextMessage()

      await expectBalanceOf(l2_canonicalToken, user, expectedAmountAfterSlippage)
      await expectBalanceOf(l2_bridge, user, 0)
      expect(await l1_bridge.chainBalance(l2ChainId)).to.eq(LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.add(INITIAL_BONDED_AMOUNT).add(transfer.amount))
    })
  })

  describe('bondTransferRoot', async () => {
    it('Should send a transaction from L2 to L1 and bond the transfer root on L1', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )
    })

    it('Should send a transaction from L2 to L2 and bond the transfer root on L1', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        l2Transfer
      )

      // Bond withdrawal on other L2
      await executeL2BridgeBondWithdrawalAndAttemptSwap(
        l22_bridge,
        l2Transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        l2Transfer,
        bonder
      )

      const transferId: Buffer = await l2Transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2Transfer,
        bonder,
        rootHash
      )

      // TODO: Maybe move this into its own function
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
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      // Send the committed transfer the L1
      await l1_messenger.relayNextMessage()

      const transferId: Buffer = await transfer.getTransferId()
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
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        l2Transfer
      )

      // Bond withdrawal on other L2
      await executeL2BridgeBondWithdrawalAndAttemptSwap(
        l22_bridge,
        l2Transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        l2Transfer,
        bonder
      )

      // Send the committed transfer the L1
      await l1_messenger.relayNextMessage()

      const transferId: Buffer = await l2Transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      const transferRootId: string = await l1_bridge.getTransferRootId(rootHash, l2Transfer.amount);
      const transferRootConfirmed: boolean = await l1_bridge.transferRootConfirmed(transferRootId)
      expect(transferRootConfirmed).to.eq(true)
      expect(await l1_bridge.chainBalance(l22ChainId)).to.eq(LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.add(INITIAL_BONDED_AMOUNT))

      // TODO: Maybe move this into its own function
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
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        transfer.amount,
        bonder,
        challenger,
        rootHash
      )
    })
  })
  describe('resolveChallenge', async () => {
    it('Should send a transaction from L2 to L1, bond withdrawal on L1, challenge the transfer bond, and resolve unsuccessfully', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        transfer.amount,
        bonder,
        challenger,
        rootHash
      )

      const numDaysToWait: number = 9 * SECONDS_IN_A_DAY
      await increaseTime(numDaysToWait)
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = false
      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        transfer.amount,
        bonder,
        challenger,
        rootHash,
        shouldResolveSuccessfully
      )
    })

    it('Should send a transaction from L2 to L1, bond withdrawal on L1, challenge the transfer bond, and resolve successfully', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        transfer.amount,
        bonder,
        challenger,
        rootHash
      )

      const numDaysToWait: number = 9 * SECONDS_IN_A_DAY
      await increaseTime(numDaysToWait)

      // Message is not relayed successfully

      const shouldResolveSuccessfully: boolean = true
      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        transfer.amount,
        bonder,
        challenger,
        rootHash,
        shouldResolveSuccessfully
      )
    })
  })

  // TODO: Test extreme relayer fees (0, max)
  // TODO: Test the same recipient
  /**
   * Non-Happy Path
   */

  describe('sendToL2', async () => {
    it('Should not allow a transfer to L2 via sendToL2 if the messenger wrapper for the L2 is not defined', async () => {
      const invalidChainId: BigNumber = BigNumber.from('123')
      const expectedErrorMsg: string = 'L1_BRG: chainId not supported'

      await expect(
        executeL1BridgeSendToL2(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          l2_messenger,
          transfer.sender,
          transfer.amount,
          invalidChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2 if the user did not approve the token transfer to the L1 Bridge', async () => {
      const expectedErrorMsg: string = ' ERC20: transfer amount exceeds allowance'
      const tokenAmount = await l1_canonicalToken.balanceOf(await user.getAddress())

      await expect(
        l1_bridge
          .connect(user)
          .sendToL2(l2ChainId, await user.getAddress(), tokenAmount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2 if the user does not have the tokens to transfer to the L1 Bridge', async () => {
      const expectedErrorMsg: string = 'ERC20: transfer amount exceeds balance'

      // Send all tokens away from user's address
      const userBalance: BigNumber = await l1_canonicalToken.balanceOf(await user.getAddress())
      await l1_canonicalToken.connect(user).transfer(DEAD_ADDRESS, userBalance)
      expectBalanceOf(l1_canonicalToken, user, BigNumber.from('0'))

      await expect(
        executeL1BridgeSendToL2(
          l1_canonicalToken,
          l1_bridge,
          l2_bridge,
          l2_messenger,
          transfer.sender,
          transfer.amount,
          l2ChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('sendToL2AndAttemptSwap', async () => {
    it('Should not allow a transfer to L2 via sendToL2AndAttemptSwap if the messenger wrapper for the L2 is not defined', async () => {
      const expectedErrorMsg: string = 'L1_BRG: chainId not supported'
      const invalidChainId: BigNumber = BigNumber.from('123')

      await expect(
        executeL1BridgeSendToL2AndAttemptToSwap(
          l1_canonicalToken,
          l1_bridge,
          transfer.sender,
          transfer.amount,
          invalidChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2AndAttemptSwap if the user did not approve the token transfer to the L1 Bridge', async () => {
      const expectedErrorMsg: string = ' ERC20: transfer amount exceeds allowance'
      const tokenAmount = await l1_canonicalToken.balanceOf(await user.getAddress())

      await expect(
        l1_bridge
          .connect(user)
          .sendToL2AndAttemptSwap(l2ChainId, await user.getAddress(), tokenAmount, DEFAULT_AMOUNT_OUT_MIN, DEFAULT_DEADLINE)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer to L2 via sendToL2AndAttemptSwap if the user does not have the tokens to transfer to the L1 Bridge', async () => {
      const expectedErrorMsg: string = 'ERC20: transfer amount exceeds balance'

      // Send all tokens away from user's address
      const userBalance: BigNumber = await l1_canonicalToken.balanceOf(await user.getAddress())
      await l1_canonicalToken.connect(user).transfer(DEAD_ADDRESS, userBalance)
      expectBalanceOf(l1_canonicalToken, user, BigNumber.from('0'))

      await expect(
        executeL1BridgeSendToL2AndAttemptToSwap(
          l1_canonicalToken,
          l1_bridge,
          transfer.sender,
          transfer.amount,
          l2ChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('bondTransferRoot', async () => {
    it('Should not allow a transfer root to be bonded unless it is called by the bonder', async () => {
      const expectedErrorMsg: string = 'ACT: Caller is not bonder'

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await expect(
        l1_bridge
          .connect(user)
          .bondTransferRoot(rootHash, transfer.chainId, transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded that exceeds the bonders credit', async () => {
      const expectedErrorMsg: string = 'ACT: Not enough available credit'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      const newTransfer: Transfer = Object.assign({}, transfer)
      newTransfer.amount = BONDER_INITIAL_BALANCE.mul(2)

      await expect(
        executeL1BridgeBondTransferRoot(
          l1_bridge,
          newTransfer,
          bonder,
          rootHash
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root has already been confirmed', async () => {
      const expectedErrorMsg: string = '1'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      await l1_messenger.relayNextMessage()

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      await expect(
        executeL1BridgeBondTransferRoot(
          l1_bridge,
          transfer,
          bonder,
          rootHash
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root has already been bonded', async () => {
      const expectedErrorMsg: string =
        'L1_BRG: Transfer Root has already been bonded'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      await expect(
        executeL1BridgeBondTransferRoot(
          l1_bridge,
          transfer,
          bonder,
          rootHash
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the transfer root was already set', async () => {
      // This is not possible, as the only way to get to this code on the L1_Bridge would be to bond the same
      // mainnet transfer root twice, however this will be blocked by the bond reuse check prior to execution here
    })

    it('Should not allow a transfer root to be bonded if a mainnet transfer root amount is 0', async () => {
      const expectedErrorMsg: string =
        'BRG: Cannot set TransferRoot amount of 0'
      const newTransfer: Transfer = Object.assign({}, transfer)
      newTransfer.amount = BigNumber.from('0')

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      await expect(
        executeL1BridgeBondTransferRoot(
          l1_bridge,
          newTransfer,
          bonder,
          rootHash
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be bonded if the the messenger wrapper is not set for an L2 to L2 transfer', async () => {
      const expectedErrorMsg: string = 'L1_BRG: chainId not supported'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        l2Transfer.sender,
        l2Transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        l2Transfer 
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
          l2Transfer,
        bonder
      )

      const transferId: Buffer = await l2Transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)

      await l1_bridge.setCrossDomainMessengerWrapper(
        l2Transfer.chainId,
        ZERO_ADDRESS
      )

      await expect(
        executeL1BridgeBondTransferRoot(
          l1_bridge,
          l2Transfer,
          bonder,
          rootHash
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('confirmTransferRoot', async () => {
    it('Should not allow a transfer root to be confirmed by anybody except the L2_Bridge', async () => {
      // TODO -- wait until the `onlyL2Bridge` modifier has been implemented
    })

    it('Should not allow a transfer root to be confirmed if it was already confirmed', async () => {
      const expectedErrorMsg: string = 'L1_BRG: TransferRoot already confirmed'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      await l1_messenger.relayNextMessage()

      // The only way for this to happen in production is for the canonical messenger to relay the same message twice.
      // Our Mock Messenger allows for this and reverts with the bridge's error message

      await expect(
        l1_messenger.relayNextMessage()
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be confirmed if a mainnet transfer root amount is 0', async () => {
      // This is not possible to check, as `L2_Bridge.send()` and `L2_Bridge.swapAndSend()` perform this check
      // and disallow it on that level.
    })

    it('Should not allow a transfer root to be confirmed if the messenger wrapper for the L2 is not defined', async () => {
      const expectedErrorMsg: string = 'L1_BRG: chainId not supported'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        l2Transfer 
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2Transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        l2Transfer,
        bonder
      )

      // Unset the supported chainId for this test
      await l1_bridge.setCrossDomainMessengerWrapper(l2Transfer.chainId, ZERO_ADDRESS)

      await expect(
        l1_messenger.relayNextMessage()
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('challengeTransferBond', async () => {
    it('Should not allow a transfer root to be challenged if the transfer root has already been confirmed', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Transfer root has already been confirmed'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      // Confirm the transfer root
      await l1_messenger.relayNextMessage()

      await expect(
        executeL1BridgeChallengeTransferBond(
          l1_canonicalToken,
          l1_bridge,
          transfer.amount,
          bonder,
          challenger,
          rootHash
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if the transfer root is challenged after the challenge period', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Transfer root cannot be challenged after challenge period'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      // Wait until after the challenge period
      const challengePeriod: BigNumber = await l1_bridge.challengePeriod()
      await increaseTime(challengePeriod.toNumber())

      await expect(
        executeL1BridgeChallengeTransferBond(
          l1_canonicalToken,
          l1_bridge,
          transfer.amount,
          bonder,
          challenger,
          rootHash
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if the transfer root has already been challenged', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Transfer root already challenged'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        transfer.amount,
        bonder,
        challenger,
        rootHash
      )

      await expect(
        executeL1BridgeChallengeTransferBond(
          l1_canonicalToken,
          l1_bridge,
          transfer.amount,
          bonder,
          challenger,
          rootHash
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if the challenger does not approve the tokens to challenge with', async () => {
      const expectedErrorMsg: string = 'ERC20: transfer amount exceeds allowance'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      await expect(
        l1_bridge
          .connect(challenger)
          .challengeTransferBond(rootHash, transfer.amount)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if the challenger does not have enough tokens to challenge with', async () => {
      const expectedErrorMsg: string = 'ERC20: transfer amount exceeds balance'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      const challengerBalance: BigNumber = await l1_canonicalToken.balanceOf(await challenger.getAddress())
      await l1_canonicalToken.connect(challenger).transfer(DEAD_ADDRESS, challengerBalance)

      await expect(
        executeL1BridgeChallengeTransferBond(
          l1_canonicalToken,
          l1_bridge,
          transfer.amount,
          bonder,
          challenger,
          rootHash
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if an arbitrary root hash is passed in', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Transfer root cannot be challenged after challenge period'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      const challengerBalance: BigNumber = await l1_canonicalToken.balanceOf(await challenger.getAddress())
      await l1_canonicalToken.connect(challenger).transfer(DEAD_ADDRESS, challengerBalance)

      await expect(
        executeL1BridgeChallengeTransferBond(
          l1_canonicalToken,
          l1_bridge,
          transfer.amount,
          bonder,
          challenger,
          ARBITRARY_ROOT_HASH
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root to be challenged if an incorrect originalAmount is passed in', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Transfer root cannot be challenged after challenge period'
      const incorrectAmount: BigNumber = BigNumber.from('13371337')

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      await expect(
        executeL1BridgeChallengeTransferBond(
          l1_canonicalToken,
          l1_bridge,
          incorrectAmount,
          bonder,
          challenger,
          ARBITRARY_ROOT_HASH
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('resolveChallenge', async () => {
    it('Should not allow a transfer root challenge to be resolved if the transfer root was never challenged', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Transfer root has not been challenged'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      const shouldResolveSuccessfully: boolean = false

      await expect(
        executeL1BridgeResolveChallenge(
          l1_canonicalToken,
          l1_bridge,
          transfer.amount,
          bonder,
          challenger,
          rootHash,
          shouldResolveSuccessfully
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root challenge to be resolved if the transfer root challenge period is not over', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Challenge period has not ended'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        transfer.amount,
        bonder,
        challenger,
        rootHash
      )

      // Resolve the challenge
      // Do not increase the time
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = false
      await expect(
        executeL1BridgeResolveChallenge(
          l1_canonicalToken,
          l1_bridge,
          transfer.amount,
          bonder,
          challenger,
          rootHash,
          shouldResolveSuccessfully
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root challenge to be resolved if an arbitrary root hash is passed in', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Transfer root has not been challenged'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        transfer.amount,
        bonder,
        challenger,
        rootHash
      )

      // Resolve the challenge
      const numDaysToWait: number = 9 * SECONDS_IN_A_DAY
      await increaseTime(numDaysToWait)
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = false
      await expect(
        executeL1BridgeResolveChallenge(
          l1_canonicalToken,
          l1_bridge,
          transfer.amount,
          bonder,
          challenger,
          ARBITRARY_ROOT_HASH,
          shouldResolveSuccessfully
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root challenge to be resolved if it has already been resolved', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Transfer root already resolved'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        transfer.amount,
        bonder,
        challenger,
        rootHash
      )

      // Resolve the challenge
      const numDaysToWait: number = 9 * SECONDS_IN_A_DAY
      await increaseTime(numDaysToWait)
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = false
      await executeL1BridgeResolveChallenge(
        l1_canonicalToken,
        l1_bridge,
        transfer.amount,
        bonder,
        challenger,
        rootHash,
        shouldResolveSuccessfully
      )

      await expect(
        executeL1BridgeResolveChallenge(
          l1_canonicalToken,
          l1_bridge,
          transfer.amount,
          bonder,
          challenger,
          rootHash,
          shouldResolveSuccessfully
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a transfer root challenge to be resolved if an incorrect originalAmount is passed in', async () => {
      const expectedErrorMsg: string = 'L1_BRG: Transfer root has not been challenged'
      const incorrectAmount: BigNumber = BigNumber.from('13371337')

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        l2_messenger,
        transfer.sender,
        transfer.amount,
        l2ChainId
      )

      await executeL2BridgeSend(
        l2_bridge,
        transfer
      )

      await executeL1BridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        transfer,
        bonder
      )

      const transferId: Buffer = await transfer.getTransferId()
      const { rootHash } = getRootHashFromTransferId(transferId)
  
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        transfer,
        bonder,
        rootHash
      )

      await executeL1BridgeChallengeTransferBond(
        l1_canonicalToken,
        l1_bridge,
        transfer.amount,
        bonder,
        challenger,
        rootHash
      )

      // Resolve the challenge
      const numDaysToWait: number = 9 * SECONDS_IN_A_DAY
      await increaseTime(numDaysToWait)
      await l1_messenger.relayNextMessage()

      const shouldResolveSuccessfully: boolean = false
      await expect(
        executeL1BridgeResolveChallenge(
          l1_canonicalToken,
          l1_bridge,
          incorrectAmount,
          bonder,
          challenger,
          rootHash,
          shouldResolveSuccessfully
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  // TODO: Edge cases
})
