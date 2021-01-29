import { ContractFactory, Contract, BigNumber } from 'ethers'

export const getContractFactories = async (ethers) => {
  const MockERC20: ContractFactory = await ethers.getContractFactory('contracts/test/MockERC20.sol:MockERC20')
  const L1_Bridge: ContractFactory = await ethers.getContractFactory('contracts/bridges/L1_Bridge.sol:L1_Bridge')
  const MessengerWrapper: ContractFactory = await ethers.getContractFactory('contracts/wrappers/OptimismMessengerWrapper.sol:OptimismMessengerWrapper')

  return {
    MockERC20,
    L1_Bridge,
    MessengerWrapper
  }
}

export const verifyDeployment = async (name: string, contract: Contract, ethers) => {
  const isCodeAtAddress = (await ethers.provider.getCode(contract.address)).length > 100
  if (!isCodeAtAddress) {
    throw new Error('Did not deploy correctly')
  }
}