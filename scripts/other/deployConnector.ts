require('dotenv').config()
import { ethers } from 'hardhat'

// Example usage:
// $ npm run deploy:connectors

async function main () {
  const network = await ethers.provider.getNetwork()
  console.log('network:', network)

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const Connector = await ethers.getContractFactory(
    'contracts/connectors/PolygonzkConnector.sol:PolygonzkConnector',
    { signer }
  )

  const opts: any = {}
  if (network.chainId !== 1) {
    opts.gasPrice = 5000000000
  }
  const connector = await Connector.deploy(opts)
  await connector.deployed()

  console.log('connector address:', connector.address)
  console.log('deployed bytecode:', await ethers.provider.getCode(connector.address))
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
