require('dotenv').config()

import { ethers, l2ethers as ovmEthers } from 'hardhat'
import { BigNumber, ContractFactory, Contract, Signer, providers } from 'ethers'

import {
  getContractFactories,
  readConfigFile,
  updateConfigFile,
  waitAfterTransaction,
  wait,
  Logger
} from '../shared/utils'
import { isChainIdXDai } from '../../config/utils'

import {
  DEFAULT_DEADLINE,
  LIQUIDITY_PROVIDER_AMM_AMOUNT,
  ZERO_ADDRESS,
  DEFAULT_ETHERS_OVERRIDES as overrides
} from '../../config/constants'

const logger = Logger('setupL2')

interface Config {
  l2_chainId: string | BigNumber
  l2_canonicalTokenAddress: string
  l2_hopBridgeTokenAddress: string
  l2_bridgeAddress: string
  l2_swapAddress: string
}

export async function setupL2 (config: Config) {
  logger.log('setupL2')

  let {
    l2_chainId,
    l2_canonicalTokenAddress,
    l2_hopBridgeTokenAddress,
    l2_bridgeAddress,
    l2_swapAddress
  } = config

  logger.log(`config:
            l2_chainId: ${l2_chainId}
            l2_canonicalTokenAddress: ${l2_canonicalTokenAddress}
            l2_hopBridgeTokenAddress: ${l2_hopBridgeTokenAddress}
            l2_bridgeAddress: ${l2_bridgeAddress}
            l2_swapAddress: ${l2_swapAddress}`)

  l2_chainId = BigNumber.from(l2_chainId)

  // Signers
  let accounts: Signer[]
  let owner: Signer
  let liquidityProvider: Signer

  // Factories
  let L2_MockERC20: ContractFactory
  let L2_HopBridgeToken: ContractFactory
  let L2_Bridge: ContractFactory
  let L2_Swap: ContractFactory

  // L2
  let l2_canonicalToken: Contract
  let l2_hopBridgeToken: Contract
  let l2_bridge: Contract
  let l2_swap: Contract

  // Instantiate the wallets
  accounts = await ethers.getSigners()
  owner = accounts[0]
  liquidityProvider = accounts[2]

  logger.log('owner:', await owner.getAddress())
  logger.log('liquidity provider:', await liquidityProvider.getAddress())

  // Transaction
  let tx: providers.TransactionResponse

  logger.log('getting contract factories')
  // Get the contract Factories
  ;({
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_Swap
  } = await getContractFactories(l2_chainId, owner, ethers, ovmEthers))

  logger.log('attaching deployed contracts')
  // Attach already deployed contracts
  l2_canonicalToken = L2_MockERC20.attach(l2_canonicalTokenAddress)
  l2_hopBridgeToken = L2_HopBridgeToken.attach(l2_hopBridgeTokenAddress)

  l2_bridge = L2_Bridge.attach(l2_bridgeAddress)
  l2_swap = L2_Swap.attach(l2_swapAddress)

  /**
   * Setup
   */

  logger.log('waiting for L2 state verification')
  logger.log(`verification parameters:
            l2_chainId: ${l2_chainId}
            l2_canonicalToken: ${l2_canonicalToken.address}
            l2_hopBridgeToken: ${l2_hopBridgeToken.address}
            l2_bridge: ${l2_bridge.address}`)
  // Some chains take a while to send state from L1 -> L2. Wait until the state have been fully sent.
  await waitForL2StateVerification(
    liquidityProvider,
    l2_chainId,
    l2_canonicalToken,
    l2_hopBridgeToken,
    l2_bridge
  )

  logger.log('L2 state verified')
  // Set up Amm
  let approvalParams: any[] = [
    l2_swap.address,
    LIQUIDITY_PROVIDER_AMM_AMOUNT
  ]
  if (isChainIdXDai(l2_chainId)) {
    approvalParams.push(overrides)
  }

  logger.log('approving L2 canonical token')
  tx = await l2_canonicalToken
    .connect(liquidityProvider)
    .approve(...approvalParams)
  await tx.wait()
  await waitAfterTransaction()

  logger.log('approving L2 hop bridge token')
  tx = await l2_hopBridgeToken
    .connect(liquidityProvider)
    .approve(...approvalParams)
  await tx.wait()
  await waitAfterTransaction()

  let addLiquidityParams: any[] = [
    [LIQUIDITY_PROVIDER_AMM_AMOUNT, LIQUIDITY_PROVIDER_AMM_AMOUNT],
    '0',
    DEFAULT_DEADLINE
  ]
  if (isChainIdXDai(l2_chainId)) {
    addLiquidityParams.push(overrides)
  }

  logger.log('adding liquidity to L2 amm')
  logger.log('token amounts:', LIQUIDITY_PROVIDER_AMM_AMOUNT.toString())
  tx = await l2_swap
    .connect(liquidityProvider)
    .addLiquidity(...addLiquidityParams)
  await tx.wait()
  await waitAfterTransaction()

  const getPairParams: any[] = [
    l2_hopBridgeToken.address,
    l2_canonicalToken.address
  ]
  if (isChainIdXDai(l2_chainId)) {
    getPairParams.push(overrides)
  }

}

const waitForL2StateVerification = async (
  account: Signer,
  l2ChainId: BigNumber,
  l2_canonicalToken: Contract,
  l2_hopBridgeToken: Contract,
  l2_bridge: Contract
) => {
  let checkCount: number = 0
  let isStateSet: boolean = false

  while (!isStateSet) {
    if (checkCount === 30) {
      throw new Error(
        'L2 state has not been set after more than 5 minutes. Possibly due to a misconfiguration with modifiers on L2 bridge or messenger gas limit.'
      )
    }

    // Validate that the chainIds have been added
    const isChainIdSupported: boolean = await l2_bridge.supportedChainIds(
      l2ChainId,
      overrides
    )

    // Validate that the Amm wrapper address has been set
    const ammWrapperAddress: string = await l2_bridge.ammWrapper(
      overrides
    )

    // Validate that the Hop Bridge Token balance has been updated
    const canonicalTokenBalance: BigNumber = await l2_canonicalToken.balanceOf(
      await account.getAddress(),
      overrides
    )
    const hopBridgeTokenBalance: BigNumber = await l2_hopBridgeToken.balanceOf(
      await account.getAddress(),
      overrides
    )

    if (
      !isChainIdSupported ||
      ammWrapperAddress === ZERO_ADDRESS ||
      canonicalTokenBalance.eq(0) ||
      hopBridgeTokenBalance.eq(0)
    ) {
      logger.log('isChainIdSupported:', isChainIdSupported)
      logger.log('ammWrapperAddress:', ammWrapperAddress)
      logger.log('canonicalTokenBalance:', canonicalTokenBalance.toString())
      logger.log('hopBridgeTokenBalance:', hopBridgeTokenBalance.toString())
      checkCount += 1
      await wait(10e3)
    } else {
      logger.log('Number of iterations before state update:', checkCount)
      isStateSet = true
    }
  }

  return
}

if (require.main === module) {
  const {
    l2_chainId,
    l2_canonicalTokenAddress,
    l2_hopBridgeTokenAddress,
    l2_bridgeAddress,
    l2_swapAddress
  } = readConfigFile()
  setupL2({
    l2_chainId,
    l2_canonicalTokenAddress,
    l2_hopBridgeTokenAddress,
    l2_bridgeAddress,
    l2_swapAddress
  })
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      logger.error(error)
      process.exit(1)
    })
}
