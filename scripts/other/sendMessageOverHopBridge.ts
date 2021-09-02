require('dotenv').config()
import { ethers } from 'hardhat'
import { BigNumber, Signer, Contract, ContractFactory } from 'ethers'

import { CHAIN_IDS, ZERO_ADDRESS } from '../../config/constants'
import {
  getContractFactories
} from '../shared/utils'

import {
  executeCanonicalMessengerSendMessage,
  getSetL1BridgeConnectorMessage,
  getAddBonderMessage,
} from '../../test/shared/contractFunctionWrappers'

// Send an arbitrary message over the Hop Bridge. Useful for updating L2 Bridge state
// Example usage:
// $ npx hardhat run scripts/other/sendMessageOverHopBridge.ts --network kovan
async function main () {
  // Addresses
  const l1_messengerAddress: string = '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560'
  const l1_messengerWrapperAddress: string = ZERO_ADDRESS
  const l1_bridgeAddress: string = '0xe31a40e28888BbFF75a7f433f25863F9893a7cd4'
  const l2_bridgeAddress: string = '0x0116f7Cc707486def830e8B5FbEEE13A237D2A08'

  // Chain Ids
  const l2_chainId: BigNumber = CHAIN_IDS.XDAI.SOKOL

  // Contracts and Factories
  let L1_Bridge: ContractFactory
  let L1_Messenger: ContractFactory
  let L1_MessengerWrapper: ContractFactory
  let L2_Bridge: ContractFactory

  let l1_bridge: Contract
  let l1_messenger: Contract
  let l1_messengerWrapper: Contract
  let l2_bridge: Contract

  // Signers
  const signers: Signer[] = await ethers.getSigners()
  const deployer: Signer = signers[0]
  const governance: Signer = signers[1]

  ;({
    L1_Bridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge
  } = await getContractFactories(l2_chainId, deployer, ethers))

  // Attach already deployed contracts
  l1_bridge = L1_Bridge.attach(l1_bridgeAddress)
  l1_messenger = L1_Messenger.attach(l1_messengerAddress)
  l1_messengerWrapper = L1_MessengerWrapper.attach(l1_messengerAddress)
  l2_bridge = L2_Bridge.attach(l2_bridgeAddress)

  let message: string = getAddBonderMessage(
    '0x50f1EB94F221122d524DCAAc303a2a6082525967'
  )

  await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l1_messengerWrapper,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2_chainId
  )
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
