require('dotenv').config()

import { ethers } from 'hardhat'
import { BigNumber, ContractFactory, Contract, Signer, providers } from 'ethers'

import {
  getContractFactories,
  readConfigFile,
  updateConfigFile,
  waitAfterTransaction,
  wait,
  Logger
} from '../shared/utils'
import {
  isChainIdArbitrum,
  isChainIdNova,
  isChainIdPolygon,
  getActiveChainIds,
  getTxOverridesPerChain
} from '../../config/utils'

import {
  DEFAULT_DEADLINE,
  ZERO_ADDRESS,
  ALL_SUPPORTED_CHAIN_IDS
} from '../../config/constants'

const logger = Logger('setupL2')
let overrides: any = {}

import {
  getModifiedGasPrice,
} from '../shared/utils'

interface Config {
  l1ChainId: BigNumber
  l2ChainId: BigNumber
  l1MessengerWrapperAddress: string
  l2CanonicalTokenAddress: string
  l2HopBridgeTokenAddress: string
  l2BridgeAddress: string
  l2SwapAddress: string
  liquidityProviderAmmAmount: BigNumber
  l2CanonicalTokenIsEth: boolean
  isEthDeployment: boolean
  isOmnichainDeployment: boolean
}

export async function setupL2 (config: Config) {
  logger.log('setupL2')

  let {
    l1ChainId,
    l2ChainId,
    l1MessengerWrapperAddress,
    l2CanonicalTokenAddress,
    l2HopBridgeTokenAddress,
    l2BridgeAddress,
    l2SwapAddress,
    liquidityProviderAmmAmount,
    l2CanonicalTokenIsEth,
    isEthDeployment,
    isOmnichainDeployment 
  } = config

  logger.log(`config:
            l1ChainId: ${l1ChainId}
            l2ChainId: ${l2ChainId}
            l1MessengerWrapperAddress: ${l1MessengerWrapperAddress}
            l2CanonicalTokenAddress: ${l2CanonicalTokenAddress}
            l2HopBridgeTokenAddress: ${l2HopBridgeTokenAddress}
            l2BridgeAddress: ${l2BridgeAddress}
            l2SwapAddress: ${l2SwapAddress}
            liquidityProviderAmmAmount: ${liquidityProviderAmmAmount}
            l2CanonicalTokenIsEth: ${l2CanonicalTokenIsEth}
            isEthDeployment: ${isEthDeployment}
            isOmnichainDeployment: ${isOmnichainDeployment}`)

  l1ChainId = BigNumber.from(l1ChainId)
  l2ChainId = BigNumber.from(l2ChainId)
  liquidityProviderAmmAmount = BigNumber.from(liquidityProviderAmmAmount)

  // Signers
  let accounts: Signer[]
  let deployer: Signer

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
  deployer = accounts[0]

  logger.log('deployer:', await deployer.getAddress())

  // Transaction
  let tx: providers.TransactionResponse

  logger.log('getting contract factories')
  // Get the contract Factories
  ;({
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_Swap
  } = await getContractFactories(l2ChainId, deployer, ethers))

  logger.log('attaching deployed contracts')
  // Attach already deployed contracts
  l2_canonicalToken = L2_MockERC20.attach(l2CanonicalTokenAddress)
  l2_hopBridgeToken = L2_HopBridgeToken.attach(l2HopBridgeTokenAddress)

  l2_bridge = L2_Bridge.attach(l2BridgeAddress)
  l2_swap = L2_Swap.attach(l2SwapAddress)

  overrides = getTxOverridesPerChain(l2ChainId)

  /**
   * Setup
   */

  logger.log('waiting for L2 state verification')
  logger.log(`verification parameters:
            l2ChainId: ${l2ChainId}
            l2CanonicalToken: ${l2_canonicalToken.address}
            l2HopBridgeToken: ${l2_hopBridgeToken.address}
            l2Bridge: ${l2_bridge.address}`)

  // Transfer ownership of the messenger wrapper to governance
  if (isOmnichainDeployment) {
    logger.log('transferring ownership of L2 token')
    let transferOwnershipParams: any[] = [l2_bridge.address]
    const modifiedGasPrice = await getModifiedGasPrice(ethers, l1ChainId)
    tx = await l2_hopBridgeToken.transferOwnership(
      ...transferOwnershipParams,
      modifiedGasPrice
    )
    await tx.wait()
    await waitAfterTransaction()
  }
  // Some chains take a while to send state from L1 -> L2. Wait until the state have been fully sent.
  await waitForL2StateVerification(
    deployer,
    l2_canonicalToken,
    l2_hopBridgeToken,
    l2_bridge,
    l2CanonicalTokenIsEth,
    l2ChainId,
    isOmnichainDeployment 
  )

  logger.log('L2 state verified')
  if (isOmnichainDeployment) {
    const l2LpTokenAddress = ZERO_ADDRESS
    logAddresses(l2ChainId, l2CanonicalTokenIsEth, l2LpTokenAddress)
    return
  }

  // Set up Amm
  if (l2CanonicalTokenIsEth) {
    const depositTx = {
      to: l2_canonicalToken.address,
      value: liquidityProviderAmmAmount,
      gasLimit: overrides.gasLimit,
      gasPrice: overrides.gasPrice
    }
    tx = await deployer.sendTransaction(depositTx)
    await tx.wait()
    await waitAfterTransaction()
  }

  let approvalParams: any[] = [l2_swap.address, liquidityProviderAmmAmount]

  logger.log('approving L2 canonical token')
  tx = await l2_canonicalToken
    .connect(deployer)
    .approve(...approvalParams, overrides)
  await tx.wait()
  await waitAfterTransaction()

  logger.log('approving L2 hop bridge token')
  tx = await l2_hopBridgeToken
    .connect(deployer)
    .approve(...approvalParams, overrides)
  await tx.wait()
  await waitAfterTransaction()

  let addLiquidityParams: any[] = [
    [liquidityProviderAmmAmount, liquidityProviderAmmAmount],
    '0',
    DEFAULT_DEADLINE
  ]

  logger.log('adding liquidity to L2 amm')
  tx = await l2_swap
    .connect(deployer)
    .addLiquidity(...addLiquidityParams, { gasLimit: 1000000 })
  await tx.wait()
  await waitAfterTransaction()

  logger.log('retrieving lp token address')
  const res = await l2_swap.swapStorage(overrides)
  const lpTokenAddress = res[7]

  // Do not remove the LP token unless it is needed.

  updateConfigFile({
    l2LpTokenAddress: lpTokenAddress
  })

  logger.log('L2 Setup Complete')

  // Match output with addresses package
  logAddresses(l2ChainId, l2CanonicalTokenIsEth)
}

