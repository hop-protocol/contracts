require('dotenv').config()
import { ethers } from 'hardhat'
import { BigNumber, Signer, Contract, ContractFactory } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'

import { CHAIN_IDS } from '../../config/constants'
import {
  getContractFactories,
  sendChainSpecificBridgeDeposit,
  waitAfterTransaction
} from '../shared/utils'

// Send a token over the Omni Bridge. Useful for creating a first-time token on xDai
// Example usage:
// $ npx hardhat run scripts/other/sendOverOmniBridge.ts --network kovan
async function main () {
  // Addresses
  // DAI
  // const l1_tokenBridgeAddress: string = '0xA960d095470f7509955d5402e36d9DB984B5C8E2'
  // const l1_canonicalTokenAddress: string = '0x436e3FfB93A4763575E5C0F6b3c97D5489E050da'
  // const l2_canonicalTokenAddress: string = '0x6D2d8B29d92cab87a273e872FcC4650A64116283'
  // const tokenDecimals: number = 18

  // USDC
  const l1_tokenBridgeAddress: string = '0xA960d095470f7509955d5402e36d9DB984B5C8E2'
  const l1_canonicalTokenAddress: string = '0xA46d09fd4B7961aE16D33122660f43726cB1Ff36'
  const l2_canonicalTokenAddress: string = '0x3b0977b9e563F63F219019616BBD12cB1cdFF527'
  const tokenDecimals: number = 6

  // Values to Change
  const shouldMintMax: boolean = false
  const shouldApproveMax: boolean = true
  const numLoops: number = 1000

  // Values to not change
  const maxSendAmountEth: BigNumber = BigNumber.from('10000')
  const amount: BigNumber = BigNumber.from(parseUnits(maxSendAmountEth.toString(), tokenDecimals))
  const mintAndApproveMaxAmount: BigNumber = amount.mul(numLoops)

  // Chain Ids
  const l2_chainId: BigNumber = CHAIN_IDS.XDAI.SOKOL

  // Contracts and Factories
  let L1_TokenBridge: ContractFactory
  let L1_MockERC20: ContractFactory

  let l1_tokenBridge: Contract
  let l1_canonicalToken: Contract
  let l2_canonicalToken: Contract

  // Signers
  const signers: Signer[] = await ethers.getSigners()
  const sender: Signer = signers[0]

  ;({
    L1_MockERC20,
    L1_TokenBridge,
  } = await getContractFactories(l2_chainId, sender, ethers))

  // Attach already deployed contracts
  l1_tokenBridge = L1_TokenBridge.attach(l1_tokenBridgeAddress)
  l1_canonicalToken = L1_MockERC20.attach(l1_canonicalTokenAddress)
  l2_canonicalToken = L1_MockERC20.attach(l2_canonicalTokenAddress)

  if (shouldMintMax) {
    await mintMax(
      l1_canonicalToken,
      sender,
      mintAndApproveMaxAmount
    )
  }

  if (shouldApproveMax) {
    await approveMax(
      l1_tokenBridge,
      l1_canonicalToken,
      sender,
      mintAndApproveMaxAmount
    )
  }

  let amountSent: BigNumber = BigNumber.from('0')
  const ten: BigNumber = BigNumber.from('10')
  for (let i = 0; i < numLoops; i++) {
    console.log('Iteration Number:', i)
    console.log('Amount Sent:', amountSent.div(ten.pow(tokenDecimals)).toString())

    await sendChainSpecificBridgeDeposit(
      l2_chainId,
      sender,
      amount,
      l1_tokenBridge,
      l1_canonicalToken,
      l2_canonicalToken
    )

    amountSent = amountSent.add(amount)
  }
}

async function mintMax(
  l1_canonicalToken: Contract,
  sender: Signer,
  amount: BigNumber
) {
  let tx = await l1_canonicalToken
    .connect(sender)
    .mint(
      await sender.getAddress(),
      amount
    )
  await tx.wait()
  await waitAfterTransaction()
}

async function approveMax(
  l1_tokenBridge: Contract,
  l1_canonicalToken: Contract,
  sender: Signer,
  amount: BigNumber
) {
  let tx = await l1_canonicalToken
    .connect(sender)
    .approve(l1_tokenBridge.address, amount)
  await tx.wait()
  await waitAfterTransaction()
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
