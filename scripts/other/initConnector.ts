require('dotenv').config()
import { ethers } from 'hardhat'
import {
  mainnetNetworkData,
  goerliNetworkData
} from '../../config/networks/index'
import { BigNumber, utils as ethersUtils } from 'ethers'

// Example usage:
// $ npm run init:connector-l1
// $ npm run init:connector-l2

async function main () {
  const network = await ethers.provider.getNetwork()
  console.log('network:', network)

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const Connector = await ethers.getContractFactory(
    'contracts/connectors/PolygonzkConnector.sol:PolygonzkConnector',
    { signer }
  )

  const l2BridgeAddress = ''
  const govAddress = '0xF56e305024B195383245A075737d16dBdb8487Fb'
  const connectorAddresses: Record<string, string> = {
    'L1': '',
    'L2': ''
  }

  const networkData = (network.chainId === 1 || network.chainId === 1101)  ? mainnetNetworkData : goerliNetworkData

  // L1 Init
  let connectorAddress
  let target
  let counterpart
  let counterpartNetwork: BigNumber
  let messengerAddress
  if (network.chainId === 1 || network.chainId === 5) {

    connectorAddress = connectorAddresses['L1']
    target = govAddress
    counterpart = connectorAddresses['L2']
    counterpartNetwork = BigNumber.from(1)
    messengerAddress = networkData['polygonzk'].l1MessengerAddress
  } else {

    connectorAddress = connectorAddresses['L2']
    target = l2BridgeAddress
    counterpart = connectorAddresses['L1']
    counterpartNetwork = BigNumber.from(0)
    messengerAddress = networkData['polygonzk'].l2MessengerAddress

  }

  const connector = await Connector.attach(connectorAddress)
  await connector.deployed()

  // Calling the contract directly was erroring out with some combination of ethers/hardhat due
  // to the fact that there were two methods with the same name (but diff sigs)
  const abi = [
    'function initialize(address _target, address _counterpart, uint32 _counterpartNetwork, address _messengerAddress)'
  ]
  const ethersInterface = new ethersUtils.Interface(abi)
  const data = ethersInterface.encodeFunctionData('initialize', [
    target,
    counterpart,
    counterpartNetwork,
    messengerAddress
  ])

  const tx = await signer.sendTransaction({
    to: connector.address,
    data
  })
  await tx.wait()

  console.log('complete', tx.hash)
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
