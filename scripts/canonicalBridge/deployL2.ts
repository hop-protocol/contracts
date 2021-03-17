require('dotenv').config()
import hre from 'hardhat'

const ethers = hre.ethers
const l2ethers = hre.l2ethers

import {
  DEFAULT_ETHERS_OVERRIDES as overrides
} from '../../config/constants'

async function main () {
  console.log('network:', await ethers.provider.getNetwork())

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  // const L2ERC20 = await ethers.getContractFactory('MockERC20', {
  const L2ERC20 = await ethers.getContractFactory('L2ERC20', {
    signer: (await ethers.getSigners())[0]
  })

  const tokenName: string = 'Synth sETH'
  const tokenSymbol: string = 'sETH'
  const tokenDecimals: number = 18
  const l2_erc20_contract = await L2ERC20.deploy(
    tokenName,
    tokenDecimals,
    tokenSymbol
  )
  await l2_erc20_contract.deployed()

  console.log('L2 ERC20 deployed to:', l2_erc20_contract.address)
  console.log(
    'deployed bytecode:',
    await ethers.provider.getCode(l2_erc20_contract.address)
  )
  console.log('symbol:', await l2_erc20_contract.symbol(overrides))
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
