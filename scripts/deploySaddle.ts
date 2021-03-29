import { ethers, l2ethers as ovmEthers } from 'hardhat'
import { Contract, ContractFactory, providers } from 'ethers'

async function main() {
  const provider: providers.Provider = ovmEthers.provider

  const MathUtils: ContractFactory = await ovmEthers.getContractFactory("MathUtils")
  const mathUtils: Contract = await MathUtils.deploy()
  await mathUtils.deployed()
  const mathUtilsCode = await provider.getCode(mathUtils.address)
  console.log('MathUtils: ', mathUtils.address)
  logCode(mathUtilsCode)

  const SwapUtils: ContractFactory = await ovmEthers.getContractFactory(
    "SwapUtils",
    {
      libraries: {
        'MathUtils.ovm': mathUtils.address
      }
    }
  )
  const swapUtils: Contract = await SwapUtils.deploy()
  await swapUtils.deployed()
  const swapUtilsCode = await provider.getCode(swapUtils.address)
  console.log('SwapUtils: ', swapUtils.address)
  logCode(swapUtilsCode)

  const Swap: ContractFactory = await ovmEthers.getContractFactory(
    "Swap",
    {
      libraries: {
        'SwapUtils.ovm': swapUtils.address
      }
    }
  )
  const swap: Contract = await Swap.deploy()
  await swap.deployed()
  const swapCode = await provider.getCode(swap.address)
  console.log('Swap: ', swap.address)
  logCode(swapCode)

  function logCode(code: string) {
    let str = ''
    if (code && code.length > 20) {
      str += code.slice(0, 19)
      str += '...'
    } else if (code) {
      str = code
    }
    console.log('code: ', str)
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })