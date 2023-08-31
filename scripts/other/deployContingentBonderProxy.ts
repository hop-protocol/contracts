require('dotenv').config()
import { ethers } from 'hardhat'

// Example usage:
// $ npm run deploy:contingent-bonder-proxy <network>

async function main () {

  const bonderEoa: string = ''
  const bridge: string = ''
  const selectors: string[] = []
  const lengthPerSelector: Number[] = []

  const network = await ethers.provider.getNetwork()
  console.log('network:', network)

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const ContingentBonderProxy = await ethers.getContractFactory(
    'contracts/bonder/ContingentBonderProxy.sol:ContingentBonderProxy',
    { signer }
  )

  const bonderProxy = await ContingentBonderProxy.deploy(
    bonderEoa,
    bridge,
    selectors,
    lengthPerSelector
  )
  await bonderProxy.deployed()

  console.log('bonderProxy address:', bonderProxy.address)
  console.log('deployed bytecode:', await ethers.provider.getCode(bonderProxy.address))
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
