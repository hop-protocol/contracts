require('dotenv').config()

import { network, ethers, l2ethers as ovmEthers } from 'hardhat'
import { BigNumber, ContractFactory, Contract, Signer } from 'ethers'

import { addAllSupportedChainIds, getContractFactories, readConfigFile } from '../shared/utils'

import {
  DEFAULT_DEADLINE,
  LIQUIDITY_PROVIDER_UNISWAP_AMOUNT
} from '../../config/constants'

interface Config {
  l2_canonicalTokenAddress: string
  l2_bridgeAddress: string
  l2_uniswapRouterAddress: string
}

export async function setupL2 (config: Config) {
  // Network setup
  const chainId: BigNumber = BigNumber.from(network.config.chainId)

  // Addresses
  const {
    l2_canonicalTokenAddress,
    l2_bridgeAddress,
    l2_uniswapRouterAddress
  } = config

  if (
    !l2_canonicalTokenAddress ||
    !l2_bridgeAddress ||
    !l2_uniswapRouterAddress
  ) {
    throw new Error('Addresses must be defined')
  }
  // Signers
  let accounts: Signer[]
  let owner: Signer
  let liquidityProvider: Signer

  // Factories
  let L2_MockERC20: ContractFactory
  let L2_Bridge: ContractFactory
  let L2_UniswapRouter: ContractFactory

  // L2
  let l2_bridge: Contract
  let l2_canonicalToken: Contract
  let l2_uniswapRouter: Contract

  // Instantiate the wallets
  accounts = await ethers.getSigners()
  owner = accounts[0]
  liquidityProvider = accounts[2]

  // Get the contract Factories
  ;({ L2_MockERC20, L2_Bridge, L2_UniswapRouter } = await getContractFactories(
    chainId,
    owner,
    ethers,
    ovmEthers
  ))

  // Attach already deployed contracts
  l2_canonicalToken = L2_MockERC20.attach(l2_canonicalTokenAddress)

  l2_bridge = L2_Bridge.attach(l2_bridgeAddress)
  l2_uniswapRouter = L2_UniswapRouter.attach(l2_uniswapRouterAddress)

  /**
   * Setup
   */

  // Add supported chain IDs
  await addAllSupportedChainIds(l2_bridge)

  // Additional transactions
  // NOTE: If a watcher is not set up to propagate transactions from L1 -> L2, then this mint is required to get the LP h tokens.
  // NOTE: Not to be used in production.
  await l2_bridge
    .connect(liquidityProvider)
    .mint(
      await liquidityProvider.getAddress(),
      LIQUIDITY_PROVIDER_UNISWAP_AMOUNT
    )

  // Set up Uniswap
  await l2_canonicalToken
    .connect(liquidityProvider)
    .approve(l2_uniswapRouter.address, LIQUIDITY_PROVIDER_UNISWAP_AMOUNT)
  await l2_bridge
    .connect(liquidityProvider)
    .approve(l2_uniswapRouter.address, LIQUIDITY_PROVIDER_UNISWAP_AMOUNT)
  await l2_uniswapRouter
    .connect(liquidityProvider)
    .addLiquidity(
      l2_bridge.address,
      l2_canonicalToken.address,
      LIQUIDITY_PROVIDER_UNISWAP_AMOUNT,
      LIQUIDITY_PROVIDER_UNISWAP_AMOUNT,
      '0',
      '0',
      await liquidityProvider.getAddress(),
      DEFAULT_DEADLINE
    )
}

if (require.main === module) {
  const {
    l2_canonicalTokenAddress,
    l2_bridgeAddress,
    l2_uniswapRouterAddress,
  } = readConfigFile()
  setupL2({
    l2_canonicalTokenAddress,
    l2_bridgeAddress,
    l2_uniswapRouterAddress
  })
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
}
