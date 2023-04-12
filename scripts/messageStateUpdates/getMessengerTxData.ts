require('dotenv').config()
import { utils as ethersUtils } from 'ethers'
import prompt from 'prompt'

import { getUpdateContractStateMessage } from './getUpdateContractStateMessage'
import {
  DEFAULT_DEADLINE,
  CONSENSYS_ZK_EVM_MESSAGE_FEE,
  ZKSYNC_MESSAGE_FEE
} from '../../config/constants'

const governanceAddress: string = '0xF56e305024B195383245A075737d16dBdb8487Fb'
const chains: Record<string, string> = {
  Ethereum: 'ethereum',
  Gnosis: 'gnosis',
  Polygon: 'polygon',
  Optimism: 'optimism',
  Arbitrum: 'arbitrum',
  Nova: 'nova',
  Consensys: 'consensys',
  ZkSync: 'zksync',
  Base: 'base',
  Scroll: 'scroll',
  PolygonZkEvm: 'polygonzkevm'
}
const tokens: string[] = [
  'USDC',
  'USDT',
  'DAI',
  'MATIC',
  'ETH',
  'HOP',
  'SNX',
  'sUSD'
]
const targetAddresses: Record<string, Record<string, string>> = {
  gnosis: {
    USDC: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
    USDT: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
    DAI: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
    MATIC: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
    ETH: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
    HOP: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e'
  },
  polygon: {
    USDC: '0x1e1607db33D38715544E595A5D8f94557C487DfA',
    USDT: '0x1CD391bd1D915D189dE162F0F1963C07E60E4CD6',
    DAI: '0x172cAbe34c757472249aD4Bd97560373fBbf0DA3',
    MATIC: '0x29d591fF46194cE3B0B813CE7940569Fa06bE7fa',
    ETH: '0x26a1fDdaCfb9F6F5072eE5636ED3429101E6C069',
    HOP: '0xAa1603822b43e592e33b58d34B4423E1bcD8b4dC'
  },
  optimism: {
    USDC: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
    USDT: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
    DAI: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
    MATIC: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
    ETH: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
    HOP: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
    SNX: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
    sUSD: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1'
  },
  arbitrum: {
    USDC: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    USDT: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    DAI: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    MATIC: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    ETH: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    HOP: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f'
  },
  nova: {
    ETH: '0xc4448b71118c9071Bcb9734A0EAc55D18A153949'
  },
  consensys: {
    ETH: 'TODO' // TODO: consensys - for prod deployment
  },
  zksync: {
    ETH: 'TODO' // TODO: zksync - for prod deployment
  },
  base: {
    ETH: 'TODO' // TODO: base - for prod deployment
  },
  scroll: {
    ETH: 'TODO' // TODO: scroll - for prod deployment
  },
  polygonzkevm: {
    ETH: 'TODO' // TODO: polygonzkevm - for prod deployment
  }
}

const l1BridgeAddresses: Record<string, string> = {
  USDC: '0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a',
  USDT: '0x3E4a3a4796d16c0Cd582C382691998f7c06420B6',
  DAI: '0x3d4Cc8A61c7528Fd86C55cfe061a78dCBA48EDd1',
  MATIC: '0x22B1Cbb8D98a01a3B71D034BB899775A76Eb1cc2',
  ETH: '0xb8901acB165ed027E32754E0FFe830802919727f',
  HOP: '0x914f986a44AcB623A277d6Bd17368171FCbe4273'
}

