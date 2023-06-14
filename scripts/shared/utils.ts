import path from 'path'
import { spawn } from 'child_process'
import fs from 'fs'
import {
  ContractFactory,
  Contract,
  BigNumber,
  Signer,
  utils as ethersUtils
} from 'ethers'

import {
  isChainIdOptimism,
  isChainIdArbitrum,
  isChainIdNova,
  isChainIdXDai,
  isChainIdPolygon,
  isChainIdMainnet,
  isChainIdConsensys,
  isChainIdZkSync,
  isChainIdBase,
  isChainIdScroll,
  isChainIdPolygonZkEvm
} from '../../config/utils'

import {
  CHAIN_IDS,
  GAS_PRICE_MULTIPLIERS,
  ZERO_ADDRESS
} from '../../config/constants'

import {
  mainnetNetworkData,
  goerliNetworkData
} from '../../config/networks/index'

export const getContractFactories = async (
  chainId: BigNumber,
  signer: Signer,
  ethers: any,
  isEthDeployment: boolean = false,
  isHopDeployment: boolean = false
) => {
  let l1BridgeArtifact: string
  if (isEthDeployment) {
    l1BridgeArtifact = 'contracts/bridges/L1_ETH_Bridge.sol:L1_ETH_Bridge'
  } else if (isHopDeployment) {
    l1BridgeArtifact = 'contracts/bridges/L1_HOP_Bridge.sol:L1_HOP_Bridge'
  } else {
    l1BridgeArtifact = 'contracts/bridges/L1_ERC20_Bridge.sol:L1_ERC20_Bridge'
  }

  const L1_Bridge: ContractFactory = await ethers.getContractFactory(
    l1BridgeArtifact,
    { signer }
  )
  const L1_MockERC20: ContractFactory = await ethers.getContractFactory(
    'contracts/test/MockERC20.sol:MockERC20',
    { signer }
  )
  const L2_MockERC20: ContractFactory = await ethers.getContractFactory(
    'contracts/test/MockERC20.sol:MockERC20',
    { signer }
  )
  const L2_HopBridgeToken: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/HopBridgeToken.sol:HopBridgeToken',
    { signer }
  )

  // This contract needs to be linked. This line links it to an arbitrary address.
  // The linking must only be done for the deployment of this contract. Rather than doing it in this getter function,
  // it is done in the appropriate location in code. This is because the linked libraries are not deployed sometimes
  // when this function is called.
  const L2_Swap: ContractFactory = await ethers.getContractFactory('Swap', {
    signer,
    libraries: {
      SwapUtils: ZERO_ADDRESS
    }
  })
  const L2_AmmWrapper: ContractFactory = await ethers.getContractFactory(
    'L2_AmmWrapper',
    { signer }
  )

  let L1_Messenger: ContractFactory
  let L1_MessengerWrapper: ContractFactory
  let L2_Bridge: ContractFactory
  let L2_MessengerProxy: ContractFactory
  ;({
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge,
    L2_MessengerProxy
  } = await getNetworkSpecificFactories(chainId, signer, ethers))

  return {
    L1_MockERC20,
    L1_Bridge,
    L1_MessengerWrapper,
    L1_Messenger,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_Swap,
    L2_AmmWrapper,
    L2_MessengerProxy
  }
}

const getNetworkSpecificFactories = async (
  chainId: BigNumber,
  signer: Signer,
  ethers: any
) => {
  if (isChainIdOptimism(chainId)) {
    return getOptimismContractFactories(signer, ethers)
  } else if (isChainIdArbitrum(chainId) || isChainIdNova(chainId)) {
    return getArbitrumContractFactories(signer, ethers)
  } else if (isChainIdXDai(chainId)) {
    return getXDaiContractFactories(signer, ethers)
  } else if (isChainIdPolygon(chainId)) {
    return getPolygonContractFactories(signer, ethers)
  } else if (isChainIdConsensys(chainId)) {
    return getConsensysContractFactories(signer, ethers)
  } else if (isChainIdZkSync(chainId)) {
    return getZkSyncContractFactories(signer, ethers)
  } else if (isChainIdBase(chainId)) {
    return getBaseContractFactories(signer, ethers)
  } else if (isChainIdScroll(chainId)) {
    return getScrollContractFactories(signer, ethers)
  } else if (isChainIdPolygonZkEvm(chainId)) {
    return getPolygonZkEvmContractFactories(signer, ethers)
  } else {
    return {
      L1_Messenger: null,
      L1_MessengerWrapper: null,
      L2_Bridge: null,
      L2_MessengerProxy: null
    }
  }
}

