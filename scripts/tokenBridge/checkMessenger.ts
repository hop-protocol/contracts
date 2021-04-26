require('dotenv').config()
import hre from 'hardhat'

const ethers = hre.ethers
// const l2ethers = hre.l2ethers

async function main () {
  console.log('network:', await ethers.provider.getNetwork())

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const Receiver = await ethers.getContractFactory('Receiver', { // Optimism
    signer: (await ethers.getSigners())[0]
  })

  // const receiver = await Receiver.deploy()
  const receiver = await Receiver.attach('0xFA7D79FF1b9ded9122DBbAeD597fA2405C96A476')
  console.log('receiver: ', receiver.address)
  const receiverCode = await ethers.provider.getCode(receiver.address)
  logCode(receiverCode)

  const num = await receiver.num()
  console.log('num: ', num)


  // // const L2_TokenBridge = await ethers.getContractFactory('Arbitrum_L2_ERC20_Bridge', { // Arbitrum
  // const L2_TokenBridge = await ethers.getContractFactory('OVM_L2_ERC20_Bridge', { // Optimism
  //   signer: (await ethers.getSigners())[0]
  // })

  // const l2_messenger = {
  //   // address: '0x0000000000000000000000000000000000000064' // Arbitrum
  //   address: '0x4200000000000000000000000000000000000007' // Optimism
  // }

  // const l1_tokenBridge = {
  //   address: '0x46b918574dcE85C7d04319d0e7d0FD039884C22e'
  // }

  // const l2_tokenBridge = await L2_TokenBridge.deploy(
  //   l2_messenger.address,
  //   l1_tokenBridge.address
  // )

  // await l2_tokenBridge.deployed()
  // console.log('L2 Token Bridge address:', l2_tokenBridge.address)
  // console.log(
  //   'deployed bytecode:',
  //   await ethers.provider.getCode(l2_tokenBridge.address)
  //   )
  // console.log('complete')
}

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

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
