require('dotenv').config()

import { ethers } from 'hardhat'
import { BigNumber, ContractFactory, Signer, Contract, providers } from 'ethers'

import {
  getContractFactories,
  sendChainSpecificBridgeDeposit,
  readConfigFile,
  waitAfterTransaction,
  updateConfigFile,
  Logger
} from '../shared/utils'
import {
  getMessengerWrapperDefaults,
  getPolygonCheckpointManagerAddress,
  getPolygonStateSenderAddress,
  getPolygonErc20PredicateAddress
} from '../../config/utils'
import {
  ALL_SUPPORTED_CHAIN_IDS,
  ZERO_ADDRESS,
  DEFAULT_ADMIN_ROLE_HASH
} from '../../config/constants'
import {
  isChainIdMainnet,
  isChainIdPolygon
} from '../../config/utils'

import {
  getSetL1MessengerWrapperAddressMessage,
  executeCanonicalMessengerSendMessage,
  getAddActiveChainIdsMessage,
  getSetAmmWrapperAddressMessage
} from '../../test/shared/contractFunctionWrappers'

const logger = Logger('setupL1')

interface Config {
  l1_chainId: string | BigNumber
  l2_chainId: string | BigNumber
  l1_tokenBridgeAddress: string
  l1_messengerAddress: string
  l1_canonicalTokenAddress: string
  l1_bridgeAddress: string
  l2_canonicalTokenAddress: string
  l2_bridgeAddress: string
  l2_messengerProxyAddress: string
  l2_ammWrapperAddress: string
  liquidityProviderSendAmount: string | BigNumber
}