const l2BridgeAddresses: Record<string, Record<string, string>> = {
  gnosis: {
    USDC: '0x25D8039bB044dC227f741a9e381CA4cEAE2E6aE8',
    USDT: '0xFD5a186A7e8453Eb867A360526c5d987A00ACaC2',
    DAI: '0x0460352b91D7CF42B0E1C1c30f06B602D9ef2238',
    MATIC: '0x7ac71c29fEdF94BAc5A5C9aB76E1Dd12Ea885CCC',
    ETH: '0xD8926c12C0B2E5Cd40cFdA49eCaFf40252Af491B',
    HOP: '0x6F03052743CD99ce1b29265E377e320CD24Eb632'
  },
  polygon: {
    USDC: '0x25D8039bB044dC227f741a9e381CA4cEAE2E6aE8',
    USDT: '0x6c9a1ACF73bd85463A46B0AFc076FBdf602b690B',
    DAI: '0xEcf268Be00308980B5b3fcd0975D47C4C8e1382a',
    MATIC: '0x553bC791D746767166fA3888432038193cEED5E2',
    ETH: '0xb98454270065A31D71Bf635F6F7Ee6A518dFb849',
    HOP: '0x58c61AeE5eD3D748a1467085ED2650B697A66234'
  },
  optimism: {
    USDC: '0xa81D244A1814468C734E5b4101F7b9c0c577a8fC',
    USDT: '0x46ae9BaB8CEA96610807a275EBD36f8e916b5C61',
    DAI: '0x7191061D5d4C60f598214cC6913502184BAddf18',
    ETH: '0x83f6244Bd87662118d96D9a6D44f09dffF14b30E',
    HOP: '0x03D7f750777eC48d39D080b020D83Eb2CB4e3547',
    SNX: '0x16284c7323c35F4960540583998C98B1CfC581a7',
    sUSD: '0x33Fe5bB8DA466dA55a8A32D6ADE2BB104E2C5201'
  },
  arbitrum: {
    USDC: '0x0e0E3d2C5c292161999474247956EF542caBF8dd',
    USDT: '0x72209Fe68386b37A40d6bCA04f78356fd342491f',
    DAI: '0x7aC115536FE3A185100B2c4DE4cb328bf3A58Ba6',
    ETH: '0x3749C4f034022c39ecafFaBA182555d4508caCCC',
    HOP: '0x25FB92E505F752F730cAD0Bd4fa17ecE4A384266'
  },
  nova: {
    ETH: '0x8796860ca1677Bf5d54cE5A348Fe4b779a8212f3'
  },
  consensys: {
    ETH: 'TODO' // TODO: consensys - for prod deployment
  },
  zksync: {
    ETH: 'TODO' // TODO: zksync - for prod deployment
  },
  base: {
    ETH: 'TODO' // TODO: base - for prod deployment
  },
  scroll: {
    ETH: 'TODO' // TODO: scroll - for prod deployment
  },
  polygonzkevm: {
    ETH: 'TODO' // TODO: polygonzkevm - for prod deployment
  }
}

