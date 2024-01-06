require('dotenv').config()

import { ethers } from 'hardhat'
import { ContractFactory, Signer, Contract, BigNumber, providers } from 'ethers'

import {
  getContractFactories,
  updateConfigFile,
  readConfigFile,
  waitAfterTransaction,
  Logger
} from '../shared/utils'

import {
  isChainIdPolygon,
  isChainIdPolygonzk,
  getPolygonFxChildAddress,
  getTxOverridesPerChain,
  getL2BridgeDefaults
} from '../../config/utils'

import {
  CHAIN_IDS,
  DEFAULT_SWAP_A,
  DEFAULT_SWAP_FEE,
  DEFAULT_SWAP_ADMIN_FEE,
  DEFAULT_SWAP_WITHDRAWAL_FEE,
  ZERO_ADDRESS
} from '../../config/constants'

const logger = Logger('deployL2')
let overrides = {}

interface Config {
  l1ChainId: BigNumber
  l2ChainId: BigNumber
  l1BridgeAddress: string
  l2CanonicalTokenAddress: string
  l2MessengerAddress: string
  l2HBridgeTokenName: string
  l2HBridgeTokenSymbol: string
  l2HBridgeTokenDecimals: number
  l2SwapLpTokenName: string
  l2SwapLpTokenSymbol: string
  bonderAddress: string
  l2CanonicalTokenIsEth: boolean
  isEthDeployment: boolean
  isOmnichainToken: boolean
}

