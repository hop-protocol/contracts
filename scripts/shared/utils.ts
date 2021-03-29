import path from 'path'
import { spawn } from 'child_process'
import fs from 'fs'
import { ContractFactory, Contract, BigNumber, Signer } from 'ethers'

import {
  isChainIdOptimism,
  isChainIdArbitrum,
  isChainIdXDai
} from '../../config/utils'

export const getContractFactories = async (
  chainId: BigNumber,
  signer: Signer,
  ethers: any,
  ovmEthers?: any
) => {
  const L1_MockERC20: ContractFactory = await ethers.getContractFactory(
    'contracts/test/MockERC20.sol:MockERC20',
    { signer }
  )
  const L1_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L1_ERC20_Bridge.sol:L1_ERC20_Bridge',
    { signer }
  )

  let L1_TokenBridge: ContractFactory
  let L1_Messenger: ContractFactory
  let L1_MessengerWrapper: ContractFactory
  let L2_MockERC20: ContractFactory
  let L2_HopBridgeToken: ContractFactory
  let L2_Bridge: ContractFactory
  let L2_Swap: ContractFactory
  let L2_AmmWrapper: ContractFactory
  ;({
    L1_TokenBridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_Swap,
    L2_AmmWrapper
  } = await getNetworkSpecificFactories(chainId, signer, ethers, ovmEthers))

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
  ethers: any,
  ovmEthers: any
) => {
  if (isChainIdOptimism(chainId)) {
    return getOptimismContractFactories(signer, ethers, ovmEthers)
  } else if (isChainIdArbitrum(chainId)) {
    return getArbitrumContractFactories(signer, ethers)
  } else if (isChainIdXDai(chainId)) {
    return getXDaiContractFactories(signer, ethers)
  } else {
    return {
      L1_TokenBridge: null,
      L1_Messenger: null,
      L1_MessengerWrapper: null,
      L2_MockERC20: null,
      L2_HopBridgeToken: null,
      L2_Bridge: null,
      L2_Swap: null,
      L2_AmmWrapper: null
    }
  }
}

const getOptimismContractFactories = async (
  signer: Signer,
  ethers: any,
  ovmEthers: any
) => {
  const L1_TokenBridge: ContractFactory = await ethers.getContractFactory(
    'contracts/test/optimism/mockOVM_L1_ERC20_Bridge.sol:OVM_L1_ERC20_Bridge',
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
  const L2_MockERC20: ContractFactory = await ovmEthers.getContractFactory(
    'contracts/test/MockERC20.sol:MockERC20',
    { signer }
  )
  const L2_HopBridgeToken: ContractFactory = await ovmEthers.getContractFactory(
    'contracts/bridges/HopBridgeToken.sol:HopBridgeToken',
    { signer }
  )
  const L2_Bridge: ContractFactory = await ovmEthers.getContractFactory(
    'contracts/bridges/L2_OptimismBridge.sol:L2_OptimismBridge',
    { signer }
  )

  const L2_MathUtils: ContractFactory = await ovmEthers.getContractFactory('MathUtils')
  const l2_mathUtils = await L2_MathUtils.deploy()
  await l2_mathUtils.deployed()

  const L2_SwapUtils = await ovmEthers.getContractFactory(
    'SwapUtils',
    {
      libraries: {
        'MathUtils.ovm': l2_mathUtils.address
      }
    }
  )
  const l2_swapUtils = await L2_SwapUtils.deploy()
  await l2_swapUtils.deployed()

  const L2_Swap = await ovmEthers.getContractFactory(
    'Swap',
    {
      libraries: {
        'SwapUtils.ovm': l2_swapUtils.address
      }
    }
  )

  const L2_AmmWrapper: ContractFactory = await ovmEthers.getContractFactory('L2_AmmWrapper', { signer })

  return {
    L1_TokenBridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_Swap,
    L2_AmmWrapper
  }
}

const getArbitrumContractFactories = async (signer: Signer, ethers: any) => {
  const L1_TokenBridge: ContractFactory = await ethers.getContractFactory(
    'contracts/test/arbitrum/IInbox.sol:IInbox',
    { signer }
  )
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/arbitrum/IInbox.sol:IInbox',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/ArbitrumMessengerWrapper.sol:ArbitrumMessengerWrapper',
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
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_ArbitrumBridge.sol:L2_ArbitrumBridge',
    { signer }
  )
  const L2_MathUtils: ContractFactory = await ethers.getContractFactory('MathUtils', { signer })
  const l2_mathUtils = await L2_MathUtils.deploy()
  await waitAfterTransaction(l2_mathUtils, ethers)

  const L2_SwapUtils = await ethers.getContractFactory(
    'SwapUtils',
    {
      libraries: {
        'MathUtils': l2_mathUtils.address
      }
    }
  )
  const l2_swapUtils = await L2_SwapUtils.deploy()
  await waitAfterTransaction(l2_swapUtils, ethers)

  const L2_Swap = await ethers.getContractFactory(
    'Swap',
    {
      libraries: {
        'SwapUtils': l2_swapUtils.address
      }
    }
  )

  const L2_AmmWrapper: ContractFactory = await ethers.getContractFactory('L2_AmmWrapper', { signer })

  return {
    L1_TokenBridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_Swap,
    L2_AmmWrapper
  }
}

