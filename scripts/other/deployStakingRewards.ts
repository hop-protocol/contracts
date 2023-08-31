require('dotenv').config()
import { ethers } from 'hardhat'

// Example usage:
// $ npm run deploy:staking-rewards

async function main () {

  const rewardsDistribution = ''
  const rewardsToken = ''
  const stakingToken = ''

  const network = await ethers.provider.getNetwork()
  console.log('network:', network)

  const signer = (await ethers.getSigners())[0]
  console.log('signer:', await signer.getAddress())

  const StakingRewards = await ethers.getContractFactory(
    'contracts/rewards/StakingRewards.sol:StakingRewards',
    { signer }
  )

  const rewards = await StakingRewards.deploy(rewardsDistribution, rewardsToken, stakingToken)
  await rewards.deployed()

  console.log('rewards address:', rewards.address)
  console.log('deployed bytecode:', await ethers.provider.getCode(rewards.address))
  console.log('complete')
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
