require('dotenv').config()

import { ContractFactory, Signer, Contract, BigNumber } from 'ethers'
import {
  network,
  ethers,
  l2ethers as ovmEthers
} from 'hardhat'

import { getContractFactories, verifyDeployment } from '../shared/utils'

import { isChainIdOptimism, isChainIdArbitrum } from '../../config/utils'
import { ZERO_ADDRESS, CHAIN_IDS } from '../../config/constants'

async function deployL2 () {

  // Network setup
  const chainId: BigNumber = BigNumber.from(network.config.chainId)

  // Addresses
  const l1_bridgeAddress: string = ''
  const l2_canonicalTokenAddress: string = ''
  const l2_messengerAddress: string = ''

  if (!l1_bridgeAddress || !l2_canonicalTokenAddress || !l2_messengerAddress) {
    throw new Error('Addresses must be defined')
  }

  // Signers
  let accounts: Signer[]
  let owner: Signer
  let bonder: Signer

  // Factories
  let L1_Bridge: ContractFactory
  let L2_MockERC20: ContractFactory
  let L2_Bridge: ContractFactory
  let UniswapFactory: ContractFactory
  let UniswapRouter: ContractFactory
  let UniswapPair: ContractFactory

  // Contracts
  let l1_bridge: Contract
  let l2_bridge: Contract
  let l2_canonicalToken: Contract
  let l2_uniswapFactory: Contract
  let l2_uniswapRouter: Contract
  let l2_uniswapPair: Contract

  // Instantiate the wallets
  accounts = await ethers.getSigners()
  owner = accounts[0]
  bonder = accounts[1]

  // Get the contract Factories
  ;({ 
    L1_Bridge,
    L2_MockERC20,
    L2_Bridge,
    UniswapFactory,
    UniswapRouter,
    UniswapPair
  } = await getContractFactories(chainId, owner, ethers, ovmEthers))

  // Attach already deployed contracts
  l1_bridge = L1_Bridge.attach(l1_bridgeAddress)
  l2_canonicalToken = L2_MockERC20.attach(l2_canonicalTokenAddress)

  /**
   * Deployments
   */

  ;({ 
    l2_uniswapFactory,
    l2_uniswapRouter
  } = await deployUniswap(
    ethers,
    owner,
    UniswapFactory,
    UniswapRouter,
    l2_uniswapFactory,
    l2_uniswapRouter
  ))

  ;({ 
    l2_bridge
  } = await deployBridge(
    ethers,
    owner,
    bonder,
    L2_Bridge,
    l1_bridge,
    l2_bridge,
    l2_canonicalToken,
    l2_uniswapRouter,
    l2_messengerAddress
  ))

  await deployNetworkSpecificContracts(
    chainId,
    owner,
    ethers,
    UniswapPair,
    l2_uniswapFactory,
    l2_uniswapPair
  )

  console.log('Deployments Complete')
  console.log('L2 Bridge           :', l2_bridge.address)
  console.log('L2 Uniswap Factory  :', l2_uniswapFactory.address)
  console.log('L2 Uniswap Router   :', l2_uniswapRouter.address)
}

const deployUniswap = async (
  ethers: any,
  owner: Signer,
  UniswapFactory: ContractFactory,
  UniswapRouter: ContractFactory,
  l2_uniswapFactory: Contract,
  l2_uniswapRouter: Contract,
) => {
  l2_uniswapFactory = await UniswapFactory.connect(owner).deploy(await owner.getAddress())
  await l2_uniswapFactory.deployed()
  await verifyDeployment('L2 Uniswap Factory', l2_uniswapFactory, ethers)

  l2_uniswapRouter = await UniswapRouter.connect(owner).deploy(l2_uniswapFactory.address, ZERO_ADDRESS)
  await l2_uniswapRouter.deployed()
  await verifyDeployment('L2 Uniswap Router', l2_uniswapRouter, ethers)

  return {
    l2_uniswapFactory,
    l2_uniswapRouter,
  }
}

const deployBridge = async (
  ethers: any,
  owner: Signer,
  bonder: Signer,
  L2_Bridge: ContractFactory,
  l1_bridge: Contract,
  l2_bridge: Contract,
  l2_canonicalToken: Contract,
  l2_uniswapRouter: Contract,
  l2_messengerAddress: string
) => {
  // NOTE: Adding more CHAIN_IDs here will push the OVM deployment over the contract size limit
  //       If additional CHAIN_IDs must be added, do so after the deployment.
  l2_bridge = await L2_Bridge.connect(owner).deploy(
    l2_messengerAddress,
    await owner.getAddress(),
    l2_canonicalToken.address,
    l1_bridge.address,
    [
      CHAIN_IDS.ETHEREUM.MAINNET
    ],
    await bonder.getAddress(),
    l2_uniswapRouter.address
  )
  await l2_bridge.deployed()
  await verifyDeployment('L2 Bridge', l2_bridge, ethers)

  return {
    l2_bridge
  }
}

const deployNetworkSpecificContracts = async (
  chainId: BigNumber,
  owner: Signer,
  ethers: any,
  UniswapPair: ContractFactory,
  l2_uniswapFactory: Contract,
  l2_uniswapPair: Contract
) => {
  if (isChainIdArbitrum(chainId)) {
    // No network specific deployments
  }

  if (isChainIdOptimism(chainId)) {
    l2_uniswapPair = await UniswapPair.connect(owner).deploy(l2_uniswapFactory.address)
    l2_uniswapPair.deployed()
    verifyDeployment('L2 Uniswap Pair', l2_uniswapPair, ethers)

    await l2_uniswapFactory.connect(owner).setPair(l2_uniswapPair.address)
    const realPair = await l2_uniswapFactory.realPair()
    if (l2_uniswapPair.address !== realPair) {
      throw new Error('Pair did not get set on the factory.')
    }
  }
}

/* tslint:disable-next-line */
(async () => {
  await deployL2()
})()