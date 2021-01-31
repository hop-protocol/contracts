require('dotenv').config()

import {
  network,
  ethers as evmEthers,
  l2ethers as ovmEthers
} from 'hardhat'
import { BigNumber, ContractFactory, Contract, Signer } from 'ethers'

import { getValidEthersObject, getContractFactories } from '../shared/utils'

import { DEFAULT_DEADLINE, MAX_APPROVAL } from '../../config/constants'

async function setupL2 () {

  // Network setup
  const chainId: BigNumber = BigNumber.from(network.config.chainId)
  const ethers = getValidEthersObject(chainId, evmEthers, ovmEthers)

  // Addresses
  const l2_canonicalTokenAddress: string = '0x57eaeE3D9C99b93D8FD1b50EF274579bFEC8e14B'
  const l2_bridgeAddress: string = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
  const uniswapRouterAddress: string = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'

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
  await l2_canonicalToken.approve(uniswapRouter.address, MAX_APPROVAL)
  await l2_bridge.approve(uniswapRouter.address, MAX_APPROVAL)
  await uniswapRouter.addLiquidity(
    l2_bridge.address,
    l2_canonicalToken.address,
    BigNumber.from('1000000000000000000'),
    BigNumber.from('1000000000000000000'),
    // LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.div(2),
    // LIQUIDITY_PROVIDER_UNISWAP_AMOUNT.div(2),
    '0',
    '0',
    await bonder.getAddress(),
    DEFAULT_DEADLINE
  )
}

/* tslint:disable-next-line */
(async () => {
  await setupL2()
})()