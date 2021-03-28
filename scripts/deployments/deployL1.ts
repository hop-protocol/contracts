require('dotenv').config()

import { ethers } from 'hardhat'
import { ContractFactory, Contract, Signer, BigNumber } from 'ethers'

import {
  getContractFactories,
  updateConfigFile,
  readConfigFile,
  waitAfterTransaction,
  Logger
} from '../shared/utils'

const logger = Logger('deployL1')

interface Config {
  l1_chainId: string | BigNumber
  l1_canonicalTokenAddress: string
}

export async function deployL1 (config: Config) {
  logger.log('deploy L1')

  let { l1_chainId, l1_canonicalTokenAddress } = config

  logger.log(`config:
            l1_chainId: ${l1_chainId}
            l1_canonicalTokenAddress: ${l1_canonicalTokenAddress}`)

  l1_chainId = BigNumber.from(l1_chainId)

  // Signers
  const accounts: Signer[] = await ethers.getSigners()
  const owner: Signer = accounts[0]
  const bonder: Signer = accounts[1]
  const governance: Signer = accounts[4]

  logger.log('owner:', await owner.getAddress())
  logger.log('bonder:', await bonder.getAddress())

  // Factories
  let L1_Bridge: ContractFactory

  logger.log('getting contract factories')
  // Contracts
  let l1_bridge: Contract
  ;({ L1_Bridge } = await getContractFactories(l1_chainId, bonder, ethers))

  /**
   * Deployments
   */

  logger.log('deploying L1 bridge')
  l1_bridge = await L1_Bridge
    .connect(owner)
    .deploy(
      l1_canonicalTokenAddress,
      [await bonder.getAddress()],
      await governance.getAddress()
      )
  await waitAfterTransaction(l1_bridge)

  const l1_bridgeAddress = l1_bridge.address

  logger.log('L1 Deployments Complete')
  logger.log('L1 Bridge: ', l1_bridgeAddress)
  updateConfigFile({ l1_bridgeAddress })
  return {
    l1_bridgeAddress
  }
}

if (require.main === module) {
  const { l1_chainId, l1_canonicalTokenAddress } = readConfigFile()
  deployL1({
    l1_chainId,
    l1_canonicalTokenAddress
  })
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      logger.error(error)
      process.exit(1)
    })
}