async function main () {
  const res = await getPromptRes()
  const { token, functionToCall, input, timestamp } = res
  if (!tokens.includes(token)) {
    throw new Error('Invalid token')
  }

  const defaultValue = 0
  const calldata = await getUpdateContractStateMessage(functionToCall, input)

  let abi: string[] = []
  let ethersInterface: ethersUtils.Interface
  let data: string
  let l2BridgeAddress: string | undefined

  // Ethereum
  const paramTypes = 'uint256'
  abi = [`function ${functionToCall}(${paramTypes})`]
  ethersInterface = new ethersUtils.Interface(abi)
  data = ethersInterface.encodeFunctionData(functionToCall, [input])
  logData(chains.Ethereum, abi, token, data, defaultValue, timestamp)

  // Gnosis
  abi = ['function requireToPassMessage(address,bytes,uint256)']
  ethersInterface = new ethersUtils.Interface(abi)
  l2BridgeAddress = l2BridgeAddresses?.['gnosis']?.[token]
  data = !l2BridgeAddress
    ? null
    : ethersInterface.encodeFunctionData('requireToPassMessage', [
        l2BridgeAddress,
        calldata,
        '1500000'
      ])
  logData(chains.Gnosis, abi, token, data, defaultValue, timestamp)

  // Polygon
  abi = ['function sendCrossDomainMessage(bytes)']
  ethersInterface = new ethersUtils.Interface(abi)
  data = ethersInterface.encodeFunctionData('sendCrossDomainMessage', [
    calldata
  ])
  logData(chains.Polygon, abi, token, data, defaultValue, timestamp)

  if (token === 'MATIC') return

  // Optimism
  abi = ['function sendMessage(address,bytes,uint32)']
  ethersInterface = new ethersUtils.Interface(abi)
  l2BridgeAddress = l2BridgeAddresses?.['optimism']?.[token]
  data = !l2BridgeAddress
    ? null
    : ethersInterface.encodeFunctionData('sendMessage', [
        l2BridgeAddress,
        calldata,
        '5000000'
      ])
  logData(chains.Optimism, abi, token, data, defaultValue, timestamp)

  // Arbitrum
  abi = [
    'function createRetryableTicket(address,uint256,uint256,address,address,uint256,uint256,bytes)'
  ]
  ethersInterface = new ethersUtils.Interface(abi)
  l2BridgeAddress = l2BridgeAddresses?.['arbitrum']?.[token]
  let fee = '10000000000000000'
  data = !l2BridgeAddress
    ? null
    : ethersInterface.encodeFunctionData('createRetryableTicket', [
        l2BridgeAddress,
        0,
        '100000000000000',
        governanceAddress,
        governanceAddress,
        '1000000',
        '5000000000',
        calldata
      ])
  let value = 0.01
  logData(chains.Arbitrum, abi, token, data, value, timestamp, fee)

  // Nova
  abi = [
    'function createRetryableTicket(address,uint256,uint256,address,address,uint256,uint256,bytes)'
  ]
  ethersInterface = new ethersUtils.Interface(abi)
  l2BridgeAddress = l2BridgeAddresses?.['nova']?.[token]
  fee = '10000000000000000'
  data = !l2BridgeAddress
    ? null
    : ethersInterface.encodeFunctionData('createRetryableTicket', [
        l2BridgeAddress,
        0,
        '100000000000000',
        governanceAddress,
        governanceAddress,
        '1000000',
        '5000000000',
        calldata
      ])
  logData(chains.Nova, abi, token, data, value, timestamp, fee)

  // // Consensys
  // abi = ['function dispatchMessage(address,uint256,uint256,bytes)']
  // ethersInterface = new ethersUtils.Interface(abi)
  // l2BridgeAddress = l2BridgeAddresses?.['consensys']?.[token]
  // fee = CONSENSYS_ZK_EVM_MESSAGE_FEE
  // data = !l2BridgeAddress ? null : ethersInterface.encodeFunctionData(
  //   'dispatchMessage', [l2BridgeAddress, fee, DEFAULT_DEADLINE, calldata]
  // )
  // value = 0.012
  // logData(chains.Consensys, abi, token, data, value, timestamp, fee)

  // // zkSync
  // abi = ['function requestL2Transaction(address,uint256,bytes,uint256,bytes[])']
  // ethersInterface = new ethersUtils.Interface(abi)
  // l2BridgeAddress = l2BridgeAddresses?.['zksync']?.[token]
  // fee = ZKSYNC_MESSAGE_FEE
  // data = !l2BridgeAddress ? null : ethersInterface.encodeFunctionData(
  //   'requestL2Transaction', [l2BridgeAddress, 0, calldata, fee, ['']]
  // )
  // value = 0
  // logData(chains.ZkSync, abi, token, data, value, timestamp, fee)

  // // base
  // todo
}

const getPromptRes = async () => {
  prompt.start()
  prompt.message = ''
  prompt.delimiter = ''

  const res = await prompt.get([
    {
      name: 'timestamp',
      type: 'number',
      description: 'Timestamp to execute',
      required: true
    },
    {
      name: 'token',
      type: 'string',
      description: 'Token of bridge being updated',
      required: true
    },
    {
      name: 'functionToCall',
      type: 'string',
      description: 'Function signature',
      required: true
    },
    {
      name: 'input',
      type: 'any',
      description: 'Function input',
      required: true
    }
  ])

  const timestamp: any = res.timestamp as number
  const token: string = res.token as string
  const functionToCall: string = res.functionToCall as string
  const input: any = res.input

  return {
    token,
    functionToCall,
    input,
    timestamp
  }
}

const logData = (
  chain: string,
  abi: string[],
  token: string,
  data: string,
  value: number,
  eta: number,
  fee: string = '0'
) => {
  const isL1 = chain === chains.Ethereum
  if (!isL1 && !targetAddresses?.[chain]?.[token]) {
    console.log(`\nSkipping ${chain} because there is no deployment`)
    return
  }
  let target = isL1
    ? l1BridgeAddresses?.[token]
    : targetAddresses?.[chain]?.[token]

  console.log(`\n${chain}`)
  console.log(`target: ${target}`)
  console.log(`value: ${value}`)
  console.log(`sig: ${abi?.[0] && abi[0].substring(9)}`)
  console.log(`data: 0x${data.substring(10)}`)
  console.log(`eta: ${eta} (${new Date(eta * 1000)})`)

  if (
    chain === chains.Arbitrum ||
    chain === chains.Nova ||
    chain === chains.Consensys ||
    chain === chains.Scroll ||
    chain === chains.Base ||
    chain === chains.PolgyonZkEvm
  ) {
    console.log(`value to send: ${fee}`)
  }
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
