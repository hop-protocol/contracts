require('dotenv').config()
import hre from 'hardhat'

const ethers = hre.ethers
const l2ethers = hre.l2ethers

async function main () {
  console.log('network:', await ethers.provider.getNetwork())

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const L2_TokenBridge = await l2ethers.getContractFactory('OVM_L2_ERC20_Bridge', {
    signer: (await ethers.getSigners())[0]
  })

  const l2_messenger = {
    address: 'todo'
  }

  const l1_tokenBridge = {
    address: 'todo'
  }

  const l1_erc20 = {
    address: 'todo'
  }

  const l2_tokenBridge = await L2_TokenBridge.deploy(
    l2_messenger.address,
    l1_tokenBridge.address,
    l1_erc20.address
  )
  await l2_tokenBridge.deployed()
  console.log('L2 Token Bridge address:', l2_tokenBridge.address)
  console.log(
    'deployed bytecode:',
    await ethers.provider.getCode(l2_tokenBridge.address)
    )
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
