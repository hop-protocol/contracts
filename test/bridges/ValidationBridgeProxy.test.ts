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
  let mockErc721: Contract

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

    // bondTransferRoot
    // 0x8d8798bf50b0ce783f5276884e9f018ec00f96099babed98bd702a2b0806daee8d77f6e600000000000000000000000000000000000000000000000000000000000000890000000000000000000000000000000000000000000000000000000aecc29e2f
    // bondWithdrawal
    // 0x23c452cd000000000000000000000000817c4749ff5d7738dee0a0be4da03665e1def4d10000000000000000000000000000000000000000000000000000000001dcd119529cfa98570b70f4d23f202e3f8f505af2d7b9e99ff53726230f349df830751000000000000000000000000000000000000000000000000000000000007747a3
    // bondWithdrawalAndDistribute
    // 0x3d12a85a0000000000000000000000004fd75b8d11709ac53cf578a4c5ce9e05b451c8830000000000000000000000000000000000000000000000000023320a8381d15404662bbc80b53f63c7719240761b180faad39c641a928c14205292f2be3144fb0000000000000000000000000000000000000000000000000000d02f9502df98000000000000000000000000000000000000000000000000002236efbe488d1a0000000000000000000000000000000000000000000000000000000064e7c14b
    validationBridgeProxy = await ValidationBridgeProxy.deploy(
      await bonder.getAddress(),
      mockValidationBridgeProxy.address,
      [
        '0x8d8798bf',
        '0x23c452cd',
        '0x3d12a85a',
      ],
      [
        '100',
        '132',
        '196',
      ]
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

    const MockERC721 = await ethers.getContractFactory(
      'contracts/test/MockERC721.sol:MockERC721'
    )
    mockErc721 = await MockERC721.deploy('Test', 'TST')

    // Set up snapshot
    beforeAllSnapshotId = await takeSnapshot()
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

      const expectedErrorMsg = 'BHV: Invalid truncated block hash'
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
    it('Should allow the bonder to add an expected length per selector', async () => {
      const expectedSel = '0x12345678'
      const expectedLen = 123
      await validationBridgeProxy.connect(bonder).addSelectorDataLength(expectedSel, expectedLen)

      const newLen = await validationBridgeProxy.expectedSelectorDataLength(expectedSel)
      expect(newLen).to.eq(expectedLen)
    })

    it('Should allow anyone bonder to claim funds from the contract', async () => {
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
      const type = 0
      await validationBridgeProxy.connect(bonder).claimFunds(token, amount, type)

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
      const type = 1
      await validationBridgeProxy.connect(bonder).claimFunds(token, amount, type)

      // Check balances
      bonderBalance = await mockErc20.balanceOf(await bonder.getAddress())
      contractBalance = await mockErc20.balanceOf(validationBridgeProxy.address)

      expect(bonderBalance).to.eq(amount)
      expect(contractBalance).to.eq(amount)
    })

    it('Should allow the bonder to claim an NFT from the contract', async () => {
      const tokenId = 1

      // Check starting balances
      let bonderBalance = await mockErc721.balanceOf(await bonder.getAddress())
      let contractBalance = await mockErc721.balanceOf(validationBridgeProxy.address)

      expect(bonderBalance).to.eq(0)
      expect(contractBalance).to.eq(0)

      // Mint tokens to the contract
      await mockErc721.mint(validationBridgeProxy.address, tokenId)

      // Check balances
      bonderBalance = await mockErc721.balanceOf(await bonder.getAddress())
      contractBalance = await mockErc721.balanceOf(validationBridgeProxy.address)

      expect(bonderBalance).to.eq(0)
      expect(contractBalance).to.eq(tokenId)

      const token = mockErc721.address
      const type = 2
      await validationBridgeProxy.connect(bonder).claimFunds(token, tokenId, type)

      bonderBalance = await mockErc721.balanceOf(await bonder.getAddress())
      contractBalance = await mockErc721.balanceOf(validationBridgeProxy.address)

      expect(bonderBalance).to.eq(tokenId)
      expect(contractBalance).to.eq(0)
    })
  })


  /**
   * Non-happy path
   */

  describe('Fallback and receiver', () => {
    it('Should fail each function if called by a non-Bonder', async () => {
      const expectedErrorMsg = 'VBP: Caller is not bonder in modifier'

      // executeTransactions
      tx.data = '0xfc6b605200000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000'
      await expect(otherUser.sendTransaction(tx)).to.be.revertedWith(expectedErrorMsg)

      // addSelectorDataLength
      tx.data = '0xa34e69081234567800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007b'
      // set value to 0 until snapshot is figured out
      tx.value = 0
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
      
      await expect(bonder.sendTransaction(tx)).to.be.revertedWith('VBP: Validator address is not a contract')
    })


    it('Should fail because the validator contract has neither a fallback nor a function that matches the sig', async () => {
      tx.data = await getTxCalldata(bonder)
      tx.data = tx.data.slice(0, 306) + '0000000000' + tx.data.slice(316)
      
      // Revert data is random data that is returned when a function is not found
      const responseToEmptyFunction = '0x00000000000000000000000000000000000000000000000000000000000000dc23c452cd000000000000000000000000bb0f753321e2b5fd29bd1d14b532f5b54959ae63000000000000000000000000000000000000000000000000058b9a1b'
      await expect(bonder.sendTransaction(tx)).to.be.revertedWith(responseToEmptyFunction)
    })

    it('Should fail because there is no calldata sent with the validator contract call', async () => {
      tx.data = await getTxCalldata(bonder)
      tx.data = tx.data.slice(0, 306)
      
      // Revert data is random data that is returned when a function is not found
      const responseToEmptyFunction = '0x000000000000000000000000000000000000000000000000000000000000009823c452cd000000000000000000000000bb0f753321e2b5fd29bd1d14b532f5b54959ae63000000000000000000000000000000000000000000000000058b9a1b'
      await expect(bonder.sendTransaction(tx)).to.be.revertedWith(responseToEmptyFunction)
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