const getXDaiContractFactories = async (signer: Signer, ethers: any) => {
  const L1_TokenBridge: ContractFactory = await ethers.getContractFactory(
    'contracts/test/xDai/IForeignOmniBridge.sol:IForeignOmniBridge',
    { signer }
  )
  const L1_Messenger: ContractFactory = await ethers.getContractFactory(
    'contracts/test/xDai/ArbitraryMessageBridge.sol:ArbitraryMessageBridge',
    { signer }
  )
  const L1_MessengerWrapper: ContractFactory = await ethers.getContractFactory(
    'contracts/wrappers/XDaiMessengerWrapper.sol:XDaiMessengerWrapper',
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
  const L2_Bridge: ContractFactory = await ethers.getContractFactory(
    'contracts/bridges/L2_XDaiBridge.sol:L2_XDaiBridge',
    { signer }
  )
  const L2_MathUtils: ContractFactory = await ethers.getContractFactory('MathUtils', { signer })
  const l2_mathUtils = await L2_MathUtils.deploy()
  await l2_mathUtils.deployed()

  const L2_SwapUtils = await ethers.getContractFactory(
    'SwapUtils',
    {
      libraries: {
        'MathUtils': l2_mathUtils.address
      }
    }
  )
  const l2_swapUtils = await L2_SwapUtils.deploy()
  await l2_swapUtils.deployed()

  const L2_Swap = await ethers.getContractFactory(
    'Swap',
    {
      libraries: {
        'SwapUtils': l2_swapUtils.address
      }
    }
  )

  const L2_AmmWrapper: ContractFactory = await ethers.getContractFactory('L2_AmmWrapper', { signer })

  return {
    L1_TokenBridge,
    L1_Messenger,
    L1_MessengerWrapper,
    L2_MockERC20,
    L2_HopBridgeToken,
    L2_Bridge,
    L2_Swap,
    L2_AmmWrapper
  }
}

export const sendChainSpecificBridgeDeposit = async (
  chainId: BigNumber,
  sender: Signer,
  amount: BigNumber,
  l1_tokenBridge: Contract,
  l1_canonicalToken: Contract,
  l2_canonicalToken: Contract
) => {
  if (isChainIdOptimism(chainId)) {
    const tx = await l1_tokenBridge
      .connect(sender)
      .deposit(
        l1_canonicalToken.address,
        l2_canonicalToken.address,
        await sender.getAddress(),
        amount
      )
    await tx.wait()
  } else if (isChainIdArbitrum(chainId)) {
    const tx = await l1_tokenBridge
      .connect(sender)
      .deposit(
        l1_canonicalToken.address,
        l2_canonicalToken.address,
        await sender.getAddress(),
        amount
      )
    await tx.wait()
  } else if (isChainIdXDai(chainId)) {
    const tx = await l1_tokenBridge
      .connect(sender)
      .relayTokens(
        l1_canonicalToken.address,
        await sender.getAddress(),
        amount
      )
    await tx.wait()
  } else {
    throw new Error(`Unsupported chain ID "${chainId}"`)
  }
}

const configFilepath = path.resolve(__dirname, '../deploy_config.json')

export const updateConfigFile = (newData: any) => {
  const data = readConfigFile()
  fs.writeFileSync(
    configFilepath,
    JSON.stringify({ ...data, ...newData }, null, 2)
  )
}

export const readConfigFile = () => {
  let data: any = {
    l2_chainId: '',
    l1_canonicalTokenAddress: '',
    l1_messengerAddress: '',
    l1_bridgeAddress: '',
    l2_bridgeAddress: '',
    l2_canonicalTokenAddress: '',
    l2_hopBridgeTokenAddress: '',
    l2_messengerAddress: '',
    l2_swapAddress: '',
    l2_ammWrapperAddress: ''
  }
  if (fs.existsSync(configFilepath)) {
    data = JSON.parse(fs.readFileSync(configFilepath, 'utf8'))
  }
  return data
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
  let timestamp: string = new Date(Date.now()).toISOString().substr(11, 8)
  timestamp = `[${timestamp}]`
  return {
    log: (...args: any[]) => {
      console.log(label, timestamp, ...args)
    },
    error: (...args: any[]) => {
      console.error(label, timestamp, ...args)
    }
  }
}
