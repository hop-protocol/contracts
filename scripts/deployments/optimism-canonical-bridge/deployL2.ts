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

  const l2_erc20_contract = await L2ERC20.deploy('DAI', 0, 'DAI')
  await l2_erc20_contract.deployed()

  console.log('L2 ERC20 deployed to:', l2_erc20_contract.address)
  console.log(
    'deployed bytecode:',
    await ethers.provider.getCode(l2_erc20_contract.address)
  )
  console.log('symbol:', await l2_erc20_contract.symbol())
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
