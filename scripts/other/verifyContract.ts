import { defaultAbiCoder } from 'ethers/lib/utils'

export async function verifyContract (
  hre: any,
  chain: string,
  contractName: string,
  address: string,
  data: string
) {
  const types = decodeTypes[chain][contractName]
  data = data.replace('0x', '')
  const constructorArguments = defaultAbiCoder.decode(types, `0x${data}`)

  await hre.run('verify:verify', {
    address,
    constructorArguments
  })
}

// TODO: Add others
type ContractNames = {
  l1EthBridge?: string[]
  l1Erc20Bridge?: string[]
  l1HopBridge?: string[]
  l1MessengerWrapper?: string[]
  l2Bridge?: string[]
  swap?: string[]
  swapUtils?: string[]
  mathUtils?: string[]
  l2SaddleLpToken?: string[]
  l2AmmWrapper?: string[]
  l2HopBridgeToken?: string[]
}

const decodeTypes: Record<string, ContractNames> = {
  ethereum: {
    l1EthBridge: ['address[]', 'address'],
    l1Erc20Bridge: ['address', 'address[]', 'address'],
    l1HopBridge: ['address', 'address[]', 'address', 'address']
  },
  arbitrum: {
    l1MessengerWrapper: ['address', 'address', 'address', 'uint256'],
    l2Bridge: [
      'address',
      'address',
      'address',
      'address',
      'uint256[]',
      'address[]'
    ],
    swap: [],
    swapUtils: [],
    mathUtils: [],
    l2SaddleLpToken: ['string', 'string', 'uint8'],
    l2AmmWrapper: ['address', 'address', 'bool', 'address', 'address'],
    l2HopBridgeToken: ['string', 'string', 'uint8']
  },
  nova_mainnet: {
    l1MessengerWrapper: ['address', 'address', 'address', 'uint256'],
    l2Bridge: [
      'address',
      'address',
      'address',
      'address',
      'uint256[]',
      'address[]'
    ],
    swap: [],
    swapUtils: [],
    mathUtils: [],
    l2SaddleLpToken: ['string', 'string', 'uint8'],
    l2AmmWrapper: ['address', 'address', 'bool', 'address', 'address'],
    l2HopBridgeToken: ['string', 'string', 'uint8']
  },
  optimism: {
    l1MessengerWrapper: ['address', 'address', 'address', 'uint256', 'uint256'],
    l2Bridge: [
      'address',
      'address',
      'address',
      'address',
      'uint256[]',
      'address[]',
      'uint32'
    ],
    swap: [],
    swapUtils: [],
    mathUtils: [],
    l2SaddleLpToken: ['string', 'string', 'uint8'],
    l2AmmWrapper: ['address', 'address', 'bool', 'address', 'address'],
    l2HopBridgeToken: ['string', 'string', 'uint8']
  },
  polygon: {
    l1MessengerWrapper: ['address', 'address', 'address', 'address', 'uint256'],
    l2Bridge: [
      'address',
      'address',
      'address',
      'address',
      'uint256[]',
      'address[]'
    ],
    swap: [],
    swapUtils: [],
    mathUtils: [],
    l2SaddleLpToken: ['string', 'string', 'uint8'],
    l2AmmWrapper: ['address', 'address', 'bool', 'address', 'address'],
    l2HopBridgeToken: ['string', 'string', 'uint8']
  },
  xdai: {
    l1MessengerWrapper: [
      'address',
      'address',
      'address',
      'uint256',
      'uint256',
      'address'
    ],
    l2Bridge: [
      'address',
      'address',
      'address',
      'address',
      'uint256[]',
      'address[]',
      'uint256',
      'uint256'
    ],
    swap: [],
    swapUtils: [],
    mathUtils: [],
    l2SaddleLpToken: ['string', 'string', 'uint8'],
    l2AmmWrapper: ['address', 'address', 'bool', 'address', 'address'],
    l2HopBridgeToken: ['string', 'string', 'uint8']
  },
  linea_mainnet: {
    l1MessengerWrapper: ['address', 'address', 'address', 'uint256'],
    l2Bridge: [
      'address',
      'address',
      'address',
      'address',
      'uint256[]',
      'address[]'
    ],
    swap: [],
    swapUtils: [],
    mathUtils: [],
    l2SaddleLpToken: ['string', 'string', 'uint8'],
    l2AmmWrapper: ['address', 'address', 'bool', 'address', 'address'],
    l2HopBridgeToken: ['string', 'string', 'uint8']
  },
  zksync_mainnet: {
    l1MessengerWrapper: ['address', 'address', 'address', 'uint256'],
    l2Bridge: [
      'address',
      'address',
      'address',
      'address',
      'uint256[]',
      'address[]'
    ],
    swap: [],
    swapUtils: [],
    mathUtils: [],
    l2SaddleLpToken: ['string', 'string', 'uint8'],
    l2AmmWrapper: ['address', 'address', 'bool', 'address', 'address'],
    l2HopBridgeToken: ['string', 'string', 'uint8']
  },
  base_testnet: {
    l1MessengerWrapper: ['address', 'address', 'address', 'uint256', 'uint256'],
    l2Bridge: [
      'address',
      'address',
      'address',
      'address',
      'uint256[]',
      'address[]',
      'uint32'
    ],
    swap: [],
    swapUtils: [],
    mathUtils: [],
    l2SaddleLpToken: ['string', 'string', 'uint8'],
    l2AmmWrapper: ['address', 'address', 'bool', 'address', 'address'],
    l2HopBridgeToken: ['string', 'string', 'uint8']
  },
  scroll_mainnet: {
    l1MessengerWrapper: ['address', 'address', 'address', 'uint256'],
    l2Bridge: [
      'address',
      'address',
      'address',
      'address',
      'uint256[]',
      'address[]'
    ],
    swap: [],
    swapUtils: [],
    mathUtils: [],
    l2SaddleLpToken: ['string', 'string', 'uint8'],
    l2AmmWrapper: ['address', 'address', 'bool', 'address', 'address'],
    l2HopBridgeToken: ['string', 'string', 'uint8']
  },
  polygonzk_mainnet: {
    l1MessengerWrapper: ['address', 'uint256', 'address'],
    l2Bridge: [
      'address',
      'address',
      'address',
      'address',
      'uint256[]',
      'address[]'
    ],
    swap: [],
    swapUtils: [],
    mathUtils: [],
    l2SaddleLpToken: ['string', 'string', 'uint8'],
    l2AmmWrapper: ['address', 'address', 'bool', 'address', 'address'],
    l2HopBridgeToken: ['string', 'string', 'uint8']
  }
}
