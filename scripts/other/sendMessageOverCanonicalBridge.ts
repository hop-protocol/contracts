require('dotenv').config()
import { ethers } from 'hardhat'
import { BigNumber, Signer, Contract, ContractFactory } from 'ethers'

import { CHAIN_IDS, ZERO_ADDRESS } from '../../config/constants'
import { getActiveChainIds, isChainIdTestnet } from '../../config/utils'
import {
  getContractFactories,
  getNetworkDataByNetworkName
} from '../shared/utils'

import {
  executeCanonicalMessengerSendMessage,
  getSetL1BridgeAddressMessage,
  getAddBonderMessage,
  getAddActiveChainIdsMessage
} from '../../test/shared/contractFunctionWrappers'

// Send an arbitrary message over the Canonical Bridge. Useful for updating L2 Bridge state
// Example usage:
// $ npx hardhat run scripts/other/sendMessageOverCanonicalBridge.ts --network goerli
async function main () {
  // message
  const message: string = getAddActiveChainIdsMessage([BigNumber.from('84531')])

  // ChainIds
  const l2ChainIds: string[] = ['80001', '420', '421613', '59140']

  // TODO: Not manual mapping
  const l2ChainSlugs: Record<string, string> = {
    '80001': 'mumbai',
    '420': 'optimism',
    '421613': 'arbitrum',
    '59140': 'consensys'
  }

  const l2BridgeAddresses: Record<string, string> = {
    '80001': '0x34E8251051687BfF4EA23C18e466b3Ed13492abd',
    '421613': '0xb276BC046DFf5024D20A3947475eA20C9F08eB1F',
    '420': '0x2708E5C7087d4C6D295c8B58b2D452c360D505C7',
    '59140': '0x3E4a3a4796d16c0Cd582C382691998f7c06420B6'
  }

  for (const l2ChainId of l2ChainIds) {
    console.log(`executing ${l2ChainId.toString()}...`)

    const l2BridgeAddress = l2BridgeAddresses[l2ChainId]
    const l1NetworkName = isChainIdTestnet(BigNumber.from(l2ChainId))
      ? 'goerli'
      : 'mainnet'
    const networkData = getNetworkDataByNetworkName(l1NetworkName)
    const l2ChainSlug = l2ChainSlugs[l2ChainId]
    const { l1MessengerAddress } = networkData[l2ChainSlug]

    await executeMessage(
      l2ChainId,
      l1MessengerAddress,
      l2BridgeAddress,
      message
    )
  }
}

async function executeMessage (
  l2ChainId: string,
  l1MessengerAddress: string,
  l2BridgeAddress: string,
  message: string
) {
  const l2_chainId = BigNumber.from(l2ChainId)

  // Signers
  const signers: Signer[] = await ethers.getSigners()
  const deployer: Signer = signers[0]
  const governance: Signer = signers[1]

  // Contracts and Factories
  let L1_Messenger: ContractFactory
  let L1_MessengerWrapper: ContractFactory
  let L2_Bridge: ContractFactory

  let l1_messenger: Contract
  let l1_messengerWrapper: Contract
  let l2_bridge: Contract
  ;({
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge
  } = await getContractFactories(l2_chainId, deployer, ethers))

  // Attach already deployed contracts
  l1_messenger = L1_Messenger.attach(l1MessengerAddress)
  l1_messengerWrapper = L1_MessengerWrapper.attach(l1MessengerAddress)
  l2_bridge = L2_Bridge.attach(l2BridgeAddress)

  const overrides = {
    gasPrice: 100000000000,
    gasLimit: 1000000
  }
  await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l1_messengerWrapper,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2_chainId,
    overrides
  )
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
