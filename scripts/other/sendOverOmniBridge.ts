require('dotenv').config()
import { ethers } from 'hardhat'
import { BigNumber, Signer, Contract, ContractFactory } from 'ethers'
import { parseEther } from 'ethers/lib/utils'

import { CHAIN_IDS } from '../../config/constants'
import {
  getContractFactories,
  sendChainSpecificBridgeDeposit,
  waitAfterTransaction
} from '../shared/utils'

// Example usage:
// $ npx hardhat run scripts/other/sendOverOmniBridge.ts --network kovan
async function main () {
  // Addresses
  const l1_tokenBridgeAddress: string = '0xA960d095470f7509955d5402e36d9DB984B5C8E2'
  const l1_canonicalTokenAddress: string = '0x1E1a556D2166A006e662864D376e8DD249087150'
  const l2_canonicalTokenAddress: string = '0x94490EF228D4aBD189694f86D1684D972431380b'

  // Token Send Values
  const numLoops: number = 100
  const maxSendAmountEth: BigNumber = BigNumber.from('10000')
  const amount: BigNumber = BigNumber.from(parseEther(maxSendAmountEth.toString()))
  const shouldMintAndApproveMax: boolean = true
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
  const owner: Signer = signers[0]
  const bonder: Signer = signers[1]
  const liquidityProvider: Signer = signers[2]

  ;({
    L1_MockERC20,
    L1_TokenBridge,
  } = await getContractFactories(l2_chainId, bonder, ethers))

  // Attach already deployed contracts
  l1_tokenBridge = L1_TokenBridge.attach(l1_tokenBridgeAddress)
  l1_canonicalToken = L1_MockERC20.attach(l1_canonicalTokenAddress)
  l2_canonicalToken = L1_MockERC20.attach(l2_canonicalTokenAddress)

  if (shouldMintAndApproveMax) {
    await mintAndApproveMax(
      l1_tokenBridge,
      l1_canonicalToken,
      owner,
      liquidityProvider,
      mintAndApproveMaxAmount
    )
  }

  for (let i = 0; i < numLoops; i++) {
    console.log('Iteration Number:', i)

    await sendChainSpecificBridgeDeposit(
      l2_chainId,
      liquidityProvider,
      amount,
      l1_tokenBridge,
      l1_canonicalToken,
      l2_canonicalToken
    )
    await waitAfterTransaction()
  }
}

async function mintAndApproveMax(
  l1_tokenBridge: Contract,
  l1_canonicalToken: Contract,
  owner: Signer,
  liquidityProvider: Signer,
  amount: BigNumber
) {
  let tx = await l1_canonicalToken
    .connect(owner)
    .mint(
      await liquidityProvider.getAddress(),
      amount
    )
  await tx.wait()
  await waitAfterTransaction()

  tx = await l1_canonicalToken
    .connect(liquidityProvider)
    .approve(l1_tokenBridge.address, amount)
  await tx.wait()
  await waitAfterTransaction()
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