const getOptimismContractFactories = async (signer: Signer, ethers: any) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/optimism/mockOVM_CrossDomainMessenger.sol:mockOVM_CrossDomainMessenger',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/OptimismMessengerWrapper.sol:OptimismMessengerWrapper',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_OptimismBridge.sol:L2_OptimismBridge',
    { signer }
  )

  return {
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge,
    L2_MessengerProxy: null
  }
}

const getArbitrumContractFactories = async (signer: Signer, ethers: any) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/arbitrum/mockArbitrum_Inbox.sol:mockArbitrum_Inbox',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/ArbitrumMessengerWrapper.sol:ArbitrumMessengerWrapper',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_ArbitrumBridge.sol:L2_ArbitrumBridge',
    { signer }
  )

  return {
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge,
    L2_MessengerProxy: null
  }
}

const getXDaiContractFactories = async (signer: Signer, ethers: any) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/xDai/Mock_L1_xDaiMessenger.sol:Mock_L1_xDaiMessenger',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/XDaiMessengerWrapper.sol:XDaiMessengerWrapper',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_XDaiBridge.sol:L2_XDaiBridge',
    { signer }
  )

  return {
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge,
    L2_MessengerProxy: null
  }
}

const getPolygonContractFactories = async (signer: Signer, ethers: any) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/polygon/Mock_L1_PolygonMessenger.sol:Mock_L1_PolygonMessenger',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/PolygonMessengerWrapper.sol:PolygonMessengerWrapper',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_PolygonBridge.sol:L2_PolygonBridge',
    { signer }
  )
  const L2_MessengerProxy: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_PolygonMessengerProxy.sol:L2_PolygonMessengerProxy',
    { signer }
  )

  return {
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge,
    L2_MessengerProxy
  }
}

const getConsensysContractFactories = async (signer: Signer, ethers: any) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/consensys/mockConsensysZkEvm_L1Bridge.sol:mockConsensysZkEvm_L1Bridge',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/ConsensysZkEvmMessengerWrapper.sol:ConsensysZkEvmMessengerWrapper',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_ConsensysZkEvmBridge.sol:L2_ConsensysZkEvmBridge',
    { signer }
  )

  return {
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge,
    L2_MessengerProxy: null
  }
}

const getZkSyncContractFactories = async (signer: Signer, ethers: any) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/zksync/mockZkSync_L1Bridge.sol:mockZkSync_L1Bridge',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/ZkSyncMessengerWrapper.sol:ZkSyncMessengerWrapper',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_ZkSyncBridge.sol:L2_ZkSyncBridge',
    { signer }
  )

  return {
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge,
    L2_MessengerProxy: null
  }
}

const getBaseContractFactories = async (signer: Signer, ethers: any) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/optimism/mockOVM_CrossDomainMessenger.sol:mockOVM_CrossDomainMessenger',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/BaseMessengerWrapper.sol:BaseMessengerWrapper',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_BaseBridge.sol:L2_BaseBridge',
    { signer }
  )

  return {
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge,
    L2_MessengerProxy: null
  }
}

const getScrollContractFactories = async (signer: Signer, ethers: any) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/scroll/mockScrollZkEvm_L1Bridge.sol:mockScrollZkEvm_L1Bridge',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/ScrollZkEvmMessengerWrapper.sol:ScrollZkEvmMessengerWrapper',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_ScrollZkEvmBridge.sol:L2_ScrollZkEvmBridge',
    { signer }
  )

  return {
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge,
    L2_MessengerProxy: null
  }
}

const getPolygonZkEvmContractFactories = async (
  signer: Signer,
  ethers: any
) => {
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/polygonzkevm/mockPolygonZkEvm_L1Bridge.sol:mockPolygonZkEvm_L1Bridge',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/PolygonZkEvmMessengerWrapper.sol:PolygonZkEvmMessengerWrapper',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_PolygonZkEvmBridge.sol:L2_PolygonZkEvmBridge',
    { signer }
  )
  const L2_MessengerProxy: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_PolygonZkEvmMessengerProxy.sol:L2_PolygonZkEvmMessengerProxy',
    { signer }
  )

  return {
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge,
    L2_MessengerProxy
  }
}

const configFilepath = path.resolve(
  __dirname,
  '../deployAndSetupHop/deploy_config.json'
)

export const updateConfigFile = (newData: any) => {
  const data = readConfigFile()
  fs.writeFileSync(
    configFilepath,
    JSON.stringify({ ...data, ...newData }, null, 2)
  )
}

export const readConfigFile = () => {
  let data: any = {
    l1ChainId: '',
    l2ChainId: '',
    l1CanonicalTokenAddress: '',
    l1MessengerAddress: '',
    l1BridgeAddress: '',
    l2BridgeAddress: '',
    l2CanonicalTokenAddress: '',
    l2HopBridgeTokenAddress: '',
    l2MessengerAddress: '',
    l2SwapAddress: '',
    l2AmmWrapperAddress: '',
    l2SwapLpTokenName: '',
    l2SwapLpTokenSymbol: '',
    l2MessengerProxyAddress: '',
    bonderAddress: ''
  }
  if (fs.existsSync(configFilepath)) {
    data = JSON.parse(fs.readFileSync(configFilepath, 'utf8'))
  }
  return data
}