export async function deployL2 (config: Config) {
  logger.log('deploy L2')

  let {
    l1ChainId,
    l2ChainId,
    l1BridgeAddress,
    l2CanonicalTokenAddress,
    l2MessengerAddress,
    l2HBridgeTokenName,
    l2HBridgeTokenSymbol,
    l2HBridgeTokenDecimals,
    l2SwapLpTokenName,
    l2SwapLpTokenSymbol,
    bonderAddress,
    l2CanonicalTokenIsEth,
    isEthDeployment,
   isOmnichainToken 
  } = config

  logger.log(`config:
            l1ChainId: ${l1ChainId}
            l2ChainId: ${l2ChainId}
            l1BridgeAddress: ${l1BridgeAddress}
            l2CanonicalTokenAddress: ${l2CanonicalTokenAddress}
            l2MessengerAddress: ${l2MessengerAddress}
            l2HBridgeTokenName: ${l2HBridgeTokenName}
            l2HBridgeTokenSymbol: ${l2HBridgeTokenSymbol}
            l2HBridgeTokenDecimals: ${l2HBridgeTokenDecimals}
            bonderAddress: ${bonderAddress}
            l2CanonicalTokenIsEth: ${l2CanonicalTokenIsEth}
            isEthDeployment: ${isEthDeployment}
            isOmnichainToken: ${isOmnichainToken}`)

  l1ChainId = BigNumber.from(l1ChainId)
  l2ChainId = BigNumber.from(l2ChainId)

  // Signers
  let accounts: Signer[]
  let deployer: Signer
  let governance: Signer

  // Factories
  let L1_Bridge: ContractFactory
  let L2_MockERC20: ContractFactory
  let L2_HopBridgeToken: ContractFactory
  let L2_Bridge: ContractFactory
  let L2_AmmWrapper: ContractFactory
  let L2_MessengerProxy: ContractFactory

  // Contracts
  let l1_bridge: Contract
  let l2_bridge: Contract
  let l2_canonicalToken: Contract
  let l2_hopBridgeToken: Contract
  let l2_swap: Contract
  let l2_ammWrapper: Contract
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
    L1_Bridge,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_AmmWrapper,
    L2_MessengerProxy
  } = await getContractFactories(
    l2ChainId,
    deployer,
    ethers,
    isEthDeployment,
   isOmnichainToken 
  ))

  logger.log('attaching deployed contracts')
  // Attach already deployed contracts
  l1_bridge = L1_Bridge.attach(l1BridgeAddress)
  l2_canonicalToken = L2_MockERC20.attach(l2CanonicalTokenAddress)

  overrides = getTxOverridesPerChain(l2ChainId)

  /**
   * Deployments
   */

  if (isChainIdPolygonzk(l2ChainId)) {
    logPolygonzkNote()
  }

  let l2MessengerProxyAddress: string = ''
  let polygonzkL2GovAddress: string = ''
  if (isChainIdPolygon(l2ChainId)) {
    logger.log('deploying Polygon messenger proxy')
    const fxChild: string = getPolygonFxChildAddress(l1ChainId)
    l2_messengerProxy = await L2_MessengerProxy.deploy(fxChild, overrides)
    await waitAfterTransaction(l2_messengerProxy, ethers)

    l2MessengerAddress = l2_messengerProxy.address
    l2MessengerProxyAddress = l2_messengerProxy.address
  } else if (isChainIdPolygonzk(l2ChainId)) {
    logger.log('deploying Polygonzk messenger proxy')
    // Deploy bridge connector on L2
    l2_messengerProxy = await L2_MessengerProxy.deploy(overrides)
    await waitAfterTransaction(l2_messengerProxy, ethers)

    // Set connector address appropriately
    l2MessengerAddress = l2_messengerProxy.address
    l2MessengerProxyAddress = l2_messengerProxy.address

    // TODO: This is a bad way to do this. Should no longer be used until v2, so this is fine for now.
    polygonzkL2GovAddress = ''
    if (!polygonzkL2GovAddress) {
      throw new Error('Manually deploy the governance connector with the l2BridgeAddress')
    }
  }

  if (!isOmnichainToken) {
    logger.log('deploying L2 hop bridge token')
    l2_hopBridgeToken = await L2_HopBridgeToken.deploy(
      l2HBridgeTokenName,
      l2HBridgeTokenSymbol,
      l2HBridgeTokenDecimals,
      overrides
    )
    await waitAfterTransaction(l2_hopBridgeToken, ethers)

    logger.log('deploying L2 swap contract')
    ;({ l2_swap } = await deployAmm(
      deployer,
      ethers,
      l2ChainId,
      l2_canonicalToken,
      l2_hopBridgeToken,
      l2SwapLpTokenName,
      l2SwapLpTokenSymbol,
      logger
    ))
  } else {
    l2_hopBridgeToken = L2_HopBridgeToken.attach(l2CanonicalTokenAddress)
  }

  const governanceAddress: string = polygonzkL2GovAddress || await governance.getAddress()
  logger.log('deploying L2 bridge and L2 amm wrapper')
  ;({ l2_bridge, l2_ammWrapper } = await deployBridge(
    l2ChainId,
    l1ChainId,
    ethers,
    deployer,
    governanceAddress,
    bonderAddress,
    L2_Bridge,
    L2_AmmWrapper,
    l1_bridge,
    l2_bridge,
    l2_hopBridgeToken,
    l2_canonicalToken,
    l2_swap,
    l2_ammWrapper,
    l2MessengerAddress,
    l2MessengerProxyAddress,
    l2CanonicalTokenIsEth,
    isOmnichainToken,
    logger
  ))

  logger.log('deploying network specific contracts')

  if (!isOmnichainToken) {
    // Transfer ownership of the Hop Bridge Token to the L2 Bridge
    let transferOwnershipParams: any[] = [l2_bridge.address]

    logger.log('transferring ownership of L2 hop bridge token')
    tx = await l2_hopBridgeToken.transferOwnership(
      ...transferOwnershipParams,
      overrides
    )
    await tx.wait()
    await waitAfterTransaction()
  }

  if (isChainIdPolygon(l2ChainId)) {
    logger.log('setting Polygon-specific state')
    let tx = await l2_messengerProxy.setL2Bridge(l2_bridge.address, overrides)
    await tx.wait()
    await waitAfterTransaction()

    // Technically, setFxRootTunnel should be called here but we cannot do so because
    // we need the address of the L1 Messenger Wrapper. Because of this, we call setFxRootTunnel
    // in setupL1.
  }

  const l2HopBridgeTokenAddress: string = l2_hopBridgeToken.address
  const l2BridgeAddress: string = l2_bridge.address
  const l2SwapAddress: string = l2_swap?.address || ZERO_ADDRESS
  const l2AmmWrapperAddress: string = l2_ammWrapper.address

  logger.log('L2 Deployments Complete')
  logger.log('L2 Hop Bridge Token :', l2HopBridgeTokenAddress)
  logger.log('L2 Bridge           :', l2BridgeAddress)
  logger.log('L2 Swap             :', l2SwapAddress)
  logger.log('L2 Amm Wrapper      :', l2AmmWrapperAddress)
  logger.log('L2 Messenger        :', l2MessengerAddress)
  logger.log('L2 Messenger Proxy  :', l2MessengerProxyAddress)

  updateConfigFile({
    l2HopBridgeTokenAddress,
    l2BridgeAddress,
    l2SwapAddress,
    l2AmmWrapperAddress,
    l2MessengerAddress,
    l2MessengerProxyAddress
  })

  return {
    l2HopBridgeTokenAddress,
    l2BridgeAddress,
    l2SwapAddress,
    l2AmmWrapperAddress,
    l2MessengerAddress,
    l2MessengerProxyAddress
  }
}

