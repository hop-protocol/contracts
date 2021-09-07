require('dotenv').config()

import { ethers as l2Ethers } from 'ethers'
import { ethers } from 'hardhat'
import { BigNumber, ContractFactory, Signer, Contract, providers } from 'ethers'

import {
  getContractFactories,
  readConfigFile,
  waitAfterTransaction,
  updateConfigFile,
  getModifiedGasPrice,
  Logger
} from '../shared/utils'
import {
  getMessengerWrapperDefaults,
  getPolygonRpcEndpoint,
} from '../../config/utils'
import {
  ALL_SUPPORTED_CHAIN_IDS,
  ZERO_ADDRESS
} from '../../config/constants'
import {
  isChainIdMainnet,
  isChainIdPolygon
} from '../../config/utils'

import {
  getSetL1BridgeCallerMessage,
  executeCanonicalMessengerSendMessage,
  getAddActiveChainIdsMessage,
  getSetFxRootTunnelMessage,
  getSetAmmWrapperMessage
} from '../../test/shared/contractFunctionWrappers'

const logger = Logger('setupL1')

interface Config {
  l1ChainId: BigNumber
  l2ChainId: BigNumber
  l1MessengerAddress: string
  l1CanonicalTokenAddress: string
  l1BridgeAddress: string
  l2CanonicalTokenAddress: string
  l2BridgeAddress: string
  l2MessengerProxyAddress: string
  l2AmmWrapperAddress: string
  liquidityProviderSendAmount: BigNumber
}

