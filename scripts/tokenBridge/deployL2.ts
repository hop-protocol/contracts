require('dotenv').config()
import hre from 'hardhat'
import { getNetworkDataByNetworkName } from '../shared/utils'

const ethers = hre.ethers

async function main () {
  console.log('network:', await ethers.provider.getNetwork())

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const l1NetworkName = 'kovan'
  const l2NetworkName = 'optimism'

  let L2_TokenBridge
  if (l2NetworkName === 'optimism') {
    L2_TokenBridge = await ethers.getContractFactory('OVM_L2_ERC20_Bridge', {
      signer: (await ethers.getSigners())[0]
    })
  } else if (l2NetworkName === 'arbitrum') {
    L2_TokenBridge = await ethers.getContractFactory('Arbitrum_L2_ERC20_Bridge', {
      signer: (await ethers.getSigners())[0]
    })

  }

  const networkData = getNetworkDataByNetworkName(l1NetworkName)
  const { l2MessengerAddress } = networkData[l2NetworkName]
  // Get this after deploying the L1 equivalent
  const l1TokenBridge = ''
  if (!l1TokenBridge) {
    throw new Error('Deploy an L1 Token Bridge')
  }
  console.log(l2MessengerAddress)
  console.log(l1TokenBridge)

  const l2_tokenBridge = await L2_TokenBridge.deploy(
    l2MessengerAddress,
    l1TokenBridge
  )

  await l2_tokenBridge.deployed()
  console.log('L2 Token Bridge address:', l2_tokenBridge.address)
  console.log(
    'deployed bytecode:',
    await ethers.provider.getCode(l2_tokenBridge.address)
    )
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
