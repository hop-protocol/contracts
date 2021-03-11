require('dotenv').config()

import { ethers, l2ethers as ovmEthers } from 'hardhat'
import { BigNumber, ContractFactory, Contract, Signer } from 'ethers'

import { getContractFactories, readConfigFile, updateConfigFile, waitAfterTransaction, wait } from '../shared/utils'
import { isChainIdXDai } from '../../config/utils'

import {
  DEFAULT_DEADLINE,
  LIQUIDITY_PROVIDER_UNISWAP_AMOUNT,
  DEFAULT_ETHERS_OVERRIDES as overrides
} from '../../config/constants'

interface Config {
  l2_chainId: string | BigNumber 
  l2_canonicalTokenAddress: string
  l2_hopBridgeTokenAddress: string
  l2_uniswapFactoryAddress: string
  l2_uniswapRouterAddress: string
}

export async function setupL2 (config: Config) {
  let {
    l2_chainId,
    l2_canonicalTokenAddress,
    l2_hopBridgeTokenAddress,
    l2_uniswapFactoryAddress,
    l2_uniswapRouterAddress
  } = config

  l2_chainId = BigNumber.from(l2_chainId)

  // Signers
  let accounts: Signer[]
  let owner: Signer
  let liquidityProvider: Signer

  // Factories
  let L2_MockERC20: ContractFactory
  let L2_HopBridgeToken: ContractFactory
  let L2_Bridge: ContractFactory
  let L2_UniswapFactory: ContractFactory
  let L2_UniswapRouter: ContractFactory

  // L2
  let l2_canonicalToken: Contract
  let l2_hopBridgeToken: Contract
  let l2_uniswapFactory: Contract
  let l2_uniswapRouter: Contract

  // Instantiate the wallets
  accounts = await ethers.getSigners()
  owner = accounts[0]
  liquidityProvider = accounts[2]

  // Get the contract Factories
  ;({
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_UniswapFactory,
    L2_UniswapRouter
  } = await getContractFactories(
    l2_chainId,
    owner,
    ethers,
    ovmEthers
  ))

  // Attach already deployed contracts
  l2_canonicalToken = L2_MockERC20.attach(l2_canonicalTokenAddress)
  l2_hopBridgeToken = L2_HopBridgeToken.attach(l2_hopBridgeTokenAddress)

  l2_uniswapFactory = L2_UniswapFactory.attach(l2_uniswapFactoryAddress)
  l2_uniswapRouter = L2_UniswapRouter.attach(l2_uniswapRouterAddress)

  /**
   * Setup
   */

  // Some chains take a while to send funds from L1 -> L2. Wait until the funds have been fully sent
  await waitForFunds(liquidityProvider, l2_canonicalToken, l2_hopBridgeToken)

  // Set up Uniswap
  let approvalParams: any[] = [l2_uniswapRouter.address, LIQUIDITY_PROVIDER_UNISWAP_AMOUNT]
  if (isChainIdXDai(l2_chainId)) { approvalParams.push(overrides) }
  await l2_canonicalToken
    .connect(liquidityProvider)
    .approve(...approvalParams)
  await waitAfterTransaction()
  await l2_hopBridgeToken
    .connect(liquidityProvider)
    .approve(...approvalParams)
  await waitAfterTransaction()
  
  let addLiquidityParams: any[] = [
    l2_hopBridgeToken.address,
    l2_canonicalToken.address,
    LIQUIDITY_PROVIDER_UNISWAP_AMOUNT,
    LIQUIDITY_PROVIDER_UNISWAP_AMOUNT,
    '0',
    '0',
    await liquidityProvider.getAddress(),
    DEFAULT_DEADLINE,
  ]
  if (isChainIdXDai(l2_chainId)) { addLiquidityParams.push(overrides) }
  console.log('0', l2_uniswapRouter.address)
  console.log('1', ...addLiquidityParams)
  await l2_uniswapRouter
    .connect(liquidityProvider)
    .addLiquidity(...addLiquidityParams)
  await waitAfterTransaction()

  let getPairParams: any[] = [l2_hopBridgeToken.address, l2_canonicalToken.address]
  if (isChainIdXDai(l2_chainId)) { getPairParams.push(overrides) }
  const uniswapPairAddress = await l2_uniswapFactory.getPair(...getPairParams)
  await waitAfterTransaction()

  console.log('L2 Setup Complete')
  console.log('L2 Uniswap Pair Address:', uniswapPairAddress)

  updateConfigFile({
    uniswapPairAddress
  })
}

const waitForFunds = async (
  account: Signer,
  l2_canonicalToken: Contract,
  l2_hopBridgeToken: Contract,
) => {
  let isFunded: boolean = false

  while (!isFunded) {
    const canonicalTokenBalance: BigNumber = await l2_canonicalToken.balanceOf(await account.getAddress(), overrides)
    const hopBridgeTokenBalance: BigNumber = await l2_hopBridgeToken.balanceOf(await account.getAddress(), overrides)

    if (canonicalTokenBalance.eq(0) || hopBridgeTokenBalance.eq(0)) {
      await wait(10e3)
    } else {
      isFunded = true
    }
  }

  return
}

if (require.main === module) {
  const {
    l2_chainId,
    l2_canonicalTokenAddress,
    l2_hopBridgeTokenAddress,
    l2_uniswapFactoryAddress,
    l2_uniswapRouterAddress,
  } = readConfigFile()
  setupL2({
    l2_chainId,
    l2_canonicalTokenAddress,
    l2_hopBridgeTokenAddress,
    l2_uniswapFactoryAddress,
    l2_uniswapRouterAddress
  })
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
}
