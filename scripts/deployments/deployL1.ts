require('dotenv').config()

import { ethers } from 'hardhat'
import {
  ContractFactory,
  Contract,
  Signer,
  BigNumber
} from 'ethers'

import {
  isChainIdMainnet
} from '../../config/utils'

import {
  getContractFactories,
  updateConfigFile,
  readConfigFile,
  waitAfterTransaction,
  Logger
} from '../shared/utils'

const logger = Logger('deployL1')

interface Config {
  l1ChainId: string | BigNumber
  l1CanonicalTokenAddress: string
}

export async function deployL1 (config: Config) {
  logger.log('deploy L1')

  let {
    l1ChainId,
    l1CanonicalTokenAddress
  } = config

  logger.log(`config:
            l1ChainId: ${l1ChainId}
            l1CanonicalTokenAddress: ${l1CanonicalTokenAddress}`)

  l1ChainId = BigNumber.from(l1ChainId)

  // Signers
  const accounts: Signer[] = await ethers.getSigners()
  let owner: Signer
  let bonder: Signer
  let governance: Signer

  if (isChainIdMainnet(l1ChainId)) {
    owner = accounts[0]
    bonder = owner
    governance = owner
  } else {
    owner = accounts[0]
    bonder = accounts[1]
    governance = accounts[4]
  }

  logger.log('owner:', await owner.getAddress())
  logger.log('bonder:', await bonder.getAddress())

  // Factories
  let L1_Bridge: ContractFactory

  logger.log('getting contract factories')

  // Contracts
  let l1_bridge: Contract
  ;({ L1_Bridge } = await getContractFactories(l1ChainId, bonder, ethers))

  /**
   * Deployments
   */

  logger.log('deploying L1 bridge')
  l1_bridge = await L1_Bridge
    .connect(owner)
    .deploy(
      l1CanonicalTokenAddress,
      [await bonder.getAddress()],
      await governance.getAddress()
    )
  await waitAfterTransaction(l1_bridge)

  const l1BridgeAddress = l1_bridge.address

  logger.log('L1 Deployments Complete')
  logger.log('L1 Bridge: ', l1BridgeAddress)
  updateConfigFile({ l1BridgeAddress })
  return {
    l1BridgeAddress
  }
}

if (require.main === module) {
  const {
    l1ChainId,
    l1CanonicalTokenAddress
  } = readConfigFile()
  deployL1({
    l1ChainId,
    l1CanonicalTokenAddress
  })
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      logger.error(error)
      process.exit(1)
    })
}
