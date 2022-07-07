require('dotenv').config()
import { utils as ethersUtils } from 'ethers'
import prompt from 'prompt'

import { getUpdateContractStateMessage } from './getUpdateContractStateMessage'

const governanceAddress: string = '0xF56e305024B195383245A075737d16dBdb8487Fb'

const TxTypes = {
  Queue: 'queue',
  Execute: 'execute'
}

type TimelockData = {
  abi: string
  name: string
}

const chains: Record<string, string> = {
  Gnosis: 'gnosis',
  Polygon: 'polygon',
  Optimism: 'optimism',
  Arbitrum: 'arbitrum',
}
const tokens: string[] = [
  'USDC',
  'USDT',
  'DAI',
  'MATIC',
  'ETH',
]
const targetAddresses: Record<string, Record<string, string>> = {
  gnosis: {
    USDC: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
    USDT: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
    DAI: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
    MATIC: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
    ETH: '0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e',
  },
  polygon: {
    USDC: '0x4e9840f3C1ff368a10731D15c11516b9Fe7E1898',
    USDT: '0x2D8b884f7aaEa1Dd13a805071530Ba9Ee9a7E035',
    DAI: '0xB8a49c3137f27b04ee9E68727147b3131764B8A0',
    MATIC: '0xAd33Daa2BcDf3E52D30FCca3c7066762DF657657',
    ETH: '0x69d10828233D7a656104455445d289bBFD50eF6d',
  },
  optimism: {
    USDC: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
    USDT: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
    DAI: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
    MATIC: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
    ETH: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1',
  },
  arbitrum: {
    USDC: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    USDT: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    DAI: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    MATIC: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
    ETH: '0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f',
  },
}

const l2BridgeAddresses: Record<string, Record<string, string>> = {
  gnosis: {
    USDC: '0x25D8039bB044dC227f741a9e381CA4cEAE2E6aE8',
    USDT: '0xFD5a186A7e8453Eb867A360526c5d987A00ACaC2',
    DAI: '0x0460352b91D7CF42B0E1C1c30f06B602D9ef2238',
    MATIC: '0x7ac71c29fEdF94BAc5A5C9aB76E1Dd12Ea885CCC',
    ETH: '0xD8926c12C0B2E5Cd40cFdA49eCaFf40252Af491B',
  },
  polygon: {
    USDC: '0x25D8039bB044dC227f741a9e381CA4cEAE2E6aE8',
    USDT: '0x6c9a1ACF73bd85463A46B0AFc076FBdf602b690B',
    DAI: '0xEcf268Be00308980B5b3fcd0975D47C4C8e1382a',
    MATIC: '0x553bC791D746767166fA3888432038193cEED5E2',
    ETH: '0xb98454270065A31D71Bf635F6F7Ee6A518dFb849',
  },
  optimism: {
    USDC: '0xa81D244A1814468C734E5b4101F7b9c0c577a8fC',
    USDT: '0x46ae9BaB8CEA96610807a275EBD36f8e916b5C61',
    DAI: '0x7191061D5d4C60f598214cC6913502184BAddf18',
    ETH: '0x83f6244Bd87662118d96D9a6D44f09dffF14b30E',
  },
  arbitrum: {
    USDC: '0x0e0E3d2C5c292161999474247956EF542caBF8dd',
    USDT: '0x72209Fe68386b37A40d6bCA04f78356fd342491f',
    DAI: '0x7aC115536FE3A185100B2c4DE4cb328bf3A58Ba6',
    ETH: '0x3749C4f034022c39ecafFaBA182555d4508caCCC',
  },
}

