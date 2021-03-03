require('dotenv').config()
import hre from 'hardhat'

const ethers = hre.ethers
const l2ethers = hre.l2ethers

export async function setupL2 () {
  console.log('network:', await ethers.provider.getNetwork())

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const L2ERC20 = await l2ethers.getContractFactory('L2ERC20', {
    signer: (await ethers.getSigners())[0]
  })

  const l1_erc20Bridge = {
    address: '0x590ceD746352cAd60779233a17A759c0E01a22b2'
  }
  const l2_crossDomainMessenger = {
    address: '0x4200000000000000000000000000000000000007'
  }
  const l2_erc20 = {
    address: '0xE3F5dA4Bbde554877655c14F5D5b55Bf1A689759'
  }

  const l2_erc20_contract = L2ERC20.attach(l2_erc20.address)
  await l2_erc20_contract.init(
    l2_crossDomainMessenger.address,
    l1_erc20Bridge.address
  )
  console.log('complete')
}

if (require.main === module) {
  setupL2()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
}