const deployAmm = async (
  deployer: Signer,
  ethers: any,
  l2ChainId: BigNumber,
  l2_canonicalToken: Contract,
  l2_hopBridgeToken: Contract,
  l2SwapLpTokenName: string,
  l2SwapLpTokenSymbol: string,
  logger: any
) => {
  let decimalParams: any[] = []

  const l2CanonicalTokenDecimals = await l2_canonicalToken.decimals(
    ...decimalParams,
    overrides
  )
  const l2HopBridgeTokenDecimals = await l2_hopBridgeToken.decimals(
    ...decimalParams,
    overrides
  )

  // Deploy AMM contracts
  logger.log('Deploying L2 Swap Libs')
  const L2_SwapContractFactory: ContractFactory = await deployL2SwapLibs(
    deployer,
    ethers,
    logger
  )
  logger.log('Deploying L2 Swap')
  const l2_swap = await L2_SwapContractFactory.deploy(overrides)
  await waitAfterTransaction(l2_swap, ethers)

  let initializeParams: any[] = [
    [l2_canonicalToken.address, l2_hopBridgeToken.address],
    [l2CanonicalTokenDecimals, l2HopBridgeTokenDecimals],
    l2SwapLpTokenName,
    l2SwapLpTokenSymbol,
    DEFAULT_SWAP_A,
    DEFAULT_SWAP_FEE,
    DEFAULT_SWAP_ADMIN_FEE,
    DEFAULT_SWAP_WITHDRAWAL_FEE
  ]

  logger.log('Initializing Swap')
  const tx = await l2_swap.initialize(...initializeParams, overrides)
  await tx.wait()
  await waitAfterTransaction()

  return {
    l2_swap
  }
}

const deployL2SwapLibs = async (signer: Signer, ethers: any, logger: any) => {
  const L2_MathUtils: ContractFactory = await ethers.getContractFactory(
    'MathUtils',
    { signer }
  )
  logger.log('Deploying L2 Math Utils')
  const l2_mathUtils = await L2_MathUtils.deploy(overrides)
  await waitAfterTransaction(l2_mathUtils, ethers)

  const L2_SwapUtils = await ethers.getContractFactory('SwapUtils', {
    libraries: {
      MathUtils: l2_mathUtils.address
    }
  })

  logger.log('Deploying L2 Swap Utils')
  logger.log(
    'IMPORTANT: This transaction needs 4.5 million gas to be deployed on Polygon & 200 million gas on Arbitrum & Nova'
  )
  const l2_swapUtils = await L2_SwapUtils.deploy(overrides)
  await waitAfterTransaction(l2_swapUtils, ethers)

  return await ethers.getContractFactory('Swap', {
    libraries: {
      SwapUtils: l2_swapUtils.address
    }
  })
}

