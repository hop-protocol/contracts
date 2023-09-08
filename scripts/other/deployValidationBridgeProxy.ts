require('dotenv').config()
import { ethers } from 'hardhat'
import { wait } from '../shared/utils'
const hre = require('hardhat')

// Example usage:
// $ npm run deploy:validation-bridge-proxy <network>

async function main () {
  const bonderEoa: string = '0x81682250D4566B2986A2B33e23e7c52D401B7aB7'
  const bridgeAddressesByChainId: Record<string, string> = {
    '420': '0x2708E5C7087d4C6D295c8B58b2D452c360D505C7', // op
    '421613': '0xb276BC046DFf5024D20A3947475eA20C9F08eB1F', // arb
    '84531': '0xCB4cEeFce514B2d910d3ac529076D18e3aDD3775', // base
    '5': '0xC8A4FB931e8D77df8497790381CA7d228E68a41b' // main
  }

  const selectors: string[] = [
    '0x8d8798bf', // bondTransferRoot
    '0x23c452cd', // bondWithdrawal
    '0x3d12a85a', // bondWithdrawalAndDistribute
  ]
  const lengthPerSelector: Number[] = [
    100,
    132,
    196,
  ]

  const network = await ethers.provider.getNetwork()
  console.log('network:', network)

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const ValidationBridgeProxy = await ethers.getContractFactory(
    'contracts/bridges/ValidationBridgeProxy.sol:ValidationBridgeProxy',
    { signer }
  )

  const constructorArguments = [
    bonderEoa,
    bridgeAddressesByChainId[network.chainId],
    selectors,
    lengthPerSelector
  ]
  const bridgeProxy = await ValidationBridgeProxy.deploy(...constructorArguments)
  await bridgeProxy.deployed()

  console.log('bridgeProxy address:', bridgeProxy.address)
  console.log('deployed bytecode:', await ethers.provider.getCode(bridgeProxy.address))
  console.log('deployment complete')

  // Etherscan needs time before verification on some chains
  await wait(30e3)

  console.log('\n verifying on etherscan')
  await hre.run('verify:verify', {
    address: bridgeProxy.address,
    constructorArguments
  })
  console.log('etherscan verification complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
