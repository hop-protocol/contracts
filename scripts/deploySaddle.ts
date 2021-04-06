import { ethers } from 'hardhat'
import { Contract, ContractFactory, providers } from 'ethers'
const ovmEthers = ethers

async function main() {
  const provider: providers.Provider = ethers.provider

  const MathUtils: ContractFactory = await ethers.getContractFactory("MathUtils")
  const mathUtils: Contract = await MathUtils.deploy()
  await mathUtils.deployed()
  const mathUtilsCode = await provider.getCode(mathUtils.address)
  console.log('MathUtils: ', mathUtils.address)
  logCode(mathUtilsCode)

  const SwapUtils: ContractFactory = await ethers.getContractFactory(
    "SwapUtils",
    {
      libraries: {
        'MathUtils': mathUtils.address
      }
    }
  )
  const swapUtils: Contract = await SwapUtils.deploy()
  await swapUtils.deployed()
  const swapUtilsCode = await provider.getCode(swapUtils.address)
  console.log('SwapUtils: ', swapUtils.address)
  logCode(swapUtilsCode)

  const Swap: ContractFactory = await ethers.getContractFactory(
    "Swap",
    {
      libraries: {
        'SwapUtils': swapUtils.address
      }
    }
  )
  const swap: Contract = await Swap.deploy()
  await swap.deployed()
  const swapCode = await provider.getCode(swap.address)
  console.log('Swap: ', swap.address)
  logCode(swapCode)

  // const swap: Contract = await Swap.attach('0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0')

  const a = await swap.getA({ gasLimit: 500000 })
  console.log('a: ', a.toString())

  const token0 = await swap.getToken(0, { gasLimit: 500000 })
  console.log('token0: ', token0)

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