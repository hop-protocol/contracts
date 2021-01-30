require('dotenv').config()

import {
  network,
  ethers as evmEthers,
  l2ethers as ovmEthers
} from 'hardhat'
import { BigNumber, ContractFactory, Contract, Signer } from 'ethers'

import { getValidEthersObject, getContractFactories } from '../shared/utils'

import { LIQUIDITY_PROVIDER_UNISWAP_AMOUNT, DEFAULT_DEADLINE } from '../../config/constants'

async function deployArbitrum () {

  // Network setup
  const chainId: BigNumber = BigNumber.from(network.config.chainId)
  const ethers = getValidEthersObject(chainId, evmEthers, ovmEthers)

  // Addresses
  const l2_canonicalTokenAddress: string = ''
  const l2_bridgeAddress: string = ''
  const uniswapRouterAddress: string = ''

  if (!l2_canonicalTokenAddress || !l2_bridgeAddress || !uniswapRouterAddress) {
    throw new Error('Addresses must be defined')
  }
  // Signers
  let accounts: Signer[]
  let bonder: Signer

  // Factories
  let L2_Bridge: ContractFactory
  let MockERC20: ContractFactory
  let UniswapRouter: ContractFactory

  // L2
  let l2_bridge: Contract
  let l2_canonicalToken: Contract
  let uniswapRouter: Contract

  // Instantiate the wallets
  accounts = await ethers.getSigners()
  bonder = accounts[0]

  // Get the contract Factories
  ;({ 
    MockERC20,
    L2_Bridge,
    UniswapRouter
  } = await getContractFactories(chainId, ethers, bonder))

  // Attach already deployed contracts
  l2_canonicalToken = MockERC20.attach(l2_canonicalTokenAddress)

  l2_bridge = L2_Bridge.attach(l2_bridgeAddress)
  uniswapRouter = UniswapRouter.attach(uniswapRouterAddress)

  /**
   * Setup
   */

  // Set up Uniswap
  await l2_canonicalToken.approve(uniswapRouter.address, LIQUIDITY_PROVIDER_UNISWAP_AMOUNT)
  await l2_bridge.approve(uniswapRouter.address, LIQUIDITY_PROVIDER_UNISWAP_AMOUNT)
  await uniswapRouter.addLiquidity(
    l2_bridge.address,
    l2_canonicalToken.address,
    LIQUIDITY_PROVIDER_UNISWAP_AMOUNT,
    LIQUIDITY_PROVIDER_UNISWAP_AMOUNT,
    '0',
    '0',
    await bonder.getAddress(),
    DEFAULT_DEADLINE
  )
}

/* tslint:disable-next-line */
(async () => {
  await deployArbitrum()
})()