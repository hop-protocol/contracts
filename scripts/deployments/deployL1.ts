require('dotenv').config()

import { ethers } from 'hardhat'
import { ContractFactory, Contract, Signer } from 'ethers'
import { getContractFactories } from './utils'

async function deployL1 () {

  // Addresses
  const l1_canonicalTokenAddress = '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9'

  // Signers
  const accounts: Signer[] = await ethers.getSigners()
  const bonder: Signer = accounts[0]

  // Factories
  let L1_Bridge: ContractFactory

  // Contracts
  let l1_bridge: Contract

  ;({ 
    L1_Bridge
  } = await getContractFactories(ethers))

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