export const getNetworkDataByNetworkName = (networkName: string) => {
  if (networkName === 'mainnet') {
    return mainnetNetworkData
  } else if (networkName === 'goerli') {
    return goerliNetworkData
  } else {
    throw new Error('Invalid network name')
  }
}

export const waitAfterTransaction = async (
  contract: Contract | null = null,
  ethers = null
) => {
  // Ethers does not wait long enough after `deployed()` on some networks
  // so we wait additional time to verify deployment
  if (contract) {
    await contract.deployed()
  }

  // Some endpoints are unreliable. 20s+ here helps with a smooth deployment process
  const secondsToWait = 20e3
  await wait(secondsToWait)

  if (contract && ethers) {
    await verifyDeployment(contract, ethers)
  }
}

export const verifyDeployment = async (contract: Contract, ethers) => {
  const isCodeAtAddress =
    (await ethers.provider.getCode(contract.address)).length > 50
  if (!isCodeAtAddress) {
    throw new Error('Did not deploy correctly')
  }
}

export const wait = async (t: number) => {
  return new Promise(resolve => setTimeout(() => resolve(null), t))
}

export async function execScript (cmd: string) {
  return new Promise((resolve, reject) => {
    const parts = cmd.split(' ')
    const proc = spawn(parts[0], parts.slice(1))
    proc.stdout.on('data', data => {
      process.stdout.write(data.toString())
    })
    proc.stderr.on('data', data => {
      process.stderr.write(data.toString())
    })
    proc.on('exit', code => {
      if (code !== 0) {
        reject(code)
        return
      }

      resolve(code)
    })
  })
}

export const Logger = (label: string) => {
  label = `[${label}]`
  return {
    log: (...args: any[]) => {
      console.log(label, getTimestamp(), ...args)
    },
    error: (...args: any[]) => {
      console.error(label, getTimestamp(), ...args)
    }
  }
}

const getTimestamp = (): string => {
  let timestamp: string = new Date(Date.now()).toISOString().substr(11, 8)
  return `[${timestamp}]`
}

export const getL1ChainIdFromNetworkName = (networkName: string): BigNumber => {
  return CHAIN_IDS.ETHEREUM[networkName.toUpperCase()]
}

export const getTokenSymbolLetterCase = (tokenSymbol: string): string => {
  tokenSymbol = tokenSymbol.toLowerCase()

  if (tokenSymbol.toLowerCase() === 'dai') return 'DAI'
  else if (tokenSymbol.toLowerCase() === 'seth') return 'sETh'
  else if (tokenSymbol.toLowerCase() === 'sbtc') return 'sBTC'
  else if (tokenSymbol.toLowerCase() === 'usdc') return 'USDC'
  else if (tokenSymbol.toLowerCase() === 'wbtc') return 'WBTC'
  else if (tokenSymbol.toLowerCase() === 'usdt') return 'USDT'
  else if (tokenSymbol.toLowerCase() === 'matic') return 'MATIC'
  else if (tokenSymbol.toLowerCase() === 'eth') return 'ETH'
  else if (tokenSymbol.toLowerCase() === 'frax') return 'FRAX'
  else if (tokenSymbol.toLowerCase() === 'hop') return 'HOP'
  else if (tokenSymbol.toLowerCase() === 'snx') return 'SNX'
  else if (tokenSymbol.toLowerCase() === 'susd') return 'sUSD'
  else if (tokenSymbol.toLowerCase() === 'uni') return 'UNI'
  else if (tokenSymbol.toLowerCase() === 'reth') return 'rETH'
  else if (tokenSymbol.toLowerCase() === 'magic') return 'MAGIC'
  else {
    throw new Error('Invalid token symbol getter')
  }
}

export const getModifiedGasPrice = async (ethers, l1ChainId: BigNumber) => {
  let gasPriceMultiplier: number
  if (isChainIdMainnet(l1ChainId)) {
    gasPriceMultiplier = GAS_PRICE_MULTIPLIERS.MAINNET
  } else {
    gasPriceMultiplier = GAS_PRICE_MULTIPLIERS.TESTNET
  }

  const tempMultiplier = 100
  const wholeGasPriceMultiplier = gasPriceMultiplier * tempMultiplier
  const gasPrice: BigNumber = (await ethers.provider.getGasPrice())
    .mul(wholeGasPriceMultiplier)
    .div(tempMultiplier)
  return {
    gasPrice
  }
}
