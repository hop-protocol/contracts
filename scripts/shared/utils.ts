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
  isChainIdXDai,
  isChainIdPolygon,
  isChainIdMainnet
} from '../../config/utils'

import {
  CHAIN_IDS,
  GAS_PRICE_MULTIPLIERS,
  ZERO_ADDRESS,
  LIQUIDITY_PROVIDER_INITIAL_BALANCE,
  COMMON_SYMBOLS
} from '../../config/constants'

import {
  mainnetNetworkData,
  goerliNetworkData,
  kovanNetworkData
} from '../../config/networks/index'

export const getContractFactories = async (
  chainId: BigNumber,
  signer: Signer,
  ethers: any
) => {

  const L1_MockERC20: ContractFactory = await ethers.getContractFactory(
    'contracts/test/MockERC20.sol:MockERC20',
    { signer }
  )
  const L1_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L1_ERC20_Bridge.sol:L1_ERC20_Bridge',
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
  const L2_Swap: ContractFactory = await ethers.getContractFactory(
    'Swap',
    {
      signer,
      libraries: {
        'SwapUtils': ZERO_ADDRESS
      }
    }
  )
  const L2_AmmWrapper: ContractFactory = await ethers.getContractFactory('L2_AmmWrapper', { signer })

  let L1_TokenBridge: ContractFactory
  let L1_Messenger: ContractFactory
  let L1_MessengerWrapper: ContractFactory
  let L2_Bridge: ContractFactory
  ;({
    L1_TokenBridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge
  } = await getNetworkSpecificFactories(chainId, signer, ethers))

  return {
    L1_MockERC20,
    L1_TokenBridge,
    L1_Bridge,
    L1_MessengerWrapper,
    L1_Messenger,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_Swap,
    L2_AmmWrapper
  }
}

const getNetworkSpecificFactories = async (
  chainId: BigNumber,
  signer: Signer,
  ethers: any
) => {
  if (isChainIdOptimism(chainId)) {
    return getOptimismContractFactories(signer, ethers)
  } else if (isChainIdArbitrum(chainId)) {
    return getArbitrumContractFactories(signer, ethers)
  } else if (isChainIdXDai(chainId)) {
    return getXDaiContractFactories(signer, ethers)
  } else if (isChainIdPolygon(chainId)) {
    return getPolygonContractFactories(signer, ethers)
  } else {
    return {
      L1_TokenBridge: null,
      L1_Messenger: null,
      L1_MessengerWrapper: null,
      L2_Bridge: null
    }
  }
}

const getOptimismContractFactories = async (
  signer: Signer,
  ethers: any
) => {
  const L1_TokenBridge: ContractFactory = await ethers.getContractFactory(
    'contracts/test/optimism/mockOVM_L1StandardBridge.sol:mockOVM_L1StandardBridge',
    { signer }
  )
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
    L1_TokenBridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge
  }
}

const getArbitrumContractFactories = async (signer: Signer, ethers: any) => {
  const L1_TokenBridge: ContractFactory = await ethers.getContractFactory(
    'contracts/interfaces/arbitrum/bridges/IEthERC20Bridge.sol:IEthERC20Bridge',
    { signer }
  )
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/interfaces/arbitrum/messengers/IInbox.sol:IInbox',
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
    L1_TokenBridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge
  }
}

const getXDaiContractFactories = async (signer: Signer, ethers: any) => {
  const L1_TokenBridge: ContractFactory = await ethers.getContractFactory(
    'contracts/test/xDai/MockForeignOmniBridge.sol:MockForeignOmniBridge',
    { signer }
  )
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
    L1_TokenBridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge
  }
}

const getPolygonContractFactories = async (signer: Signer, ethers: any) => {
  const L1_TokenBridge: ContractFactory = await ethers.getContractFactory(
    'contracts/test/polygon/MockRootChainManager.sol:MockRootChainManager',
    { signer }
  )
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

  return {
    L1_TokenBridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_Bridge
  }
}

export const sendChainSpecificBridgeDeposit = async (
  chainId: BigNumber,
  sender: Signer,
  amount: BigNumber,
  l1_tokenBridge: Contract,
  l1_canonicalToken: Contract,
  l2_canonicalToken: Contract,
  modifiedGasPrice: { [key: string]: BigNumber } | undefined = undefined

) => {
  let tx
  modifiedGasPrice = modifiedGasPrice || {}
  if (isChainIdOptimism(chainId)) {
    const l2GasForTransfer = BigNumber.from('2000000')
    const calldata = '0x'
    tx = await l1_tokenBridge
      .connect(sender)
      .deposit(
        l1_canonicalToken.address,
        l2_canonicalToken.address,
        amount,
        l2GasForTransfer,
        calldata,
        modifiedGasPrice
      )
  } else if (isChainIdArbitrum(chainId)) {
    tx = await l1_tokenBridge
      .connect(sender)
      .depositAsERC20(
        l1_canonicalToken.address,
        await sender.getAddress(),
        amount,
        '0',
        '1000000000000000000',
        '0',
        '0x',
        modifiedGasPrice
      )
  } else if (isChainIdXDai(chainId)) {
    tx = await l1_tokenBridge
      .connect(sender)
      .relayTokens(
        l1_canonicalToken.address,
        await sender.getAddress(),
        amount,
        modifiedGasPrice
      )
  } else if (isChainIdPolygon(chainId)) {
    const encodedAmount = ethersUtils.defaultAbiCoder.encode(['uint256'], [amount])
    tx = await l1_tokenBridge
      .connect(sender)
      .depositFor(
        await sender.getAddress(),
        l1_canonicalToken.address,
        encodedAmount,
        modifiedGasPrice
      )
  } else {
    throw new Error(`Unsupported chain ID "${chainId}"`)
  }

  await tx.wait()
}

const configFilepath = path.resolve(__dirname, '../deployAndSetupHop/deploy_config.json')

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
  } else if (networkName === 'kovan') {
    return kovanNetworkData
  } else {
    throw new Error('Invalid network name')
  }
}

export const waitAfterTransaction = async (
  contract: Contract = null,
  ethers = null
) => {
  // Ethers does not wait long enough after `deployed()` on some networks
  // so we wait additional time to verify deployment
  if (contract) {
    await contract.deployed()
  }

  // NOTE: 6 seconds seems to work fine. 5 seconds does not always work
  const secondsToWait = 6e3
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

export const doesNeedExplicitGasLimit = (chainId: BigNumber): Boolean => {
  if (isChainIdXDai(chainId) || isChainIdPolygon(chainId)) {
    return true
  }
  return false
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
  else {
    throw new Error ('Invalid token symbol getter')
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
  const gasPrice: BigNumber = (await ethers.provider.getGasPrice()).mul(wholeGasPriceMultiplier).div(tempMultiplier)
  return {
    gasPrice
  }
}
