require('dotenv').config()
import { ethers } from 'hardhat'

// Example usage:
// $ npm run deploy:blockhash-validator <network>

async function main () {
  const network = await ethers.provider.getNetwork()
  console.log('network:', network)

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const BlockHashValidator = await ethers.getContractFactory(
    'contracts/blockhash/BlockHashValidator.sol:BlockHashValidator',
    { signer }
  )

  const blockHashValidator = await BlockHashValidator.deploy()
  await blockHashValidator.deployed()

  console.log('blockHashValidator address:', blockHashValidator.address)
  console.log('deployed bytecode:', await ethers.provider.getCode(blockHashValidator.address))
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
