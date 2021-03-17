require('dotenv').config()
import hre from 'hardhat'

const ethers = hre.ethers
const l2ethers = hre.l2ethers

async function main () {
  console.log('network:', await ethers.provider.getNetwork())

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const L2ERC20 = await l2ethers.getContractFactory('L2ERC20', {
    signer: (await ethers.getSigners())[0]
  })

  const l1_erc20Bridge = {
    address: '0x353F7a3CfF5308c9Ff0b163fFF49F6F353261ACe'
  }
  const l2_messenger = {
    address: '0x4200000000000000000000000000000000000007'
  }
  const l2_erc20 = {
    address: '0xf145f37BcD99a03E647e8804284811040Ee33cD9'
  }

  const l2_erc20_contract = L2ERC20.attach(l2_erc20.address)
  await l2_erc20_contract.init(l2_messenger.address, l1_erc20Bridge.address)
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))