export async function setupL1 (config: Config) {
  logger.log('setup L1')

  let {
    l1_chainId,
    l2_chainId,
    l1_tokenBridgeAddress,
    l1_messengerAddress,
    l1_canonicalTokenAddress,
    l1_bridgeAddress,
    l2_canonicalTokenAddress,
    l2_bridgeAddress,
    l2_messengerProxyAddress,
    l2_ammWrapperAddress,
    liquidityProviderSendAmount
  } = config

  logger.log(`config:
            l1_chainId: ${l1_chainId}
            l2_chainId: ${l2_chainId}
            l1_messengerAddress: ${l1_messengerAddress}
            l1_tokenBridgeAddress: ${l1_tokenBridgeAddress}
            l1_canonicalTokenAddress: ${l1_canonicalTokenAddress}
            l1_bridgeAddress: ${l1_bridgeAddress}
            l2_canonicalTokenAddress: ${l2_canonicalTokenAddress}
            l2_bridgeAddress: ${l2_bridgeAddress}
            l2_messengerProxyAddress: ${l2_messengerProxyAddress}
            l2_ammWrapperAddress: ${l2_ammWrapperAddress}
            liquidityProviderSendAmount: ${liquidityProviderSendAmount}`)

  l1_chainId = BigNumber.from(l1_chainId)
  l2_chainId = BigNumber.from(l2_chainId)
  liquidityProviderSendAmount = BigNumber.from(liquidityProviderSendAmount)

  // Signers
  let accounts: Signer[]
  let owner: Signer
  let liquidityProvider: Signer
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

  if (isChainIdMainnet(l1_chainId)) {
    owner = accounts[0]
    liquidityProvider = owner
    governance = owner
  } else {
    owner = accounts[0]
    liquidityProvider = accounts[2]
    governance = accounts[4]
  }

  logger.log('owner:', await owner.getAddress())
  logger.log('liquidity provider:', await liquidityProvider.getAddress())
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
  } = await getContractFactories(l2_chainId, owner, ethers))

  logger.log('attaching deployed contracts')
  // Attach already deployed contracts
  l1_tokenBridge = L1_TokenBridge.attach(l1_tokenBridgeAddress)
  l1_messenger = L1_Messenger.attach(l1_messengerAddress)
  l1_canonicalToken = L1_MockERC20.attach(l1_canonicalTokenAddress)
  l2_canonicalToken = L1_MockERC20.attach(l2_canonicalTokenAddress)
  l1_bridge = L1_Bridge.attach(l1_bridgeAddress)
  l2_bridge = L2_Bridge.attach(l2_bridgeAddress)

  /**
   * Setup deployments
   */
  // TODO: Handle this better

  // NOTE: The messenger for Polygon needs to be pre-deployed and set up so that they can link it
  // Because of this, the messenger addresses should already be defined in deploy.ts
  if(isChainIdPolygon(l2_chainId as BigNumber)) {
    // NOTE: The messenger is attached the the MessengerWrapper interface
    l1_messenger = L1_MessengerWrapper.attach(l1_messenger.address)
    l1_messengerWrapper = L1_MessengerWrapper.attach(l1_messenger.address)
  } else {
    // Deploy messenger wrapper
    const messengerWrapperDefaults: any[] = getMessengerWrapperDefaults(
      l2_chainId as BigNumber,
      l1_bridge.address,
      l2_bridge.address,
      l1_messenger?.address || '0x'
    )

    logger.log('deploying L1 messenger wrapper')
    l1_messengerWrapper = await L1_MessengerWrapper.connect(owner).deploy(
      ...messengerWrapperDefaults
    )
    await waitAfterTransaction(l1_messengerWrapper)

    if (isChainIdPolygon(l2_chainId as BigNumber)) {
      logger.log('setting up polygon contracts')
      l2_messengerProxy = L2_MessengerProxy.attach(l2_messengerProxyAddress)
      await setUpPolygonContracts(
        l1_chainId as BigNumber,
        owner,
        l1_messengerWrapper,
        l2_messengerProxy
      )
    }
  }

  /**
   * Setup invocations
   */

  logger.log('setting cross domain messenger wrapper on L1 bridge')
  // Set up the L1 bridge
  tx = await l1_bridge.connect(governance).setCrossDomainMessengerWrapper(
    l2_chainId,
    l1_messengerWrapper.address
  )
  await tx.wait()
  await waitAfterTransaction()

  // Set up L2 Bridge state (through the L1 Canonical Messenger)
  let setL1MessengerWrapperAddressParams: string
  if (isChainIdPolygon(l2_chainId as BigNumber)) {
    setL1MessengerWrapperAddressParams = l1_bridge.address
  } else {
    setL1MessengerWrapperAddressParams = l1_messengerWrapper.address
  }
  let message: string = getSetL1MessengerWrapperAddressMessage(
    setL1MessengerWrapperAddressParams
  )

  logger.log('setting L1 messenger wrapper address on L2 bridge')
  await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2_chainId as BigNumber
  )
  await waitAfterTransaction()

  let addActiveChainIdsParams: any[] = ALL_SUPPORTED_CHAIN_IDS
  message = getAddActiveChainIdsMessage(addActiveChainIdsParams)

  logger.log('setting supported chain IDs on L2 bridge')
  logger.log(
    'chain IDs:',
    ALL_SUPPORTED_CHAIN_IDS.map(v => v.toString()).join(', ')
  )
  await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2_chainId as BigNumber
  )
  await waitAfterTransaction()

  message = getSetAmmWrapperAddressMessage(l2_ammWrapperAddress)

  logger.log('setting amm wrapper address on L2 bridge')
  await executeCanonicalMessengerSendMessage(
    l1_messenger,
    l2_bridge,
    ZERO_ADDRESS,
    governance,
    message,
    l2_chainId as BigNumber
  )
  await waitAfterTransaction()

  logger.log('minting L1 canonical token')
  // Get canonical token to L2
  // NOTE: If this is not the self-mintable testnet DAI, comment this line out
  if (!isChainIdMainnet(l1_chainId)) {
    tx = await l1_canonicalToken
      .connect(owner)
      .mint(
        await liquidityProvider.getAddress(),
        liquidityProviderSendAmount
      )
    await tx.wait()
    await waitAfterTransaction()
  }

  let contractToApprove: string
  if (isChainIdPolygon(l2_chainId as BigNumber)) {
    contractToApprove = getPolygonErc20PredicateAddress(l1_chainId as BigNumber)
  } else {
    contractToApprove = l1_tokenBridge.address
  }
  logger.log('approving L1 canonical token')
  tx = await l1_canonicalToken
    .connect(liquidityProvider)
    .approve(contractToApprove, liquidityProviderSendAmount)
  await tx.wait()
  await waitAfterTransaction()

  logger.log('sending chain specific bridge deposit')
  await sendChainSpecificBridgeDeposit(
    l2_chainId as BigNumber,
    liquidityProvider,
    liquidityProviderSendAmount,
    l1_tokenBridge,
    l1_canonicalToken,
    l2_canonicalToken
  )
  await waitAfterTransaction()

  logger.log('minting L1 canonical token')
  // Get hop token on L2
  // NOTE: If this is not the self-mintable testnet DAI, comment this line out
  if (!isChainIdMainnet(l1_chainId)) {
    tx = await l1_canonicalToken
      .connect(owner)
      .mint(
        await liquidityProvider.getAddress(),
        liquidityProviderSendAmount
      )
    await tx.wait()
    await waitAfterTransaction()
  }

  logger.log('approving L1 canonical token')
  tx = await l1_canonicalToken
    .connect(liquidityProvider)
    .approve(l1_bridge.address, liquidityProviderSendAmount)
  await tx.wait()
  await waitAfterTransaction()

  const amountOutMin: BigNumber = BigNumber.from('0')
  const deadline: BigNumber = BigNumber.from('0')
  const relayerFee: BigNumber = BigNumber.from('0')

  logger.log('sending token to L2')
  tx = await l1_bridge
    .connect(liquidityProvider)
    .sendToL2(
      l2_chainId,
      await liquidityProvider.getAddress(),
      liquidityProviderSendAmount,
      amountOutMin,
      deadline,
      ZERO_ADDRESS,
      relayerFee
    )
  await tx.wait()
  await waitAfterTransaction()

  updateConfigFile({
    l1_messengerWrapperAddress: l1_messengerWrapper.address
  })

  logger.log('L1 Setup Complete')
}

