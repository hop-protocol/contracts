require('dotenv').config()

import { network, ethers } from 'hardhat'
import { ContractFactory, Contract, Signer, BigNumber } from 'ethers'

import { getContractFactories } from '../shared/utils'

async function deployL1 () {

  // Network setup
  const chainId: BigNumber = BigNumber.from(network.config.chainId)

  // Addresses
  const l1_canonicalTokenAddress = ''

  if (!l1_canonicalTokenAddress) {
    throw new Error('Addresses must be defined')
  }

  // Signers
  const accounts: Signer[] = await ethers.getSigners()
  const bonder: Signer = accounts[0]

  // Factories
  let L1_Bridge: ContractFactory

  // Contracts
  let l1_bridge: Contract

  ;({ 
    L1_Bridge
  } = await getContractFactories(chainId, ethers, bonder))

  /**
   * Deployments
   */

  l1_bridge = await L1_Bridge.deploy(l1_canonicalTokenAddress, await bonder.getAddress())
  await l1_bridge.deployed()

  console.log('L1 Bridge: ', l1_bridge.address)
}

/* tslint:disable-next-line */
(async () => {
  await deployL1()
})()