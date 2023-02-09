require('dotenv').config()
import { ethers } from 'hardhat'
import { BigNumber } from 'ethers'

import { Wallet, utils } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'

const hre = require('hardhat')

// NOTE: This works with both L1 and L2. Specify the network in the CLI.
// Example usage:
// $ npm run deploy:l1-goerli:erc20
// $ npm run deploy:l2-optimism:erc20

// NOTE: You should not use this for xDai, as their bridge mints a new token.
// NOTE: Instead, call `relayTokens()` here: 0xA960d095470f7509955d5402e36d9DB984B5C8E2
async function main () {
  const erc20Name = 'Wrapped Ether'
  const erc20Symbol = 'WETH'

  const network = await ethers.provider.getNetwork()
  console.log('network:', network)

  let address: string
  if (hre.network.name === 'zksync_testnet') {
    address = await deployZkSync(erc20Name, erc20Symbol)
  } else {
    address = await deploy(erc20Name, erc20Symbol)
  }
  console.log('erc20 address:', address)
  console.log(
    'deployed bytecode:',
    await ethers.provider.getCode(address)
    )
  console.log('complete')
}

async function deploy (name: string, symbol: string): Promise<string> {
  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const MockERC20 = await ethers.getContractFactory(
    'contracts/test/MockERC20WithDeposit.sol:MockERC20WithDeposit',
    { signer }
  )

  const erc20 = await MockERC20.deploy(
    name,
    symbol
  )
  await erc20.deployed()

  return erc20.address
}

async function deployZkSync (name: string, symbol: string): Promise<string> {
  const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!)
  const deployer = new Deployer(hre, wallet)
  const artifact = await deployer.loadArtifact('contracts/test/MockERC20WithDeposit.sol:MockERC20WithDeposit')
  const l2Contract = await deployer.deploy(artifact, [name, symbol])
  return l2Contract.address
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
