import '@nomiclabs/hardhat-waffle'
import { ethers } from 'hardhat'
import { expect } from 'chai'
import { Signer, Contract, constants, utils } from 'ethers'

import { revertSnapshot, takeSnapshot } from '../shared/utils'
import { parseEther } from 'ethers/lib/utils'

describe('Validation Bridge Proxy', () => {

  /**
   * Setup
   */

  enum BridgeTxs {
    'bondTransferRoot',
    'BondWithdrawal',
    'bondWithdrawalAndDistribute'
  }

  // Addresses
  let bonder: Signer
  let otherUser: Signer

  // Contracts
  let mockValidationBridgeProxy: Contract
  let validationBridgeProxy: Contract
  let blockHashValidator: Contract
  let mockErc20: Contract

  // Config
  let baseCalldata: string
  let tx: any

  // Other
  let beforeAllSnapshotId: string
  let snapshotId: string

  before(async () => {
    const accounts = await ethers.getSigners()
    bonder = accounts[0]
    otherUser = accounts[1]

    // Fast forward blocks until >256 so that the block hash validator doesn't underflow
    for (let i = 0; i < 256; i++) {
      await otherUser.sendTransaction({
        to: await otherUser.getAddress(),
        value: '0x00'
      })
    }

    // Prepare mock bridge
    const Mock_ValidationBridgeProxy = await ethers.getContractFactory(
      'contracts/test/Mock_ValidationBridgeProxy.sol:Mock_ValidationBridgeProxy'
    )

    mockValidationBridgeProxy = await Mock_ValidationBridgeProxy.deploy()

    // Prepare Bonder proxy
    const ValidationBridgeProxy = await ethers.getContractFactory(
      'contracts/bridges/ValidationBridgeProxy.sol:ValidationBridgeProxy',
      bonder
    )

    validationBridgeProxy = await ValidationBridgeProxy.deploy(
      await bonder.getAddress(),
      mockValidationBridgeProxy.address
    )

    // Prepare the blockhash validator
    const BlockHashValidator = await ethers.getContractFactory(
      'contracts/validators/BlockHashValidator.sol:BlockHashValidator',
      bonder
    )
    blockHashValidator = await BlockHashValidator.deploy()

    // Set up config - contract state
    await mockValidationBridgeProxy.setBonder(validationBridgeProxy.address)

    // Set up config - calldata config
    baseCalldata = '0x23c452cd000000000000000000000000bb0f753321e2b5fd29bd1d14b532f5b54959ae63000000000000000000000000000000000000000000000000058b9a1b1ddf8b3cf287e45be4b44d92226a8fa555e07155dbed032af2864d60db69b0f787413e70000000000000000000000000000000000000000000000000000bf3c3061d1e63'
    tx = {
      to: validationBridgeProxy.address,
    }

    // Other contracts
    const MockERC20 = await ethers.getContractFactory(
      'contracts/test/MockERC20.sol:MockERC20'
    )
    mockErc20 = await MockERC20.deploy('Test', 'TST')

    // Set up snapshot
    beforeAllSnapshotId = await takeSnapshot()
  })

  after(async () => {
    await revertSnapshot(beforeAllSnapshotId)
  })

  beforeEach(async () => {
    // Reset tx state since snapshot isn't working
    tx = {
      to: validationBridgeProxy.address,
    }
    snapshotId = await takeSnapshot()
  })

  afterEach(async () => {
    await revertSnapshot(snapshotId)
  })

  /**
   * Tests
   */

  describe('Happy path', () => {
    it('Should send a normal bond with no hidden calldata', async () => {
      tx.data = baseCalldata
      await bonder.sendTransaction(tx)
      
      const functionCalled = await mockValidationBridgeProxy.lastCalledFunction()
      expect(Number(functionCalled)).to.eq(BridgeTxs.bondWithdrawalAndDistribute)
    })

    it('Should send a normal bond with hidden calldata', async () => {
      tx.data = await getTxCalldata(bonder)
      await bonder.sendTransaction(tx)

      const functionCalled = await mockValidationBridgeProxy.lastCalledFunction()
      expect(Number(functionCalled)).to.eq(BridgeTxs.bondWithdrawalAndDistribute)
    })

    it('Should send a normal bond with hidden calldata that fails due to a bad blockhash', async () => {
      const txData = await getTxCalldata(bonder)
      const modifiedTxData = txData.slice(0, -3) + '001'
      tx.data = modifiedTxData

      const expectedErrorMsg = 'BHV: Invalid block hash'
      await expect(bonder.sendTransaction(tx)).to.be.revertedWith(expectedErrorMsg)
    })
  })

  /**
   * Fallback and receiver
   */

  describe('Fallback and receiver', () => {
    it('Should receive funds with data at the fallback function and not the receive', async () => {
      tx.value = parseEther('1')
      // stake(address,uint). Needs a payable function that exists on bridge
      tx.data = '0xadc9772e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000de0b6b3a7640000'
      await bonder.sendTransaction(tx)
      expect(true).to.eq(true)
    })

    it('Should receive funds without data at the receive function and not the fallback', async () => {
      tx.value = parseEther('1')
      tx.data = '0x'
      await otherUser.sendTransaction(tx)
      expect(true).to.eq(true)
    })
  })

  /**
   * Other
   */

  describe('Other', () => {
    it('Should allow the bonder to claim funds from the contract', async () => {
      const amount = parseEther('1')
      // Send funds to the contract
      let bonderBalance = await bonder.getBalance()
      let contractBalance = await bonder.provider!.getBalance(validationBridgeProxy.address)

      // Another address sends funds
      tx.value = amount
      await otherUser.sendTransaction(tx)

      let newBonderBalance = await bonder.getBalance()
      let newContractBalance = await bonder.provider!.getBalance(validationBridgeProxy.address)

      expect(bonderBalance).to.eq(newBonderBalance)
      expect(contractBalance).to.eq(newContractBalance.sub(amount))

      bonderBalance = newBonderBalance
      contractBalance = newContractBalance

      // Retrieve funds from the contract
      const token = constants.AddressZero
      await validationBridgeProxy.connect(bonder).claimFunds(token, amount)

      newBonderBalance = await bonder.getBalance()
      newContractBalance = await bonder.provider!.getBalance(validationBridgeProxy.address)

      // Since the bonder pays gas for the tx, check diff
      const gasCost = parseEther('0.0001')
      expect((amount.sub(newBonderBalance)).lt(gasCost)).to.eq(true)
      expect(contractBalance).to.eq(newContractBalance.add(amount))
    })

    it('Should allow the bonder to claim an ERC20 from the contract', async () => {
      const amount = parseEther('1')

      // Check starting balances
      let bonderBalance = await mockErc20.balanceOf(await bonder.getAddress())
      let contractBalance = await mockErc20.balanceOf(validationBridgeProxy.address)

      expect(bonderBalance).to.eq(0)
      expect(contractBalance).to.eq(0)

      // Mint tokens to the contract
      await mockErc20.mint(validationBridgeProxy.address, amount.mul(2))

      // Check balances
      bonderBalance = await mockErc20.balanceOf(await bonder.getAddress())
      contractBalance = await mockErc20.balanceOf(validationBridgeProxy.address)

      expect(bonderBalance).to.eq(0)
      expect(contractBalance).to.eq(amount.mul(2))

      const token = mockErc20.address
      await validationBridgeProxy.connect(bonder).claimFunds(token, amount)

      // Check balances
      bonderBalance = await mockErc20.balanceOf(await bonder.getAddress())
      contractBalance = await mockErc20.balanceOf(validationBridgeProxy.address)

      expect(bonderBalance).to.eq(amount)
      expect(contractBalance).to.eq(amount)
    })

    it('Should allow the bonder to approve and ERC20', async () => {
      const amount = parseEther('1')
      const spender = await validationBridgeProxy.bridge()

      // Check approval
      let allowance = await mockErc20.allowance(validationBridgeProxy.address, spender)
      expect(allowance).to.eq(0)

      const token = mockErc20.address
      await validationBridgeProxy.connect(bonder).approveBridge(token, amount)

      // Check balances
      allowance = await mockErc20.allowance(validationBridgeProxy.address, spender)
      expect(allowance).to.eq(amount)
    })
  })


  /**
   * Non-happy path
   */

  describe('Non-happy Path', () => {
    it('Should fail each function if called by a non-Bonder', async () => {
      const expectedErrorMsg = 'VBP: Caller is not bonder in modifier'

      // executeTransactions
      tx.data = '0xfc6b605200000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000'
      await expect(otherUser.sendTransaction(tx)).to.be.revertedWith(expectedErrorMsg)

      // addSelectorDataLength
      tx.data = '0xa34e69081234567800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007b'
      await expect(otherUser.sendTransaction(tx)).to.be.revertedWith(expectedErrorMsg)

      // Fallback
      tx.value = parseEther('1')
      tx.data = '0x01'
      await expect(otherUser.sendTransaction(tx)).to.be.revertedWith(expectedErrorMsg)
    })

    it('Should not allow the bonder EOA to stake on the bridge', async () => {
      const expectedErrorMsg = 'MVBP: Not bonder'
      await expect(mockValidationBridgeProxy.connect(bonder).stake(await bonder.getAddress(), '1')).to.be.revertedWith(expectedErrorMsg)
    })


    it('Should fail because the validator address is malformed or not a contract', async () => {
      tx.data = await getTxCalldata(bonder)
      tx.data = tx.data.slice(0, 266) + '0000000000' + tx.data.slice(276)
      
      await expect(bonder.sendTransaction(tx)).to.be.revertedWith('VBP: Validation address is not a contract')
    })


    it('Should fail because the validator contract has neither a fallback nor a function that matches the sig', async () => {
      tx.data = await getTxCalldata(bonder)
      tx.data = tx.data.slice(0, 306) + '0000000000' + tx.data.slice(316)
      
      // Revert data is random data that is returned when a function is not found
      const responseToEmptyFunction = '0x00000000000000000000000000000000000000000000000000000000000000'
      try {
        await bonder.sendTransaction(tx)
      } catch (err) {
        expect(err.message).to.include(responseToEmptyFunction)
      }
    })

    it('Should bypass validation if the validation data is missing', async () => {
      // Missing validation data
      const data = await getTxCalldata(bonder)
      tx.data = data.slice(0, -136)
      await bonder.sendTransaction(tx)
    })

    it('Should fail when checking the code at the validation contract if the validation address is missing', async () => {
      // Missing validation address
      tx.data = await getTxCalldata(bonder)
      tx.data = tx.data.slice(0, -176) + tx.data.slice(-136)
      await expect(bonder.sendTransaction(tx)).to.be.revertedWith('VBP: Validation address is not a contract')
    })

    it('Should always have a constant encoding length even with leading and trailing 0s', async () => {
      const expectedLength = 178 // 40 + 138
      let address = '0x1231231231231231231231231231231231231231'
      let data = '0x8003405b243c061c944cf4ac591ee874f1985ecef4560cece75b1994aed3c2ea022f9c1d0000000000000000000000000000000000000000000000000000000000000105'
      let hiddenCalldata = utils.solidityPack(
        ['address', 'bytes'],
        [address, data]
      )
      expect(hiddenCalldata.length).to.eq(expectedLength)

      address = '0x0000231231231231231231231231231231231231'
      data = '0x8003405b243c061c944cf4ac591ee874f1985ecef4560cece75b1994aed3c2ea022f9c1d0000000000000000000000000000000000000000000000000000000000000105'
      hiddenCalldata = utils.solidityPack(
        ['address', 'bytes'],
        [address, data]
      )
      expect(hiddenCalldata.length).to.eq(expectedLength)

      address = '0x1231231231231231231231231231231231230000'
      data = '0x8003405b243c061c944cf4ac591ee874f1985ecef4560cece75b1994aed3c2ea022f9c1d0000000000000000000000000000000000000000000000000000000000000105'
      hiddenCalldata = utils.solidityPack(
        ['address', 'bytes'],
        [address, data]
      )
      expect(hiddenCalldata.length).to.eq(expectedLength)

      address = '0x1231231231231231231231231231231231231230'
      data = '0x0003405b243c061c944cf4ac591ee874f1985ecef4560cece75b1994aed3c2ea022f9c1d0000000000000000000000000000000000000000000000000000000000000000'
      hiddenCalldata = utils.solidityPack(
        ['address', 'bytes'],
        [address, data]
      )
      expect(hiddenCalldata.length).to.eq(expectedLength)

      address = '0x0000000000000000000000000000000000000000'
      data = '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
      hiddenCalldata = utils.solidityPack(
        ['address', 'bytes'],
        [address, data]
      )
      expect(hiddenCalldata.length).to.eq(expectedLength)
    })
  })

  /**
   * Helpers
   */

  async function getTxCalldata(bonder: Signer) {
    const block = await bonder.provider?.getBlock('latest')

    const blockNumber = block?.number!
    const blockHash = block?.hash!

    const abi = ['function validateBlockHash(bytes32,uint256) external view']
    const iface = new utils.Interface(abi)
    const data = iface.encodeFunctionData(
      'validateBlockHash', [blockHash, blockNumber]
    )

    // Format into hidden calldata
    const hiddenCalldata = utils.solidityPack(
      ['address', 'bytes'],
      [blockHashValidator.address, data]
    )
    return baseCalldata + hiddenCalldata.slice(2)
  }
})