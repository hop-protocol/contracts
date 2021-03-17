require('dotenv').config()
import hre from 'hardhat'

const ethers = hre.ethers

async function main () {
  console.log('network:', await ethers.provider.getNetwork())

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const L1ERC20Bridge = await ethers.getContractFactory('L1ERC20Bridge', {
    signer: (await ethers.getSigners())[0]
  })

  const l1_messenger = {
    address: '0xb89065D5eB05Cac554FDB11fC764C679b4202322'
  }
  const l1_erc20 = {
    address: '0x1AaA3666F2842bff3e2FD6832d254772cf8bb18f'
  }
  const l2_erc20 = {
    address: '0xf145f37BcD99a03E647e8804284811040Ee33cD9'
  }

  const l1_erc20Bridge = await L1ERC20Bridge.deploy(
    l1_erc20.address,
    l2_erc20.address,
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
