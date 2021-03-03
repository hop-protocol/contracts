require('dotenv').config()
import hre from 'hardhat'

const ethers = hre.ethers

export async function deployL1 () {
  console.log('network:', await ethers.provider.getNetwork())

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const L1ERC20Bridge = await ethers.getContractFactory('L1ERC20Bridge', {
    signer: (await ethers.getSigners())[0]
  })

  const l1_crossDomainMessenger = {
    address: '0x77eeDe6CC8B46C76e50979Ce3b4163253979c519'
  }
  const l1_erc20 = {
    address: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9'
  }
  const l2_erc20 = {
    address: '0xE3F5dA4Bbde554877655c14F5D5b55Bf1A689759'
  }

  const l1_erc20Bridge = await L1ERC20Bridge.deploy(
    l1_erc20.address,
    l2_erc20.address,
    l1_crossDomainMessenger.address
  )
  await l1_erc20Bridge.deployed()
  console.log('L1 erc20 bridge address:', l1_erc20Bridge.address)
  console.log(
    'deployed bytecode:',
    await ethers.provider.getCode(l1_erc20Bridge.address)
  )
  console.log('complete')
}

if (require.main === module) {
  deployL1()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
}
