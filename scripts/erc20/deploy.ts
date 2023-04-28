require('dotenv').config()
import { ethers } from 'hardhat'

import { Wallet, utils } from 'zksync-web3'
import { Deployer } from '@matterlabs/hardhat-zksync-deploy'

const hre = require('hardhat')

// NOTE: This works with both L1 and L2. Specify the network in the CLI.
// Example usage:
// $ npm run deploy:erc20
async function main () {
  const erc20Name = 'Tether USD'
  const erc20Symbol = 'USDT'
  const erc20Decimals = 6

  const network = await ethers.provider.getNetwork()
  console.log('network:', network)
  if (network.name === 'unknown') {
    throw new Error('Unknown network')
  }

  let address: string
  if (hre.network.name === 'zksync_testnet') {
    address = await deployZkSync(erc20Name, erc20Symbol, erc20Decimals)
  } else {
    address = await deploy(erc20Name, erc20Symbol, erc20Decimals)
  }
  console.log('erc20 address:', address)
  console.log('deployed bytecode:', await ethers.provider.getCode(address))
  console.log('complete')
}

async function deploy (name: string, symbol: string, decimals: number): Promise<string> {
  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const MockERC20 = await ethers.getContractFactory(
    'contracts/test/TestnetERC20.sol:TestnetERC20',
    { signer }
  )

  const erc20 = await MockERC20.deploy(name, symbol, decimals)
  await erc20.deployed()

  return erc20.address
}

async function deployZkSync (name: string, symbol: string, decimals: number): Promise<string> {
  const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!)
  const deployer = new Deployer(hre, wallet)
  const artifact = await deployer.loadArtifact(
    'contracts/test/SybilResistantERC20.sol:SybilResistantERC20'
  )
  const l2Contract = await deployer.deploy(artifact, [name, symbol, decimals])
  return l2Contract.address
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
