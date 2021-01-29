require('dotenv').config()

import { ethers, l2ethers } from 'hardhat'
import { ContractFactory, Signer, Contract } from 'ethers'

import { verifyDeployment } from './utils'
import {
  ZERO_ADDRESS,
  CHAIN_IDS
} from '../../test/shared/constants'

async function deployAndSetupL2 () {

  // Addresses
  const l1_bridgeAddress: string = '0xe74EFb19BBC46DbE28b7BaB1F14af6eB7158B4BE'
  const l2_canonicalTokenAddress: string = '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9'
  const l2_messengerAddress: string = '0x0000000000000000000000000000000000000064'

  if (!l1_bridgeAddress || !l2_canonicalTokenAddress || !l2_messengerAddress) {
    throw new Error('Addresses must be defined')
  }

  // Signers
  let accounts: Signer[]
  let bonder: Signer
  let user: Signer

  // Factories
  let MockERC20: ContractFactory
  let L1_Bridge: ContractFactory
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
  bonder = accounts[0]
  user = accounts[1]

  // Get the contract Factories
  MockERC20 = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20', { signer: bonder })
  L1_Bridge = await ethers.getContractFactory('contracts/bridges/L1_Bridge.sol:L1_Bridge', { signer: bonder })
  L2_Bridge = await ethers.getContractFactory('contracts/bridges/L2_OptimismBridge.sol:L2_OptimismBridge', { signer: bonder })
  UniswapFactory = await ethers.getContractFactory('contracts/test/UniswapFactoryFlat.sol:UniswapV2Factory', { signer: bonder })
  UniswapRouter = await ethers.getContractFactory('contracts/test/UniswapRouterFlat.sol:UniswapV2Router02', { signer: bonder })
  UniswapPair = await ethers.getContractFactory('contracts/test/UniswapPairV2OVM/UniswapV2Pair.sol:UniswapV2Pair', { signer: bonder })

  // Attach already deployed contracts
  l1_bridge = L1_Bridge.attach(l1_bridgeAddress)
  l2_canonicalToken = MockERC20.attach(l2_canonicalTokenAddress)

  /**
   * Deployments
   */

  ;({ 
    l2_uniswapFactory,
    l2_uniswapRouter,
    l2_uniswapPair
  } = await deployUniswap(
    user,
    UniswapFactory,
    UniswapRouter,
    UniswapPair,
    l2_uniswapFactory,
    l2_uniswapRouter,
    l2_uniswapPair
  ))

  ;({ 
    l2_bridge
  } = await deployBridge(
    user,
    bonder,
    L2_Bridge,
    l1_bridge,
    l2_bridge,
    l2_canonicalToken,
    l2_uniswapRouter,
    l2_messengerAddress
  ))

  console.log('Deployments Complete')
  console.log('L2 Bridge           :', l2_bridge.address)
  console.log('L2 Uniswap Factory  :', l2_uniswapFactory.address)
  console.log('L2 Uniswap Router   :', l2_uniswapRouter.address)
}

const deployUniswap = async (
  user: Signer,
  UniswapFactory: ContractFactory,
  UniswapRouter: ContractFactory,
  UniswapPair: ContractFactory,
  l2_uniswapFactory: Contract,
  l2_uniswapRouter: Contract,
  l2_uniswapPair: Contract
) => {
  l2_uniswapFactory = await UniswapFactory.deploy(await user.getAddress())
  await l2_uniswapFactory.deployed()
  await verifyDeployment('L2 Uniswap Factory', l2_uniswapFactory, ethers)

  l2_uniswapRouter = await UniswapRouter.deploy(l2_uniswapFactory.address, ZERO_ADDRESS)
  await l2_uniswapRouter.deployed()
  await verifyDeployment('L2 Uniswap Router', l2_uniswapRouter, ethers)

  l2_uniswapPair = await UniswapPair.deploy(l2_uniswapFactory.address)
  l2_uniswapPair.deployed()
  verifyDeployment('L2 Uniswap Pair', l2_uniswapPair, ethers)

  await l2_uniswapFactory.setPair(l2_uniswapPair.address)
  const realPair = await l2_uniswapFactory.realPair()
  if (l2_uniswapPair.address !== realPair) {
    throw new Error('Pair did not get set on the factory.')
  }

  return {
    l2_uniswapFactory,
    l2_uniswapRouter,
    l2_uniswapPair
  }
}

const deployBridge = async (
  user: Signer,
  bonder: Signer,
  L2_Bridge: ContractFactory,
  l1_bridge: Contract,
  l2_bridge: Contract,
  l2_canonicalToken: Contract,
  l2_uniswapRouter: Contract,
  l2_messengerAddress: string
) => {
  l2_bridge = await L2_Bridge.deploy(
    l2_messengerAddress,
    await user.getAddress(),
    l2_canonicalToken.address,
    l1_bridge.address,
    [
      CHAIN_IDS.ETHEREUM.MAINNET,
      CHAIN_IDS.ETHEREUM.KOVAN,
      CHAIN_IDS.OPTIMISM.HOP_TESTNET,
      CHAIN_IDS.ARBITRUM.TESTNET_3
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

/* tslint:disable-next-line */
(async () => {
  await deployAndSetupL2()
})()