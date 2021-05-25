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

  let L1_TokenBridge
  if (l2NetworkName === 'optimism') {
    L1_TokenBridge = await ethers.getContractFactory('OVM_L1_ERC20_Bridge', {
      signer: (await ethers.getSigners())[0]
    })
  } else if (l2NetworkName === 'arbitrum') {
    L1_TokenBridge = await ethers.getContractFactory('Arbitrum_L1_ERC20_Bridge', {
      signer: (await ethers.getSigners())[0]
    })
  }
  const networkData = getNetworkDataByNetworkName(l1NetworkName)
  const { l1MessengerAddress } = networkData[l2NetworkName]
  console.log(l1MessengerAddress)

  const l1_erc20Bridge = await L1_TokenBridge.deploy(l1MessengerAddress)
  await l1_erc20Bridge.deployed()
  console.log('L1 erc20 bridge address:', l1_erc20Bridge.address)
  console.log(
    'deployed bytecode:',
    await ethers.provider.getCode(l1_erc20Bridge.address)
    )
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
