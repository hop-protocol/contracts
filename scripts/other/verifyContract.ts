import { defaultAbiCoder } from 'ethers/lib/utils'

export async function verifyContract (hre: any, chain: string, contractName: string, address: string, data: string) {
  const types = decodeTypes[chain][contractName]
  data = data.replace('0x', '')
  const constructorArguments = defaultAbiCoder.decode(types, `0x${data}`)

  await hre.run("verify:verify", {
    address,
    constructorArguments
  })
}

// TODO: Add others
type ContractNames = {
  l1HopBridge?: string[]
  l1MessengerWrapper?: string[]
  l2Bridge?: string[]
  swapUtils?: string[]
  mathUtils?: string[]
}

const decodeTypes: Record<string, ContractNames> = {
  ethereum: {
    l1HopBridge: ['address', 'address[]', 'address', 'address']
  },
  arbitrum: {
    l1MessengerWrapper: ['address', 'address', 'address'],
    l2Bridge: ['address', 'address', 'address', 'address', 'uint256[]', 'address[]'],
    swapUtils: [],
    mathUtils: []
  },
  optimism: {
    l1MessengerWrapper: ['address', 'address', 'address', 'uint256', 'uint256'],
    l2Bridge: ['address', 'address', 'address', 'address', 'uint256[]', 'address[]', 'uint32'],
    swapUtils: [],
    mathUtils: []
  },
  polygon: {
    l1MessengerWrapper: ['address', 'address', 'address', 'address', 'uint256'],
    l2Bridge: ['address', 'address', 'address', 'address', 'uint256[]', 'address[]'],
    swapUtils: [],
    mathUtils: []
  },
  xdai: {
    l1MessengerWrapper: ['address', 'address', 'address', 'uint256', 'uint256', 'address'],
    l2Bridge: ['address', 'address', 'address', 'address', 'uint256[]', 'address[]', 'uint256', 'uint256'],
    swapUtils: [],
    mathUtils: []
  }
}