export async function setupL1 (config: Config) {
  logger.log('setup L1')

  let {
    l1ChainId,
    l2ChainId,
    l1MessengerAddress,
    l1CanonicalTokenAddress,
    l1BridgeAddress,
    l2CanonicalTokenAddress,
    l2BridgeAddress,
    l2MessengerProxyAddress,
    l2AmmWrapperAddress,
    liquidityProviderSendAmount
  } = config

  logger.log(`config:
            l1ChainId: ${l1ChainId}
            l2ChainId: ${l2ChainId}
            l1MessengerAddress: ${l1MessengerAddress}
            l1CanonicalTokenAddress: ${l1CanonicalTokenAddress}
            l1BridgeAddress: ${l1BridgeAddress}
            l2CanonicalTokenAddress: ${l2CanonicalTokenAddress}
            l2BridgeAddress: ${l2BridgeAddress}
            l2MessengerProxyAddress: ${l2MessengerProxyAddress}
            l2AmmWrapperAddress: ${l2AmmWrapperAddress}
            liquidityProviderSendAmount: ${liquidityProviderSendAmount}`)

  l1ChainId = BigNumber.from(l1ChainId)
  l2ChainId = BigNumber.from(l2ChainId)
  liquidityProviderSendAmount = BigNumber.from(liquidityProviderSendAmount)

  // Signers
  let accounts: Signer[]
  let deployer: Signer
  let governance: Signer

  // Factories
  let L1_MockERC20: ContractFactory
  let L1_TokenBridge: ContractFactory
  let L1_Bridge: ContractFactory
  let L1_MessengerWrapper: ContractFactory
  let L1_Messenger: ContractFactory
  let L2_Bridge: ContractFactory
  let L2_MessengerProxy: ContractFactory

  // Contracts
  let l1_canonicalToken: Contract
  let l1_tokenBridge: Contract
  let l1_messengerWrapper: Contract
  let l1_bridge: Contract
  let l1_messenger: Contract
  let l2_canonicalToken: Contract
  let l2_bridge: Contract
  let l2_messengerProxy: Contract

  // Instantiate the wallets
  accounts = await ethers.getSigners()
  deployer = accounts[0]
  governance = accounts[1]

  logger.log('deployer:', await deployer.getAddress())
  logger.log('governance:', await governance.getAddress())

  // Transaction
  let tx: providers.TransactionResponse

  logger.log('getting contract factories')
  // Get the contract Factories
  ;({
    L1_MockERC20,
    L1_TokenBridge,
    L1_Bridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge,
    L2_MessengerProxy
  } = await getContractFactories(l2ChainId, deployer, ethers))

  logger.log('attaching deployed contracts')
  // Attach already deployed contracts
  l1_messenger = L1_Messenger.attach(l1MessengerAddress)
  l1_canonicalToken = L1_MockERC20.attach(l1CanonicalTokenAddress)
  l2_canonicalToken = L1_MockERC20.attach(l2CanonicalTokenAddress)
  l1_bridge = L1_Bridge.attach(l1BridgeAddress)
  l2_bridge = L2_Bridge.attach(l2BridgeAddress)

  /**
   * Setup deployments
   */

  // Assert that the messenger proxy address was set during deployments
  if (isChainIdPolygon(l2ChainId) && l2MessengerProxyAddress === ZERO_ADDRESS) {
    throw new Error('L2 Messenger Proxy address is not set')
  }

  // Deploy messenger wrapper
  const fxChildTunnelAddress: string = l2MessengerProxyAddress || '0x'
  const messengerWrapperDefaults: any[] = getMessengerWrapperDefaults(
    l1ChainId,
    l2ChainId,
    l1_bridge.address,
    l2_bridge.address,
    l1_messenger?.address || '0x',
    fxChildTunnelAddress
  )

  logger.log('deploying L1 messenger wrapper')
  let modifiedGasPrice = await getModifiedGasPrice(ethers, l1ChainId)
  l1_messengerWrapper = await L1_MessengerWrapper.connect(deployer).deploy(
    ...messengerWrapperDefaults,
    modifiedGasPrice
  )
  await waitAfterTransaction(l1_messengerWrapper)

  if (isChainIdPolygon(l2ChainId)) {
    logger.log('make polygon specific changes')
    l1_messenger = L1_MessengerWrapper.attach(l1_messenger.address)
    l2_messengerProxy = L2_MessengerProxy.attach(l2MessengerProxyAddress)

    logger.log(
      `IMPORTANT: this tx will fail if it is being called a second time (i.e. restarting a deployment halfway through).`,
      `The value can only be set once.`
    )
    await updatePolygonState(l1ChainId, l1_messengerWrapper, l2_messengerProxy)
  }

  /**
   * Setup invocations
   */

  logger.log('setting cross domain messenger wrapper on L1 bridge')
  // Set up the L1 bridge
  modifiedGasPrice = await getModifiedGasPrice(ethers, l1ChainId)
  tx = await l1_bridge.connect(governance).setXDomainConnector(
    l2ChainId,
    l1_messengerWrapper.address,
    modifiedGasPrice
  )
  await tx.wait()
  await waitAfterTransaction()

  // Set up L2 Bridge state (through the L1 Canonical Messenger)
  let setL1BridgeCallerParams: string
  if (isChainIdPolygon(l2ChainId)) {
    setL1BridgeCallerParams = l1_bridge.address
  } else {
    setL1BridgeCallerParams = l1_messengerWrapper.address
  }
  let message: string = getSetL1BridgeCallerMessage(
    setL1BridgeCallerParams
  )

  logger.log('setting L1 messenger wrapper address on L2 bridge')
  modifiedGasPrice = await getModifiedGasPrice(ethers, l1ChainId)
  tx = await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l1_messengerWrapper,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2ChainId,
    modifiedGasPrice
  )
  await tx.wait()
  await waitAfterTransaction()

  let addActiveChainIdsParams: any[] = ALL_SUPPORTED_CHAIN_IDS
  message = getAddActiveChainIdsMessage(addActiveChainIdsParams)

  logger.log('setting supported chain IDs on L2 bridge')
  logger.log(
    'chain IDs:',
    ALL_SUPPORTED_CHAIN_IDS.map(v => v.toString()).join(', ')
  )
  modifiedGasPrice = await getModifiedGasPrice(ethers, l1ChainId)
  tx = await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l1_messengerWrapper,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2ChainId,
    modifiedGasPrice
  )
  await tx.wait()
  await waitAfterTransaction()

  message = getSetAmmWrapperMessage(l2AmmWrapperAddress)

  logger.log('setting amm wrapper address on L2 bridge')
  modifiedGasPrice = await getModifiedGasPrice(ethers, l1ChainId)
  tx = await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l1_messengerWrapper,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2ChainId,
    modifiedGasPrice
  )
  await tx.wait()
  await waitAfterTransaction()

  // Get hop token on L2
  if (!isChainIdMainnet(l1ChainId)) {
    logger.log('minting L1 canonical token')
    modifiedGasPrice = await getModifiedGasPrice(ethers, l1ChainId)
    tx = await l1_canonicalToken
      .connect(deployer)
      .mint(
        await deployer.getAddress(),
        liquidityProviderSendAmount,
        modifiedGasPrice
      )
    await tx.wait()
    await waitAfterTransaction()
  }

  logger.log('approving L1 canonical token')
  modifiedGasPrice = await getModifiedGasPrice(ethers, l1ChainId)
  tx = await l1_canonicalToken
    .connect(deployer)
    .approve(
      l1_bridge.address,
      liquidityProviderSendAmount,
      modifiedGasPrice
    )
  await tx.wait()
  await waitAfterTransaction()

  const amountOutMin: BigNumber = BigNumber.from('0')
  const deadline: BigNumber = BigNumber.from('0')
  const relayerFee: BigNumber = BigNumber.from('0')

  logger.log('sending token to L2')
  logger.log(
    `IMPORTANT: if this transaction fails, it may be one of two things. (1) You are using a patched OZ. Reinstall`,
    `node modules & redeploy the L1 bridge. A failed transaction here will not show any internal calls and use very`,
    `little gas. (2) The L1 deployer does not have tokens to send over the bridge.`
  )
  modifiedGasPrice = await getModifiedGasPrice(ethers, l1ChainId)
  tx = await l1_bridge
    .connect(deployer)
    .sendToL2(
      l2ChainId,
      await deployer.getAddress(),
      liquidityProviderSendAmount,
      [
        '1',
        amountOutMin,
        deadline
      ],
      ZERO_ADDRESS,
      relayerFee,
      modifiedGasPrice
    )
  await tx.wait()
  await waitAfterTransaction()

  updateConfigFile({
    l1MessengerWrapperAddress: l1_messengerWrapper.address
  })

  logger.log('L1 Setup Complete')
  logger.log(`L1 Messenger Wrapper: ${l1_messengerWrapper.address}`)
}

