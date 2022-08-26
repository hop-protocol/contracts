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
  l1MessengerWrapper: string[]
}

const decodeTypes: Record<string, ContractNames> = {
  arbitrum: {
    l1MessengerWrapper: ['address', 'address', 'address', 'uint256']
  },
  optimism: {
    l1MessengerWrapper: ['address', 'address', 'address', 'uint256', 'uint256']
  },
  polygon: {
    l1MessengerWrapper: ['address', 'address', 'address', 'address', 'uint256']
  },
  xdai: {
    l1MessengerWrapper: ['address', 'address', 'address', 'uit256', 'uint256', 'address']
  }
}