const waitForL2StateVerification = async (
  account: Signer,
  l2_canonicalToken: Contract,
  l2_hopBridgeToken: Contract,
  l2_bridge: Contract,
  l2CanonicalTokenIsEth: boolean,
  l2ChainId: BigNumber,
  isOmnichainDeployment: boolean
) => {
  let checkCount: number = 0
  let isStateSet: boolean = false
  const supportedChainIds = getActiveChainIds(l2ChainId)

  while (!isStateSet) {
    // Note: Mumbai can take up to 150 checks
    if (checkCount === 150) {
      throw new Error(
        'L2 state has not been set after more than 10 minutes. Possibly due to a misconfiguration with modifiers on L2 bridge or messenger gas limit.'
      )
    }

    // Validate that the chainIds have been added
    let areChainIdsSupported: boolean = true
    for (let i = 0; i < supportedChainIds.length; i++) {
      const isChainIdSupported: boolean = await l2_bridge.activeChainIds(
        supportedChainIds[i],
        overrides
      )
      if (!isChainIdSupported) {
        areChainIdsSupported = false
      }
    }

    // Validate that the Hop Bridge Token balance has been updated
    let canonicalTokenBalance: BigNumber
    if (l2CanonicalTokenIsEth) {
      canonicalTokenBalance = await account.getBalance()
    } else {
      canonicalTokenBalance = await l2_canonicalToken.balanceOf(
        await account.getAddress(),

        overrides
      )
    }

    const myAddress = await account.getAddress()

    let hopBridgeTokenBalance: BigNumber
    let ammWrapperAddress: string
    if (isOmnichainDeployment) {
      // These are arbitrary, as they do not exist for an omnichain deployment
      hopBridgeTokenBalance = BigNumber.from('1')
      ammWrapperAddress = '1'
    } else {
      hopBridgeTokenBalance = await l2_hopBridgeToken.balanceOf(
        await account.getAddress(),
        overrides
      )

      // Validate that the Amm wrapper address has been set
      ammWrapperAddress = await l2_bridge.ammWrapper(overrides)
    }

    // ammWrapperAddress = "0xfe8FAa1532112171Bc978fC104C6257d58bfa071"

    if (
      !areChainIdsSupported ||
      ammWrapperAddress === ZERO_ADDRESS ||
      canonicalTokenBalance.eq(0) ||
      hopBridgeTokenBalance.eq(0)
    ) {
      logger.log('isChainIdSupported:', areChainIdsSupported)
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

const logAddresses = (
  l2ChainId: BigNumber,
  l2CanonicalTokenIsEth: boolean,
  l2LpTokenAddress: string | null = null
) => {
  const postDeploymentAddresses = readConfigFile()
  let l1FxBaseRootTunnel: string
  let l2CanonicalBridgeAddress: string
  if (isChainIdPolygon(l2ChainId)) {
    l1FxBaseRootTunnel = postDeploymentAddresses.l1MessengerWrapperAddress

    if (l2CanonicalTokenIsEth) {
      const polygonMaticWithdrawalAddress =
        '0x0000000000000000000000000000000000001010'
      l2CanonicalBridgeAddress = polygonMaticWithdrawalAddress
    } else {
      l2CanonicalBridgeAddress = postDeploymentAddresses.l2CanonicalTokenAddress
    }
  } else {
    l1FxBaseRootTunnel = ''
    l2CanonicalBridgeAddress = postDeploymentAddresses.l2TokenBridgeAddress
  }

  if (!l2LpTokenAddress) {
    l2LpTokenAddress = postDeploymentAddresses.l2LpTokenAddress
  }
  logger.log(`
    l1Bridge: '${postDeploymentAddresses.l1BridgeAddress}'
    l1MessengerWrapper: '${postDeploymentAddresses.l1MessengerWrapperAddress}',
    l2CanonicalBridge: '${l2CanonicalBridgeAddress}',
    l2CanonicalToken: '${postDeploymentAddresses.l2CanonicalTokenAddress}',
    l2Bridge: '${postDeploymentAddresses.l2BridgeAddress}',
    l2HopBridgeToken: '${postDeploymentAddresses.l2HopBridgeTokenAddress}',
    l2AmmWrapper: '${postDeploymentAddresses.l2AmmWrapperAddress}',
    l2SaddleSwap: '${postDeploymentAddresses.l2SwapAddress}',
    l2SaddleLpToken: '${l2LpTokenAddress}',
    l1FxBaseRootTunnel: '${l1FxBaseRootTunnel}',
  `)
}

if (require.main === module) {
  const {
    l1ChainId,
    l2ChainId,
    l1MessengerWrapperAddress,
    l2CanonicalTokenAddress,
    l2HopBridgeTokenAddress,
    l2BridgeAddress,
    l2SwapAddress,
    liquidityProviderAmmAmount,
    l2CanonicalTokenIsEth,
    isEthDeployment,
   isOmnichainDeployment 
  } = readConfigFile()
  setupL2({
    l1ChainId,
    l2ChainId,
    l1MessengerWrapperAddress,
    l2CanonicalTokenAddress,
    l2HopBridgeTokenAddress,
    l2BridgeAddress,
    l2SwapAddress,
    liquidityProviderAmmAmount,
    l2CanonicalTokenIsEth,
    isEthDeployment,
   isOmnichainDeployment 
  })
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      logger.error(error)
      process.exit(1)
    })
}