const setUpPolygonContracts = async (
  l1ChainId: BigNumber,
  owner: Signer,
  l1_messengerWrapper: Contract,
  l2_messengerProxy: Contract
) => {
    const stateSender: string = getPolygonStateSenderAddress(l1ChainId)
    const checkpointManager: string = getPolygonCheckpointManagerAddress(l1ChainId)
    const childTunnel: string = l2_messengerProxy.address

    let tx = await l1_messengerWrapper.setStateSender(stateSender)
    await tx.wait()
    await waitAfterTransaction()

    tx = await l1_messengerWrapper.setCheckpointManager(checkpointManager)
    await tx.wait()
    await waitAfterTransaction()

    tx = await l1_messengerWrapper.setChildTunnel(childTunnel)
    await tx.wait()
    await waitAfterTransaction()

    // NOTE: You cannot remove all members of a role. Instead, set to 0 and then remove the original
    tx = await l1_messengerWrapper.grantRole(DEFAULT_ADMIN_ROLE_HASH, ZERO_ADDRESS)
    await tx.wait()
    await waitAfterTransaction()

    tx = await l1_messengerWrapper.revokeRole(DEFAULT_ADMIN_ROLE_HASH, await owner.getAddress())
    await tx.wait()
    await waitAfterTransaction()
}

if (require.main === module) {
  const {
    l1_chainId,
    l2_chainId,
    l1_tokenBridgeAddress,
    l1_messengerAddress,
    l1_canonicalTokenAddress,
    l1_bridgeAddress,
    l2_canonicalTokenAddress,
    l2_bridgeAddress,
    l2_messengerProxyAddress,
    l2_ammWrapperAddress,
    liquidityProviderSendAmount
  } = readConfigFile()
  setupL1({
    l1_chainId,
    l2_chainId,
    l1_tokenBridgeAddress,
    l1_messengerAddress,
    l1_canonicalTokenAddress,
    l2_canonicalTokenAddress,
    l1_bridgeAddress,
    l2_bridgeAddress,
    l2_messengerProxyAddress,
    l2_ammWrapperAddress,
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
