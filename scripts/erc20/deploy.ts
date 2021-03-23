require('dotenv').config()
import { ethers, l2ethers } from 'hardhat'
import { BigNumber } from 'ethers'
import { isChainIdOptimism } from '../../config/utils'

// NOTE: This works with both L1 and L2. Specify the network in the CLI.
// Example usage:
// $ npm run deploy:l1-kovan:erc20
// $ npm run deploy:l2-optimism:erc20
// NOTE: You should not use this for xDai, as their bridge mints a new token.
// NOTE: Instead, call `relayTokens()` here: 0xA960d095470f7509955d5402e36d9DB984B5C8E2
async function main () {
  const erc20Name = 'Dai Stablecoin'
  const erc20Symbol = 'DAI'

  const network = await ethers.provider.getNetwork()
  console.log('network:', network)

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const ethersForFactory = isChainIdOptimism(BigNumber.from(network.chainId)) ? l2ethers : ethers
  const MockERC20 = await ethersForFactory.getContractFactory(
    'contracts/test/MockERC20.sol:MockERC20',
    { signer }
  )

  const erc20 = await MockERC20.deploy(
    erc20Name,
    erc20Symbol
  )
  await erc20.deployed()
  console.log('erc20 address:', erc20.address)
  console.log(
    'deployed bytecode:',
    await ethers.provider.getCode(erc20.address)
    )
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
