require('dotenv').config()

import { ethers } from 'hardhat'
import { ContractFactory, Contract, Signer, BigNumber } from 'ethers'

import { getContractFactories, updateConfigFile, readConfigFile, waitAfterTransaction } from '../shared/utils'

interface Config {
  l1_chainId: string | BigNumber
  l1_canonicalTokenAddress: string
}

export async function deployL1 (config: Config) {
  let {
    l1_chainId,
    l1_canonicalTokenAddress,
  } = config

  l1_chainId = BigNumber.from(l1_chainId)

  // Signers
  const accounts: Signer[] = await ethers.getSigners()
  const owner: Signer = accounts[0]
  const bonder: Signer = accounts[1]

  // Factories
  let L1_Bridge: ContractFactory

  // Contracts
  let l1_bridge: Contract
  ;({ L1_Bridge } = await getContractFactories(l1_chainId, bonder, ethers))

  /**
   * Deployments
   */

  l1_bridge = await L1_Bridge.connect(owner).deploy(
    l1_canonicalTokenAddress,
    [await bonder.getAddress()]
  )
  await waitAfterTransaction(l1_bridge)


  const l1_bridgeAddress = l1_bridge.address

  console.log('L1 Deployments Complete')
  console.log('L1 Bridge: ', l1_bridgeAddress)
  updateConfigFile({l1_bridgeAddress})
  return {
    l1_bridgeAddress
  }
}

if (require.main === module) {
  const {
    l1_chainId,
    l1_canonicalTokenAddress
  } = readConfigFile()
  deployL1({
    l1_chainId,
    l1_canonicalTokenAddress
  })
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
}
