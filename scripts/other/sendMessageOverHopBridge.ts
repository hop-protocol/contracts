require('dotenv').config()
import { ethers } from 'hardhat'
import { BigNumber, Signer, Contract, ContractFactory } from 'ethers'

import { CHAIN_IDS, ZERO_ADDRESS } from '../../config/constants'
import {
  getContractFactories
} from '../shared/utils'

import {
  executeCanonicalMessengerSendMessage,
  getSetL1BridgeAddressMessage,
} from '../../test/shared/contractFunctionWrappers'

// Send an arbitrary message over the Hop Bridge. Useful for updating L2 Bridge state
// Example usage:
// $ npx hardhat run scripts/other/sendMessageOverHopBridge.ts --network kovan
async function main () {
  // Addresses
  const l1_messengerAddress: string = '0xb89065D5eB05Cac554FDB11fC764C679b4202322'
  const l1_bridgeAddress: string = '0x7d3101fE93Ff6dC009c2f50b6aD59DDD7F23dC5F'
  const l2_bridgeAddress: string = '0xd6935d3FE65f804e54a8e0d0A0F8793f0aC196Ff'

  // Chain Ids
  const l2_chainId: BigNumber = CHAIN_IDS.OPTIMISM.HOP_TESTNET
  // const l2_chainId: BigNumber = CHAIN_IDS.XDAI.SOKOL

  // Contracts and Factories
  let L1_Bridge: ContractFactory
  let L1_Messenger: ContractFactory
  let L2_Bridge: ContractFactory

  let l1_bridge: Contract
  let l1_messenger: Contract
  let l2_bridge: Contract

  // Signers
  const signers: Signer[] = await ethers.getSigners()
  const owner: Signer = signers[0]
  const bonder: Signer = signers[1]
  const governance: Signer = signers[4]

  ;({
    L1_Bridge,
    L1_Messenger,
    L2_Bridge
  } = await getContractFactories(l2_chainId, bonder, ethers))

  console.log('aa')
  // Attach already deployed contracts
  l1_bridge = L1_Bridge.attach(l1_bridgeAddress)
  l1_messenger = L1_Messenger.attach(l1_messengerAddress)
  l2_bridge = L2_Bridge.attach(l2_bridgeAddress)

  let message: string = getSetL1BridgeAddressMessage(
    l1_bridge
  )

  await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l2_bridge,
    ZERO_ADDRESS,
    owner,
    message,
    l2_chainId
  )
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
