require('dotenv').config()
import hre from 'hardhat'

const ethers = hre.ethers

async function main () {
  console.log('network:', await ethers.provider.getNetwork())

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const L1ERC20Bridge = await ethers.getContractFactory('Arbitrum_L1_ERC20_Bridge', {
  // const L1ERC20Bridge = await ethers.getContractFactory('OVM_L1_ERC20_Bridge', {
    signer: (await ethers.getSigners())[0]
  })

  const l1_messenger = {
    address: '0x97884F2B6A2AF19C38AA0a15716CF2aC931A3c73' // Arbitrum
    // address: '0xb89065D5eB05Cac554FDB11fC764C679b4202322' // Optimism
  }

  const l1_erc20Bridge = await L1ERC20Bridge.deploy(
    l1_messenger.address
  )
  await l1_erc20Bridge.deployed()
  console.log('L1 erc20 bridge address:', l1_erc20Bridge.address)
  console.log(
    'deployed bytecode:',
    await ethers.provider.getCode(l1_erc20Bridge.address)
    )
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
