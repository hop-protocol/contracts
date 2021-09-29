require('dotenv').config()

import { ethers } from 'hardhat'
import {
  ContractFactory,
  Contract,
  Signer,
  BigNumber
} from 'ethers'

import {
  getContractFactories,
  updateConfigFile,
  readConfigFile,
  waitAfterTransaction,
  getModifiedGasPrice,
  Logger
} from '../shared/utils'

const logger = Logger('deployL1')

interface Config {
  l1ChainId: BigNumber
  l1CanonicalTokenAddress: string
  bonderAddress: string
  isEthDeployment: boolean
}

export async function deployL1 (config: Config) {
  logger.log('deploy L1')

  let {
    l1ChainId,
    l1CanonicalTokenAddress,
    bonderAddress,
    isEthDeployment
  } = config

  logger.log(`config:
            l1ChainId: ${l1ChainId}
            l1CanonicalTokenAddress: ${l1CanonicalTokenAddress}
            bonderAddress: ${bonderAddress}
            isEthDeployment: ${isEthDeployment}`)

  l1ChainId = BigNumber.from(l1ChainId)

  // Signers
  const accounts: Signer[] = await ethers.getSigners()
  let deployer: Signer = accounts[0]
  let governance: Signer = accounts[1]

  logger.log('deployer:', await deployer.getAddress())
  logger.log('governance:', await governance.getAddress())

  // Factories
  let L1_Bridge: ContractFactory

  logger.log('getting contract factories')

  // Contracts
  let l1_bridge: Contract
  ;({ L1_Bridge } = await getContractFactories(l1ChainId, deployer, ethers))

  /**
   * Deployments
   */

  logger.log('deploying L1 bridge')
  let l1BridgeParams: any[] = [
    [bonderAddress],
    await governance.getAddress(),
  ]
  if (!isEthDeployment) {
    l1BridgeParams.unshift(l1CanonicalTokenAddress)
  }

  l1_bridge = await L1_Bridge
    .connect(deployer)
    .deploy(
      ...l1BridgeParams,
      await getModifiedGasPrice(ethers, l1ChainId)
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
    l1CanonicalTokenAddress,
    bonderAddress,
    isEthDeployment
  } = readConfigFile()
  deployL1({
    l1ChainId,
    l1CanonicalTokenAddress,
    bonderAddress,
    isEthDeployment
  })
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      logger.error(error)
      process.exit(1)
    })
}
