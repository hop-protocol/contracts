import '@nomiclabs/hardhat-waffle'
import { expect } from 'chai'
import { Signer, Contract, BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import Transfer from '../../lib/Transfer'

import {
  setUpDefaults,
  expectBalanceOf,
  getRootHashFromTransferId,
  getTransferNonce,
  increaseTime,
  revertSnapshot,
  takeSnapshot,
  getTransferNonceFromEvent
} from '../shared/utils'
import {
  executeCanonicalBridgeSendTokens,
  getSetL1GovernanceMessage,
  getAddBonderMessage,
  executeL1BridgeSendToL2,
  executeBridgeBondWithdrawal,
  executeL1BridgeBondTransferRoot,
  executeBridgeSettleBondedWithdrawals,
  executeL1BridgeChallengeTransferBond,
  executeL1BridgeResolveChallenge,
  executeL2BridgeSend,
  executeL2AmmWrapperSwapAndSend,
  executeL2BridgeCommitTransfers,
  executeL2BridgeBondWithdrawalAndDistribute,
  executeCanonicalMessengerSendMessage,
  getSetAmmWrapperMessage,
  getSetBridgeConnectorMessage,
  getSetL1CallerMessage,
  getAddActiveChainIdsMessage,
  getRemoveActiveChainIdsMessage,
  getSetMinimumForceCommitDelayMessage,
  getSetMaxPendingTransfersMessage,
  getSetHopBridgeTokenOwnerMessage,
  getSetMinimumBonderFeeRequirementsMessage
} from '../shared/contractFunctionWrappers'
import { fixture } from '../shared/fixtures'
import { IFixture } from '../shared/interfaces'

import {
  CHAIN_IDS,
  ALL_SUPPORTED_CHAIN_IDS,
  DEFAULT_AMOUNT_OUT_MIN,
  DEFAULT_DEADLINE,
  ONE_ADDRESS,
  INITIAL_BONDED_AMOUNT,
  LIQUIDITY_PROVIDER_AMM_AMOUNT,
  ZERO_ADDRESS,
  SECONDS_IN_AN_HOUR,
  SECONDS_IN_A_DAY,
  TIMESTAMP_VARIANCE,
  DEAD_ADDRESS,
  ARBITRARY_ROOT_HASH,
  DEFAULT_H_BRIDGE_TOKEN_NAME,
  DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
  DEFAULT_H_BRIDGE_TOKEN_DECIMALS,
  DEFAULT_TIME_TO_WAIT,
  DEFAULT_RELAYER_FEE
} from '../../config/constants'

describe('L2_Bridge', () => {
  let _fixture: IFixture
  let l1ChainId: BigNumber
  let l2ChainId: BigNumber
  let l22ChainId: BigNumber

  let user: Signer
  let bonder: Signer
  let governance: Signer
  let relayer: Signer
  let otherUser: Signer

  let l1_canonicalToken: Contract
  let l1_bridge: Contract
  let l1_canonicalBridge: Contract
  let l1_messenger: Contract
  let l1_messengerWrapper: Contract
  let l2_canonicalToken: Contract
  let l2_hopBridgeToken: Contract
  let l2_bridge: Contract
  let l2_messenger: Contract
  let l2_swap: Contract
  let l2_ammWrapper: Contract
  let l22_canonicalToken: Contract
  let l22_hopBridgeToken: Contract
  let l22_bridge: Contract
  let l22_messenger: Contract
  let l22_swap: Contract

  let transfers: Transfer[]
  let transfer: Transfer
  let l2Transfer: Transfer

  let originalBondedAmount: BigNumber
  let defaultRelayerFee: BigNumber

  let beforeAllSnapshotId: string
  let snapshotId: string

  before(async () => {
    beforeAllSnapshotId = await takeSnapshot()

    l1ChainId = CHAIN_IDS.ETHEREUM.KOVAN
    l2ChainId = CHAIN_IDS.OPTIMISM.OPTIMISM_TESTNET
    l22ChainId = CHAIN_IDS.OPTIMISM.OPTIMISM_MAINNET

    _fixture = await fixture(l1ChainId, l2ChainId)
    await setUpDefaults(_fixture)
    ;({
      user,
      bonder,
      governance,
      relayer,
      otherUser,
      l1_canonicalToken,
      l1_bridge,
      l1_messenger,
      l1_messengerWrapper,
      l1_canonicalBridge,
      l2_canonicalToken,
      l2_hopBridgeToken,
      l2_bridge,
      l2_messenger,
      l2_swap,
      l2_ammWrapper,
      transfers
    } = _fixture)

    const l1AlreadySetOpts = {
      l1BridgeAddress: l1_bridge.address,
      l1CanonicalTokenAddress: l1_canonicalToken.address
    }
    _fixture = await fixture(l1ChainId, l22ChainId, l1AlreadySetOpts)
    await setUpDefaults(_fixture)
    ;({
      l2_canonicalToken: l22_canonicalToken,
      l2_hopBridgeToken: l22_hopBridgeToken,
      l2_bridge: l22_bridge,
      l2_messenger: l22_messenger,
      l2_swap: l22_swap
    } = _fixture)

    transfer = transfers[0]
    l2Transfer = transfers[1]

    originalBondedAmount = LIQUIDITY_PROVIDER_AMM_AMOUNT.add(
      INITIAL_BONDED_AMOUNT
    )
    defaultRelayerFee = DEFAULT_RELAYER_FEE

    // All tests in L2 Bridge will require sending tokens to the L2 bridge first
    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_swap,
      transfer.sender,
      transfer.recipient,
      relayer,
      transfer.amount,
      transfer.amountOutMin,
      transfer.deadline,
      defaultRelayerFee,
      l2ChainId
    )
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
   * Unit tests
   */

  it('Should set the correct values in the constructor', async () => {
    const expectedL1GovernanceAddress: string = await governance.getAddress()
    const expectedIsChainIdSupported: boolean = true
    const expectedIsBonder: boolean = true
    const expectedName: string = DEFAULT_H_BRIDGE_TOKEN_NAME
    const expectedSymbol: string = DEFAULT_H_BRIDGE_TOKEN_SYMBOL
    const expectedDecimals: number = DEFAULT_H_BRIDGE_TOKEN_DECIMALS

    const l1GovernanceAddress = await l2_bridge.owner()
    const isBonder = await l2_bridge.getIsBonder(await bonder.getAddress())
    const name: string = await l2_hopBridgeToken.name()
    const symbol: string = await l2_hopBridgeToken.symbol()
    const decimals: number = await l2_hopBridgeToken.decimals()

    expect(expectedL1GovernanceAddress).to.eq(l1GovernanceAddress)
    expect(expectedIsBonder).to.eq(isBonder)
    expect(expectedName).to.eq(name)
    expect(expectedSymbol).to.eq(symbol)
    expect(expectedDecimals).to.eq(decimals)

    for (let i = 0; i < ALL_SUPPORTED_CHAIN_IDS.length; i++) {
      const isChainIdSupported = await l2_bridge.activeChainIds(
        ALL_SUPPORTED_CHAIN_IDS[i]
      )
      expect(expectedIsChainIdSupported).to.eq(isChainIdSupported)
    }
  })

  describe('setters and getters', async () => {
    it('Should set the l1 owner address arbitrarily', async () => {
      const expectedGovernanceAddress: string = ONE_ADDRESS

      await l2_bridge.connect(governance).transferOwnership(
        expectedGovernanceAddress
      )

      const governanceAddress: string = await l2_bridge.owner()
      expect(governanceAddress).to.eq(expectedGovernanceAddress)
    })

    it('Should set the amm wrapper address arbitrarily', async () => {
      const expectedAmmWrapperAddress: string = ONE_ADDRESS

      await l2_bridge.connect(governance).setAmmWrapper(
        expectedAmmWrapperAddress
      )

      const exchangeAddress: string = await l2_bridge.ammWrapper()
      expect(exchangeAddress).to.eq(expectedAmmWrapperAddress)
    })

    it('Should set the L1 bridge connector arbitrarily', async () => {
      const expectedBridgeConnectorAddress: string = ONE_ADDRESS

      await l2_bridge.connect(governance).setBridgeConnector(
        expectedBridgeConnectorAddress
      )

      const l1BridgeAddress: string = await l2_bridge.bridgeConnector()
      expect(l1BridgeAddress).to.eq(expectedBridgeConnectorAddress)
    })

    it('Should add support for a new chainId', async () => {
      const newChainId: BigNumber[] = [BigNumber.from('13371337')]

      await l2_bridge.connect(governance).addActiveChainIds(
        newChainId
      )

      const isChainIdSupported: boolean = await l2_bridge.activeChainIds(
        newChainId[0]
      )
      expect(isChainIdSupported).to.eq(true)
    })

    it('Should add support for a new chainId then remove it', async () => {
      const newChainId: BigNumber[] = [BigNumber.from('13371337')]

      await l2_bridge.connect(governance).addActiveChainIds(
        newChainId
      )

      let isChainIdSupported: boolean = await l2_bridge.activeChainIds(
        newChainId[0]
      )
      expect(isChainIdSupported).to.eq(true)

      await l2_bridge.connect(governance).removeActiveChainIds(
        newChainId
      )

      isChainIdSupported = await l2_bridge.activeChainIds(newChainId[0])
      expect(isChainIdSupported).to.eq(false)
    })

    it('Should set the minimum force commit delay arbitrarily', async () => {
      const expectedMinimumForceCommitDelay: BigNumber = BigNumber.from('123')

      await l2_bridge.connect(governance).setMinimumForceCommitDelay(
        expectedMinimumForceCommitDelay
      )

      const minimumForceCommitDelay: BigNumber = await l2_bridge.minimumForceCommitDelay()
      expect(minimumForceCommitDelay).to.eq(expectedMinimumForceCommitDelay)
    })

    it('Should set the max pending transfers arbitrarily', async () => {
      const expectedMaxPendingTransfers: BigNumber = BigNumber.from('123')

      await l2_bridge.connect(governance).setMaxPendingTransfers(
        expectedMaxPendingTransfers
      )

      const maxPendingTransfers: BigNumber = await l2_bridge.maxPendingTransfers()
      expect(maxPendingTransfers).to.eq(expectedMaxPendingTransfers)
    })

    it('Should set a new owner of the HopBridgeToken', async () => {
      let hopBridgeTokenOwner: string = await l2_hopBridgeToken.owner()
      expect(hopBridgeTokenOwner).to.eq(l2_bridge.address)

      const newOwner: Signer = user
      await l2_bridge.connect(governance).setHopBridgeTokenOwner(
        await newOwner.getAddress()
      )

      hopBridgeTokenOwner = await l2_hopBridgeToken.owner()
      expect(hopBridgeTokenOwner).to.eq(await newOwner.getAddress())
    })

    it('Should set the minimum bonder fee requirements', async () => {
      const expectedMinBonderBps: BigNumber = BigNumber.from('123')
      const expectedMinBonderFeeAbsolute: BigNumber = BigNumber.from('73317331')

      await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
        expectedMinBonderBps,
        expectedMinBonderFeeAbsolute
      )

      const minBonderBps = await l2_bridge.minBonderBps()
      const minBonderFeeAbsolute = await l2_bridge.minBonderFeeAbsolute()
      expect(minBonderBps).to.eq(expectedMinBonderBps)
      expect(minBonderFeeAbsolute).to.eq(expectedMinBonderFeeAbsolute)
    })

    it('Should get the next transfer nonce', async () => {
      const expectedNextTransferNonce: string = '0xa8318a28a1fe6af053ce810a7524c1e62804c5ec4627168b3a8e68dc430b1183'
      const nextTransferNonce = await l2_bridge.getNextTransferNonce()
      expect(nextTransferNonce).to.eq(expectedNextTransferNonce)
    })
  })

  describe('send', async () => {
    it('Should send tokens to L1 via send', async () => {
      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)
    })
  })

  describe('commitTransfers', async () => {
    it.skip('Should commit a transfer automatically after maxPendingAmount sends', async () => {
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.amount = BigNumber.from('100')
      customTransfer.bonderFee = BigNumber.from('0')

      const maxPendingTransfers: BigNumber = await l2_bridge.maxPendingTransfers()
      for (let i = 0; i <= (Number(maxPendingTransfers)); i++) {
        await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)
      }

      // After the commit, the contract state should have a single index for pendingTransferIds.
      const expectedErrorMsg: string =
        'VM Exception while processing transaction: invalid opcode'
      try {
        await l2_bridge.pendingTransferIds(transfer.chainId, await bonder.getAddress(), 1)
        throw new Error(
          'There should not be a pending transfer ID for chainId in this slot.'
        )
      } catch (err) {
        expect(err.message).to.eq(expectedErrorMsg)
      }
    })

    it('Should commit a transfer after the minForceCommitTime', async () => {
      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      const timeToWait: number = 4 * SECONDS_IN_AN_HOUR
      await increaseTime(timeToWait)

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], user)
    })

    it('Should commit a transfer by the bonder at any time', async () => {
      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        transfer,
        bonder
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)
    })

    it('Should commit a transfer with two sends -- to L1 and to L2', async () => {
      const customTransfer: Transfer = new Transfer(transfer)
      const customL2Transfer: Transfer = new Transfer(l2Transfer)
      customTransfer.amount = transfer.amount.div(4)
      customL2Transfer.amount = transfer.amount.div(4)

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

      const expectedTransferIndex: BigNumber = BigNumber.from('1')
      await executeL2BridgeSend(
        l2_hopBridgeToken,
        l2_bridge,
        customL2Transfer,
        expectedTransferIndex
      )

      await executeBridgeBondWithdrawal(
        l1_canonicalToken,
        l1_bridge,
        l2_bridge,
        customTransfer,
        bonder
      )

      // Bond withdrawal on other L2
      const actualTransferAmount: BigNumber = customL2Transfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        customL2Transfer,
        bonder,
        actualTransferAmount,
        expectedTransferIndex
      )

      await executeL2BridgeCommitTransfers(
        l2_bridge,
        [customTransfer],
        bonder
      )

      const startingIndex: BigNumber = BigNumber.from('1')
      await executeL2BridgeCommitTransfers(
        l2_bridge,
        [customL2Transfer],
        bonder,
        startingIndex
      )
    })
  })

  describe('distribute', async () => {
    it('Should send a transfer from L1 to L2 via distribute', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        transfer.sender,
        transfer.recipient,
        relayer,
        transfer.amount,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )
    })
  })

  describe('bondWithdrawalAndDistribute', async () => {
    it('Should send a transfer from one L2 to another L2 via bondWithdrawalAndDistribute', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        transfer.sender,
        transfer.recipient,
        relayer,
        transfer.amount,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      // Bond withdrawal on other L2
      const actualTransferAmount: BigNumber = l2Transfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        l2Transfer,
        bonder,
        actualTransferAmount
      )
    })
  })

  describe('setTransferRoot', async () => {
    it('Should set the transfer root', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        transfer.sender,
        transfer.recipient,
        relayer,
        transfer.amount,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      await executeL2BridgeCommitTransfers(l2_bridge, [l2Transfer], bonder)

      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        l2Transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await l1_messenger.relayNextMessage()
      await l22_messenger.relayNextMessage()

      const transferIndex: BigNumber = BigNumber.from('0')
      const transferNonce: string = await getTransferNonceFromEvent(
        l2_bridge,
        transferIndex
      )
      const transferId: Buffer = await l2Transfer.getTransferId(transferNonce)
      const { rootHash } = getRootHashFromTransferId(transferId)

      const transferRoot = await l22_bridge.getTransferRoot(
        rootHash,
        l2Transfer.amount
      )
      const currentTime: number = Math.floor(Date.now() / 1000)
      expect(transferRoot[0]).to.eq(l2Transfer.amount)
      expect(transferRoot[1]).to.eq(BigNumber.from('0'))
      expect(transferRoot[2].toNumber()).to.be.closeTo(
        currentTime,
        TIMESTAMP_VARIANCE
      )
    })
  })

  describe('getNextTransferNonce', async () => {
    it('Should get the next transfer nonce', async () => {
      const transferNonceIncrementer: BigNumber = await l2_bridge.transferNonceIncrementer()
      const expectedNextTransferNonce: string = getTransferNonce(
        transferNonceIncrementer,
        l2ChainId
      )
      const nextTransferNonce: string = await l2_bridge.getNextTransferNonce()
      expect(expectedNextTransferNonce).to.eq(nextTransferNonce)
    })
  })

  /**
   * Non-Happy Path
   */

  describe('setters', async () => {
    it('Should not allow an arbitrary address to set the owner address arbitrarily', async () => {
      const expectedErrorMsg: string = 'Ownable: caller is not the owner'
      const expectedL1GovernanceAddress: string = ONE_ADDRESS

      await expect(
        l2_bridge.connect(user).transferOwnership(
          expectedL1GovernanceAddress
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set the amm wrapper address arbitrarily', async () => {
      const expectedErrorMsg: string = 'Ownable: caller is not the owner'
      const expectedAmmWrapperAddress: string = ONE_ADDRESS

      const message: string = getSetAmmWrapperMessage(
        expectedAmmWrapperAddress
      )
      await expect(
        executeCanonicalMessengerSendMessage(
          l1_messenger,
          l1_messengerWrapper,
          l2_bridge,
          l2_messenger,
          user,
          message,
          l2ChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set the L1 bridge address arbitrarily', async () => {
      const expectedErrorMsg: string = 'Ownable: caller is not the owner'
      const expectedL1BridgeAddress: string = ONE_ADDRESS

      const message: string = getSetBridgeConnectorMessage(
        expectedL1BridgeAddress
      )
      await expect(
        executeCanonicalMessengerSendMessage(
          l1_messenger,
          l1_messengerWrapper,
          l2_bridge,
          l2_messenger,
          user,
          message,
          l2ChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to add support for a new chainId', async () => {
      const expectedErrorMsg: string = 'Ownable: caller is not the owner'
      const newChainId: BigNumber[] = [BigNumber.from('13371337')]

      const message: string = getAddActiveChainIdsMessage(newChainId)
      await expect(
        executeCanonicalMessengerSendMessage(
          l1_messenger,
          l1_messengerWrapper,
          l2_bridge,
          l2_messenger,
          user,
          message,
          l2ChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to remove support for a new chainId', async () => {
      const expectedErrorMsg: string = 'Ownable: caller is not the owner'
      const newChainId: BigNumber[] = [BigNumber.from('13371337')]

      await l2_bridge.connect(governance).addActiveChainIds(
        newChainId
      )

      let isChainIdSupported: boolean = await l2_bridge.activeChainIds(
        newChainId[0]
      )
      expect(isChainIdSupported).to.eq(true)

      let message = getRemoveActiveChainIdsMessage(newChainId)
      await expect(
        executeCanonicalMessengerSendMessage(
          l1_messenger,
          l1_messengerWrapper,
          l2_bridge,
          l2_messenger,
          user,
          message,
          l2ChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set the minimum force commit delay arbitrarily', async () => {
      const expectedErrorMsg: string = 'Ownable: caller is not the owner'
      const expectedMinimumForceCommitDelay: BigNumber = BigNumber.from('123')

      const message: string = getSetMinimumForceCommitDelayMessage(
        expectedMinimumForceCommitDelay
      )
      await expect(
        executeCanonicalMessengerSendMessage(
          l1_messenger,
          l1_messengerWrapper,
          l2_bridge,
          l2_messenger,
          user,
          message,
          l2ChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set the max pending transfers arbitrarily', async () => {
      const expectedErrorMsg: string = 'Ownable: caller is not the owner'
      const expectedMaxPendingTransfers: BigNumber = BigNumber.from('123')

      const message: string = getSetMaxPendingTransfersMessage(
        expectedMaxPendingTransfers
      )
      await expect(
        executeCanonicalMessengerSendMessage(
          l1_messenger,
          l1_messengerWrapper,
          l2_bridge,
          l2_messenger,
          user,
          message,
          l2ChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set a new owner of the HopBridgeToken', async () => {
      const expectedErrorMsg: string = 'Ownable: caller is not the owner'
      let hopBridgeTokenOwner: string = await l2_hopBridgeToken.owner()
      expect(hopBridgeTokenOwner).to.eq(l2_bridge.address)

      const newOwner: Signer = user
      const message: string = getSetHopBridgeTokenOwnerMessage(
        await newOwner.getAddress()
      )
      await expect(
        executeCanonicalMessengerSendMessage(
          l1_messenger,
          l1_messengerWrapper,
          l2_bridge,
          l2_messenger,
          user,
          message,
          l2ChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow an arbitrary address to set the minimum bonder fee requirements', async () => {
      const expectedErrorMsg: string = 'Ownable: caller is not the owner'
      const expectedMinBonderBps: BigNumber = BigNumber.from('13371337')
      const expectedMinBonderFeeAbsolute: BigNumber = BigNumber.from('73317331')

      const message: string = getSetMinimumBonderFeeRequirementsMessage(
        expectedMinBonderBps,
        expectedMinBonderFeeAbsolute
      )
      await expect(
        executeCanonicalMessengerSendMessage(
          l1_messenger,
          l1_messengerWrapper,
          l2_bridge,
          l2_messenger,
          user,
          message,
          l2ChainId
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow minimum bonder BPS to exceed 10,000', async () => {
      const expectedErrorMsg: string = 'L2_BRG: minBonderBps must not exceed 1000'
      const expectedMinBonderBps: BigNumber = BigNumber.from('13371337')
      const expectedMinBonderFeeAbsolute: BigNumber = BigNumber.from('73317331')

      await expect(
        l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
          expectedMinBonderBps,
          expectedMinBonderFeeAbsolute
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('send', async () => {
    it('Should not allow a send with an amount of 0', async () => {
      const expectedErrorMsg: string = 'L2_BRG: Must transfer a non-zero amount'
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.amount = BigNumber.from('0')
      await expect(
        executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a send with an amount less than the bonder fee', async () => {
      const expectedErrorMsg: string = 'L2_BRG: Bonder fee cannot exceed amount'
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.bonderFee = customTransfer.amount.add(1)
      await expect(
        executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a send to an unsupported chainId', async () => {
      const expectedErrorMsg: string = 'L2_BRG: chainId is not supported'
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.chainId = BigNumber.from('1337')
      await expect(
        executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a send with a bonder fee less than the min bonder fee', async () => {
      const expectedErrorMsg: string = 'L2_BRG: bonderFee must meet minimum requirements'
      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.bonderFee = BigNumber.from('1')
      await expect(
        executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a send if the user does not have enough tokens to send', async () => {
      const expectedErrorMsg: string = 'ERC20: burn amount exceeds balance'
      const senderBalance: BigNumber = await l2_hopBridgeToken.balanceOf(await transfer.sender.getAddress())
      await l2_hopBridgeToken.connect(transfer.sender).transfer(ONE_ADDRESS, senderBalance)
      await expect(
        executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('commitTransfers', async () => {
    it('Should not allow a commitTransfers if an arbitrary user calls it before the min time', async () => {
      const expectedErrorMsg: string = 'L2_BRG: Only Bonder can commit before min delay'

      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        transfer.sender,
        transfer.recipient,
        relayer,
        transfer.amount.mul(2),
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)
      await l2_bridge.connect(bonder).commitTransfers(transfer.chainId, await bonder.getAddress())

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)
      await expect(
        l2_bridge.connect(transfer.sender).commitTransfers(transfer.chainId, await bonder.getAddress())
      ).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow a commitTransfers if there are no transfers to commit', async () => {
      const expectedErrorMsg: string = 'L2_BRG: Must commit at least 1 Transfer'
      await expect(
        l2_bridge.connect(transfer.sender).commitTransfers(transfer.chainId, await bonder.getAddress())
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('distribute', async () => {
    it('Should not allow an arbitrary address to call distribute', async () => {
      const expectedErrorMsg: string = 'L2_BRG: xDomain caller must be L1 Bridge'
      await expect(
        l2_bridge
          .connect(transfer.sender)
          .distribute(
            await transfer.recipient.getAddress(),
            transfer.amount,
            [
              '1',
              transfer.amountOutMin,
              transfer.deadline
            ],
            await transfer.recipient.getAddress(),
            transfer.bonderFee
          )
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('bondWithdrawalAndDistribute', async () => {
    it('Should not allow an arbitrary address to call bondWithdrawalAndDistribute', async () => {
      const expectedErrorMsg: string = 'ACT: Caller is not registered bonder'
      await expect(
        l2_bridge
          .connect(transfer.sender)
          .bondWithdrawalAndDistribute(
            await transfer.recipient.getAddress(),
            transfer.amount,
            ARBITRARY_ROOT_HASH,
            transfer.bonderFee,
            [
              '1',
              transfer.amountOutMin,
              transfer.deadline
            ]
          )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    // ToDo: Fix when governance proxy is implemented
    // it('Should not allow a bonder to call bondWithdrawalAndDistribute if it will put their balance in the negative', async () => {
    //   const expectedErrorMsg: string = 'ACT: Not enough available credit'
    //   const message: string = getAddBonderMessage(await otherUser.getAddress())
    //   await executeCanonicalMessengerSendMessage(
    //     l1_messenger,
    //     l1_messengerWrapper,
    //     l2_bridge,
    //     l2_messenger,
    //     governance,
    //     message,
    //     l2ChainId
    //   )

    //   await expect(
    //     l2_bridge
    //       .connect(otherUser)
    //       .bondWithdrawalAndDistribute(
    //         await transfer.recipient.getAddress(),
    //         transfer.amount,
    //         ARBITRARY_ROOT_HASH,
    //         transfer.bonderFee,
    //         [
    //           '1',
    //           transfer.amountOutMin,
    //           transfer.deadline
    //         ]
    //       )
    //   ).to.be.reverted
    // })

    it('Should not allow the bonder to call bondWithdrawalAndDistribute if it has already been bonded', async () => {
      const expectedErrorMsg: string = 'BRG: Withdrawal has already been bonded'
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        transfer.sender,
        transfer.recipient,
        relayer,
        transfer.amount,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

      // Bond withdrawal on other L2
      const actualTransferAmount: BigNumber = l2Transfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        l2Transfer,
        bonder,
        actualTransferAmount
      )

      await expect(
        executeL2BridgeBondWithdrawalAndDistribute(
          l2_bridge,
          l22_hopBridgeToken,
          l22_bridge,
          l22_canonicalToken,
          l22_swap,
          l2Transfer,
          bonder,
          actualTransferAmount
        )
      ).to.be.revertedWith(expectedErrorMsg)
    })

    // ToDo: Fix when governance proxy is implemented
    // it('Should not allow a different bonder to call bondWithdrawalAndDistribute if it has already been bonded', async () => {
    //   const expectedErrorMsg: string = 'BRG: The transfer has already been withdrawn'

    //   const message: string = getAddBonderMessage(await otherUser.getAddress())
    //   await executeCanonicalMessengerSendMessage(
    //     l1_messenger,
    //     l1_messengerWrapper,
    //     l22_bridge,
    //     l2_messenger,
    //     governance,
    //     message,
    //     l2ChainId
    //   )

    //   await executeL1BridgeSendToL2(
    //     l1_canonicalToken,
    //     l1_bridge,
    //     l2_hopBridgeToken,
    //     l2_canonicalToken,
    //     l2_messenger,
    //     l2_swap,
    //     transfer.sender,
    //     transfer.recipient,
    //     relayer,
    //     transfer.amount,
    //     transfer.amountOutMin,
    //     transfer.deadline,
    //     defaultRelayerFee,
    //     l2ChainId
    //   )

    //   await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)

    //   // Bond withdrawal on other L2
    //   const actualTransferAmount: BigNumber = l2Transfer.amount
    //   await executeL2BridgeBondWithdrawalAndDistribute(
    //     l2_bridge,
    //     l22_hopBridgeToken,
    //     l22_bridge,
    //     l22_canonicalToken,
    //     l22_swap,
    //     l2Transfer,
    //     bonder,
    //     actualTransferAmount
    //   )

    //   await expect(
    //     executeL2BridgeBondWithdrawalAndDistribute(
    //       l2_bridge,
    //       l22_hopBridgeToken,
    //       l22_bridge,
    //       l22_canonicalToken,
    //       l22_swap,
    //       l2Transfer,
    //       otherUser,
    //       actualTransferAmount
    //     )
    //   ).to.be.revertedWith(expectedErrorMsg)
    // })
  })

  describe('setTransferRoot', async () => {
    it('Should not set a transfer root if it is set by an arbitrary address', async () => {
      const expectedErrorMsg: string =
        'L2_BRG: xDomain caller must be L1 Bridge'

      const totalAmount: BigNumber = BigNumber.from('0')
      await expect(
        l2_bridge.setTransferRoot(ARBITRARY_ROOT_HASH, totalAmount)
      ).to.be.revertedWith(expectedErrorMsg)
    })
  })

  describe('Edge cases', async () => {
    it('Should send tokens to L2 via send', async () => {
      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, l2Transfer)
    })

    it('Should allow a send with an amount equal to the bonder fee', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        transfer.sender,
        transfer.recipient,
        relayer,
        transfer.amount.mul(2),
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.bonderFee = customTransfer.amount

      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)
    })

    it('Should perform an L2 to L1 send, bond it, and commit transfer with an amount equal to the bonder fee', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        transfer.sender,
        transfer.recipient,
        relayer,
        transfer.amount,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      const customTransfer: Transfer = new Transfer(transfer)
      customTransfer.bonderFee = customTransfer.amount
      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

      // Bond withdrawal on L1
      await executeL1BridgeBondTransferRoot(
        l1_bridge,
        l2_bridge,
        transfer,
        bonder,
        DEFAULT_TIME_TO_WAIT
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [customTransfer], bonder)
    })

    it('Should perform an L2 to L2 send, bond it, and commit transfer with an amount equal to the bonder fee', async () => {
      await executeL1BridgeSendToL2(
        l1_canonicalToken,
        l1_bridge,
        l2_hopBridgeToken,
        l2_canonicalToken,
        l2_messenger,
        l2_swap,
        transfer.sender,
        transfer.recipient,
        relayer,
        transfer.amount,
        transfer.amountOutMin,
        transfer.deadline,
        defaultRelayerFee,
        l2ChainId
      )

      const customTransfer: Transfer = new Transfer(l2Transfer)
      customTransfer.bonderFee = customTransfer.amount
      await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

      // Bond withdrawal on other L2
      const actualTransferAmount: BigNumber = customTransfer.amount
      await executeL2BridgeBondWithdrawalAndDistribute(
        l2_bridge,
        l22_hopBridgeToken,
        l22_bridge,
        l22_canonicalToken,
        l22_swap,
        customTransfer,
        bonder,
        actualTransferAmount
      )

      await executeL2BridgeCommitTransfers(l2_bridge, [customTransfer], bonder)
    })
  })

  it('Should allow a user to send from L2 to L1 and perform a bonded withdrawal with an unusual bonder fee (0 wei)', async () => {
    const minBonderBps: BigNumber = BigNumber.from('0')
    const minBonderFeeAbsolute: BigNumber = BigNumber.from('0')

    await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
      minBonderBps,
      minBonderFeeAbsolute 
    )

    const customTransfer: Transfer = new Transfer(transfer)
    customTransfer.bonderFee = BigNumber.from('0')

    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_swap,
      transfer.sender,
      transfer.recipient,
      relayer,
      transfer.amount,
      transfer.amountOutMin,
      transfer.deadline,
      defaultRelayerFee,
      l2ChainId
    )

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

    await executeBridgeBondWithdrawal(
      l1_canonicalToken,
      l1_bridge,
      l2_bridge,
      customTransfer,
      bonder
    )

    await executeL2BridgeCommitTransfers(l2_bridge, [customTransfer], bonder)

    const timeToWait: number = 11 * SECONDS_IN_A_DAY
    await increaseTime(timeToWait)
    await l1_messenger.relayNextMessage()
  })

  it('Should allow a user to send from L2 to L1 and perform a bonded withdrawal with an unusual bonder fee (1 wei)', async () => {
    const minBonderBps: BigNumber = BigNumber.from('0')
    const minBonderFeeAbsolute: BigNumber = BigNumber.from('1')

    await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
      minBonderBps,
      minBonderFeeAbsolute 
    )

    const customTransfer: Transfer = new Transfer(transfer)
    customTransfer.bonderFee = BigNumber.from('1')

    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_swap,
      transfer.sender,
      transfer.recipient,
      relayer,
      transfer.amount,
      transfer.amountOutMin,
      transfer.deadline,
      defaultRelayerFee,
      l2ChainId
    )

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

    await executeBridgeBondWithdrawal(
      l1_canonicalToken,
      l1_bridge,
      l2_bridge,
      customTransfer,
      bonder
    )

    await executeL2BridgeCommitTransfers(l2_bridge, [customTransfer], bonder)

    const timeToWait: number = 11 * SECONDS_IN_A_DAY
    await increaseTime(timeToWait)
    await l1_messenger.relayNextMessage()
  })

  it('Should allow a user to send from L2 to L1 and perform a bonded withdrawal with an unusual bonder fee (full amount)', async () => {
    const minBonderBps: BigNumber = BigNumber.from('0')
    const minBonderFeeAbsolute: BigNumber = transfer.amount

    await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
      minBonderBps,
      minBonderFeeAbsolute 
    )

    const customTransfer: Transfer = new Transfer(transfer)
    customTransfer.bonderFee = transfer.amount

    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_swap,
      transfer.sender,
      transfer.recipient,
      relayer,
      transfer.amount,
      transfer.amountOutMin,
      transfer.deadline,
      defaultRelayerFee,
      l2ChainId
    )

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

    await executeBridgeBondWithdrawal(
      l1_canonicalToken,
      l1_bridge,
      l2_bridge,
      customTransfer,
      bonder
    )

    await executeL2BridgeCommitTransfers(l2_bridge, [customTransfer], bonder)

    const timeToWait: number = 11 * SECONDS_IN_A_DAY
    await increaseTime(timeToWait)
    await l1_messenger.relayNextMessage()
  })

  it('Should send a transfer from one L2 to another L2 via bondWithdrawalAndDistribute with an unusual bonder fee (0 wei)', async () => {
    const minBonderBps: BigNumber = BigNumber.from('0')
    const minBonderFeeAbsolute: BigNumber = BigNumber.from('0')

    await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
      minBonderBps,
      minBonderFeeAbsolute 
    )

    const customTransfer: Transfer = new Transfer(l2Transfer)
    customTransfer.bonderFee = BigNumber.from('0')

    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_swap,
      transfer.sender,
      transfer.recipient,
      relayer,
      transfer.amount,
      transfer.amountOutMin,
      transfer.deadline,
      defaultRelayerFee,
      l2ChainId
    )

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

    // Bond withdrawal on other L2
    const actualTransferAmount: BigNumber = customTransfer.amount
    await executeL2BridgeBondWithdrawalAndDistribute(
      l2_bridge,
      l22_hopBridgeToken,
      l22_bridge,
      l22_canonicalToken,
      l22_swap,
      customTransfer,
      bonder,
      actualTransferAmount
    )
  })

  it('Should send a transfer from one L2 to another L2 via bondWithdrawalAndDistribute with an unusual bonder fee (1 wei)', async () => {
    const minBonderBps: BigNumber = BigNumber.from('0')
    const minBonderFeeAbsolute: BigNumber = BigNumber.from('1')

    await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
      minBonderBps,
      minBonderFeeAbsolute 
    )

    const customTransfer: Transfer = new Transfer(l2Transfer)
    customTransfer.bonderFee = BigNumber.from('1')

    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_swap,
      transfer.sender,
      transfer.recipient,
      relayer,
      transfer.amount,
      transfer.amountOutMin,
      transfer.deadline,
      defaultRelayerFee,
      l2ChainId
    )

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

    // Bond withdrawal on other L2
    const actualTransferAmount: BigNumber = customTransfer.amount
    await executeL2BridgeBondWithdrawalAndDistribute(
      l2_bridge,
      l22_hopBridgeToken,
      l22_bridge,
      l22_canonicalToken,
      l22_swap,
      customTransfer,
      bonder,
      actualTransferAmount
    )
  })

  it('Should send a transfer from one L2 to another L2 via bondWithdrawalAndDistribute with an unusual bonder fee (full transfer amount)', async () => {
    const minBonderBps: BigNumber = BigNumber.from('0')
    const minBonderFeeAbsolute: BigNumber = transfer.amount

    await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
      minBonderBps,
      minBonderFeeAbsolute 
    )

    const customTransfer: Transfer = new Transfer(l2Transfer)
    customTransfer.bonderFee = l2Transfer.amount

    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_swap,
      transfer.sender,
      transfer.recipient,
      relayer,
      transfer.amount,
      transfer.amountOutMin,
      transfer.deadline,
      defaultRelayerFee,
      l2ChainId
    )

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

    // Bond withdrawal on other L2
    const actualTransferAmount: BigNumber = customTransfer.amount
    await executeL2BridgeBondWithdrawalAndDistribute(
      l2_bridge,
      l22_hopBridgeToken,
      l22_bridge,
      l22_canonicalToken,
      l22_swap,
      customTransfer,
      bonder,
      actualTransferAmount
    )
  })

  it('Should send a transfer from one L2 to another L2 via bondWithdrawalAndDistribute with an unusual bonder fee (0 wei)', async () => {
    const minBonderBps: BigNumber = BigNumber.from('0')
    const minBonderFeeAbsolute: BigNumber = BigNumber.from('0')

    await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
      minBonderBps,
      minBonderFeeAbsolute 
    )

    const customTransfer: Transfer = new Transfer(l2Transfer)
    customTransfer.bonderFee = BigNumber.from('0')

    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_swap,
      transfer.sender,
      transfer.recipient,
      relayer,
      transfer.amount,
      transfer.amountOutMin,
      transfer.deadline,
      defaultRelayerFee,
      l2ChainId
    )

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

    // Bond withdrawal on other L2
    const actualTransferAmount: BigNumber = customTransfer.amount
    await executeL2BridgeBondWithdrawalAndDistribute(
      l2_bridge,
      l22_hopBridgeToken,
      l22_bridge,
      l22_canonicalToken,
      l22_swap,
      customTransfer,
      bonder,
      actualTransferAmount
    )
  })

  it('Should send a transfer from one L2 to another L2 via bondWithdrawalAndDistribute with an unusual bonder fee (1 wei)', async () => {
    const minBonderBps: BigNumber = BigNumber.from('0')
    const minBonderFeeAbsolute: BigNumber = BigNumber.from('1')

    await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
      minBonderBps,
      minBonderFeeAbsolute 
    )

    const customTransfer: Transfer = new Transfer(l2Transfer)
    customTransfer.bonderFee = BigNumber.from('1')

    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_swap,
      transfer.sender,
      transfer.recipient,
      relayer,
      transfer.amount,
      transfer.amountOutMin,
      transfer.deadline,
      defaultRelayerFee,
      l2ChainId
    )

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

    // Bond withdrawal on other L2
    const actualTransferAmount: BigNumber = customTransfer.amount
    await executeL2BridgeBondWithdrawalAndDistribute(
      l2_bridge,
      l22_hopBridgeToken,
      l22_bridge,
      l22_canonicalToken,
      l22_swap,
      customTransfer,
      bonder,
      actualTransferAmount
    )
  })

  it('Should send a transfer from one L2 to another L2 via bondWithdrawalAndDistribute with an unusual bonder fee (full amount)', async () => {
    const minBonderBps: BigNumber = BigNumber.from('0')
    const minBonderFeeAbsolute: BigNumber = l2Transfer.amount

    await l2_bridge.connect(governance).setMinimumBonderFeeRequirements(
      minBonderBps,
      minBonderFeeAbsolute 
    )

    const customTransfer: Transfer = new Transfer(l2Transfer)
    customTransfer.bonderFee = l2Transfer.amount

    await executeL1BridgeSendToL2(
      l1_canonicalToken,
      l1_bridge,
      l2_hopBridgeToken,
      l2_canonicalToken,
      l2_messenger,
      l2_swap,
      transfer.sender,
      transfer.recipient,
      relayer,
      transfer.amount,
      transfer.amountOutMin,
      transfer.deadline,
      defaultRelayerFee,
      l2ChainId
    )

    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, customTransfer)

    // Bond withdrawal on other L2
    const actualTransferAmount: BigNumber = customTransfer.amount
    await executeL2BridgeBondWithdrawalAndDistribute(
      l2_bridge,
      l22_hopBridgeToken,
      l22_bridge,
      l22_canonicalToken,
      l22_swap,
      customTransfer,
      bonder,
      actualTransferAmount
    )
  })

  it('Should send a transaction, deactivate the receiving chain, bond the transfer, and commit a transfer by the bonder at any time', async () => {
    await executeL2BridgeSend(l2_hopBridgeToken, l2_bridge, transfer)

    await l2_bridge.connect(governance).removeActiveChainIds(
      [transfer.chainId]
    )

    const isChainIdSupported: boolean = await l2_bridge.activeChainIds(transfer.chainId)
    expect(isChainIdSupported).to.eq(false)

    await executeBridgeBondWithdrawal(
      l1_canonicalToken,
      l1_bridge,
      l2_bridge,
      transfer,
      bonder
    )

    await executeL2BridgeCommitTransfers(l2_bridge, [transfer], bonder)
  })
})