async function main () {
  const res = await getPromptRes()
  const { token, functionToCall, input, txType } = res

  const timestamp = 1656637200
  const defaultValue = 0
  const calldata = await getUpdateContractStateMessage(functionToCall, input)

  let abi: string[]
  let ethersInterface: ethersUtils.Interface
  let data: string

  // Gnosis
  abi = ['function requireToPassMessage(address,bytes,uint256)']
  ethersInterface = new ethersUtils.Interface(abi)
  data = ethersInterface.encodeFunctionData(
    'requireToPassMessage', [l2BridgeAddresses['gnosis'][token], calldata, '1500000']
  )
  logData(chains.Gnosis, abi, token, data, defaultValue, timestamp, txType)

  // Polygon
  abi = ['function sendCrossDomainMessage(bytes)']
  ethersInterface = new ethersUtils.Interface(abi)
  data = ethersInterface.encodeFunctionData(
    'sendCrossDomainMessage', [calldata]
  )
  logData(chains.Polygon, abi, token, data, defaultValue, timestamp, txType)

  if (token === 'MATIC') return

  // Optimism
  abi = ['function sendMessage(address,bytes,uint32)']
  ethersInterface = new ethersUtils.Interface(abi)
  data = ethersInterface.encodeFunctionData(
    'sendMessage', [l2BridgeAddresses['optimism'][token], calldata, '5000000']
  )
  logData(chains.Optimism, abi, token, data, defaultValue, timestamp, txType)

  // Arbitrum
  abi = ['function createRetryableTicket(address,uint256,uint256,address,address,uint256,uint256,bytes)']
  ethersInterface = new ethersUtils.Interface(abi)
  data = ethersInterface.encodeFunctionData(
    'createRetryableTicket', [l2BridgeAddresses['arbitrum'][token], 0, '100000000000000', governanceAddress, governanceAddress, '1000000', '5000000000', calldata]
  )
  const value = 0.01
  logData(chains.Arbitrum, abi, token, data, value, timestamp, txType)
}

const getPromptRes = async() => {
  prompt.start()
  prompt.message = ''
  prompt.delimiter = ''

  const res = await prompt.get([{
    name: 'token',
    type: 'string',
    description: 'Token of bridge being updated',
    required: true
  }, {
    name: 'functionToCall',
    type: 'string',
    description: 'Function signature',
    required: true,
  }, {
    name: 'input',
    type: 'any',
    description: 'Function input',
    required: true
  }, {
    name: 'txType',
    type: 'string',
    description: 'Queue or execute',
    required: true
  }])

  const token: string = (res.token as string)
  const functionToCall: string = (res.functionToCall as string)
  const input: any = res.input
  const txType: any = (res.txType as string).toLowerCase()

  if (!tokens.includes(token)) {
    throw new Error('Invalid token')
  }

  if (
    txType !== TxTypes.Queue &&
    txType !== TxTypes.Execute
  ) {
    throw new Error('Tx type must be queue or execute')
  }

  return {
    token,
    functionToCall,
    input,
    txType
  }
}

const logData = (
  chain: string,
  abi: string[],
  token: string,
  data: string,
  value: number,
  eta: number,
  txType: string
) => {
  const target = targetAddresses[chain][token]
  const signature = abi[0].substring(9)
  const callData = '0x' + data.substring(10)
  const valueInWei = value === 0 ? value : ethersUtils.parseUnits(value.toString())
  const timelockData: TimelockData = getTimelockData(txType)

  const timelockAbi = [timelockData.abi]
  const ethersInterface = new ethersUtils.Interface(timelockAbi)
  const timelockCalldata = ethersInterface.encodeFunctionData(
    timelockData.name, [target, valueInWei, signature, callData, eta]
  )

  console.log(`\n${chain}`)
  console.log(timelockCalldata)

  if (chain === chains.Arbitrum) {
    const valueToSend = 10000000000000000
    console.log(`value to send: ${valueToSend}`)
  }
}

function getTimelockData (txType: string): TimelockData {
  const name = txType === 'queue' ? 'queueTransaction' : 'executeTransaction'
  return {
    abi: `function ${name}(address,uint256,string,bytes,uint256)`,
    name
  }
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
