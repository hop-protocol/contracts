require('dotenv').config()
import { ethers } from 'hardhat'

// Example usage:
// $ npm run deploy:cctp

async function main () {
  const network = await ethers.provider.getNetwork()
  console.log('network:', network)

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const HopCCTPImplementation = await ethers.getContractFactory(
    'contracts/cctp/HopCCTPImplementation.sol:HopCCTPImplementation',
    { signer }
  )

  const opts: any = {}
  if (network.chainId !== 1) {
    opts.gasPrice = 5000000000
  }
  const hopCCTPImplementation= await HopCCTPImplementation.deploy(opts)
  await hopCCTPImplementation.deployed()

  console.log('hopCCTPImplementation address:', hopCCTPImplementation.address)
  console.log('deployed bytecode:', await ethers.provider.getCode(hopCCTPImplementation.address))
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
