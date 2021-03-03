require('dotenv').config()

import { network, ethers } from 'hardhat'
import { ContractFactory, Contract, Signer, BigNumber } from 'ethers'

import { getContractFactories, updateConfigFile, readConfigFile } from '../shared/utils'

interface Config {
  l1_canonicalTokenAddress: string
}

export async function deployL1 (config: Config) {
  // Network setup
  const chainId: BigNumber = BigNumber.from(network.config.chainId)

  // Addresses
  const { l1_canonicalTokenAddress } = config

  if (!l1_canonicalTokenAddress) {
    throw new Error('Addresses must be defined')
  }

  // Signers
  const accounts: Signer[] = await ethers.getSigners()
  const owner: Signer = accounts[0]
  const bonder: Signer = accounts[1]

  // Factories
  let L1_Bridge: ContractFactory

  // Contracts
  let l1_bridge: Contract
  ;({ L1_Bridge } = await getContractFactories(chainId, bonder, ethers))

  /**
   * Deployments
   */

  l1_bridge = await L1_Bridge.connect(owner).deploy(
    l1_canonicalTokenAddress,
    [await bonder.getAddress()]
  )
  await l1_bridge.deployed()

  const l1_bridgeAddress = l1_bridge.address

  console.log('L1 Deployments Complete')
  console.log('L1 Bridge: ', l1_bridgeAddress)
  updateConfigFile({l1_bridgeAddress})
  return {
    l1_bridgeAddress
  }
}

if (require.main === module) {
  const { l1_canonicalTokenAddress } = readConfigFile()
  deployL1({
    l1_canonicalTokenAddress
  })
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
}