const updatePolygonState = async (
  l1ChainId: BigNumber,
  l1_messengerWrapper: Contract,
  l2_messengerProxy: Contract
) => {
  const polygonRpcEndpoint = getPolygonRpcEndpoint(l1ChainId)
  const l2EthersProvider = new l2Ethers.providers.JsonRpcProvider(polygonRpcEndpoint)
  const l2EthersWallet = new l2Ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, l2EthersProvider)
  const polygonTransactionData: string = getSetFxRootTunnelMessage(l1_messengerWrapper.address)
  const gasLimit: number = 100000
  const gasPrice: number = 10000000000

  const setFxRootTunnelTransaction = {
    to: l2_messengerProxy.address,
    gasLimit,
    gasPrice,
    data: polygonTransactionData
  }

  const transaction = await l2EthersWallet.sendTransaction(setFxRootTunnelTransaction)
  return transaction.wait()
}

if (require.main === module) {
  const {
    l1ChainId,
    l2ChainId,
    l1MessengerAddress,
    l1CanonicalTokenAddress,
    l1BridgeAddress,
    l2CanonicalTokenAddress,
    l2BridgeAddress,
    l2MessengerProxyAddress,
    l2AmmWrapperAddress,
    liquidityProviderSendAmount
  } = readConfigFile()
  setupL1({
    l1ChainId,
    l2ChainId,
    l1MessengerAddress,
    l1CanonicalTokenAddress,
    l2CanonicalTokenAddress,
    l1BridgeAddress,
    l2BridgeAddress,
    l2MessengerProxyAddress,
    l2AmmWrapperAddress,
    liquidityProviderSendAmount
  })
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      logger.error(error)
      process.exit(1)
    })
}