const deployBridge = async (
  chainId: BigNumber,
  l1ChainId: BigNumber,
  ethers: any,
  deployer: Signer,
  governanceAddress: string,
  bonderAddress: string,
  L2_Bridge: ContractFactory,
  L2_AmmWrapper: ContractFactory,
  l1_bridge: Contract,
  l2_bridge: Contract,
  l2_hopBridgeToken: Contract,
  l2_canonicalToken: Contract,
  l2_swap: Contract,
  l2_ammWrapper: Contract,
  l2MessengerAddress: string,
  l2MessengerProxyAddress: string,
  l2CanonicalTokenIsEth: boolean,
  isOmnichainToken: boolean,
  logger: any
) => {
  // NOTE: Adding more CHAIN_IDs here will push the OVM deployment over the contract size limit
  //       If additional CHAIN_IDs must be added, do so after the deployment.
  const l2BridgeDeploymentParams = getL2BridgeDefaults(
    chainId,
    l2MessengerAddress,
    l2MessengerProxyAddress,
    governanceAddress,
    l2_hopBridgeToken.address,
    l1_bridge.address,
    [CHAIN_IDS.ETHEREUM.MAINNET.toString()],
    [bonderAddress],
    l1ChainId
  )

  logger.log('Deploying L2 Bridge')
  l2_bridge = await L2_Bridge.connect(deployer).deploy(
    ...l2BridgeDeploymentParams,
    overrides
  )
  await waitAfterTransaction(l2_bridge, ethers)

  if (isOmnichainToken) {
    return {
      l2_bridge,
      l2_ammWrapper: L2_AmmWrapper.attach(ZERO_ADDRESS)
    }
  }
  logger.log('Deploying L2 AMM Wrapper')
  l2_ammWrapper = await L2_AmmWrapper.connect(deployer).deploy(
    l2_bridge.address,
    l2_canonicalToken.address,
    l2CanonicalTokenIsEth,
    l2_hopBridgeToken.address,
    l2_swap.address,
    overrides
  )
  await waitAfterTransaction(l2_ammWrapper, ethers)

  return {
    l2_bridge,
    l2_ammWrapper
  }
}

function logPolygonzkNote () {
  console.log(`
\n\n\n\n\n
Polygonzk requires some custom operation for deployment.
1. Run \`npm run deploy:connectors\` to deploy the Polygonzk connectors on L1 and L2.
2. Run \`npm run init:connector-l1\` to initialize the L1 connector.
3. Update deployL2::polygonzkL2GovAddress and setupL1::polygonzkL1GovAddress with the addresses.
3. Run \`npm run deploy\` to deploy the required contracts.
4. After the L2 bridge is deployed, add the address to initConnector.sol and run \`npm run init:connector-l2\` to initialize the L2 connector.
5. For mainnet, deploy another pair of connectors for SAFE gov.
\n\n\n\n\n
  `)
}

if (require.main === module) {
  const {
    l1ChainId,
    l2ChainId,
    l1BridgeAddress,
    l2CanonicalTokenAddress,
    l2MessengerAddress,
    l2HBridgeTokenName,
    l2HBridgeTokenSymbol,
    l2HBridgeTokenDecimals,
    l2SwapLpTokenName,
    l2SwapLpTokenSymbol,
    bonderAddress,
    l2CanonicalTokenIsEth,
    isEthDeployment,
   isOmnichainToken 
  } = readConfigFile()
  deployL2({
    l1ChainId,
    l2ChainId,
    l1BridgeAddress,
    l2CanonicalTokenAddress,
    l2MessengerAddress,
    l2HBridgeTokenName,
    l2HBridgeTokenSymbol,
    l2HBridgeTokenDecimals,
    l2SwapLpTokenName,
    l2SwapLpTokenSymbol,
    bonderAddress,
    l2CanonicalTokenIsEth,
    isEthDeployment,
   isOmnichainToken 
  })
    .then(() => {
      process.exit(0)
    })
    .catch(error => {
      logger.error(error)
      process.exit(1)
    })
}
