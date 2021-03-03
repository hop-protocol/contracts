require('dotenv').config()
import util from 'util'

import { updateConfigFile } from './shared/utils'
import { CHAIN_IDS } from '../config/constants'

const exec = util.promisify(require('child_process').exec)

async function main() {
  const l2_chainId: string = CHAIN_IDS.ARBITRUM.TESTNET_3.toString()
  const l1_bridgeAddress: string = '0xB4585D433075bdF1B503C1e5ca8431999F7042C6'
  const l1_canonicalTokenAddress: string = '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9'
  const l1_messengerAddress: string = '0xE681857DEfE8b454244e701BA63EfAa078d7eA85'
  const l2_canonicalTokenAddress: string = '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9'
  const l2_messengerAddress: string = '0x0000000000000000000000000000000000000064'

  updateConfigFile({
    l2_chainId,
    l1_bridgeAddress,
    l1_canonicalTokenAddress,
    l1_messengerAddress,
    l2_canonicalTokenAddress,
    l2_messengerAddress
  })

  const networks = ['arbitrum']//, 'optimism', 'xdai']

  for (let network of networks) {
    await execScript(`npm run deploy:l2-${network}`)
    await execScript(`npm run setup:l1-kovan`)
    await execScript(`npm run setup:l2-${network}`)
  }
}

async function execScript(cmd: string) {
  let {stdout, stderr} = await exec(cmd)
  if (stdout) {
    process.stdout.write(stdout)
  }
  if (stderr) {
    process.stderr.write(stderr)
  }
}

main()
.catch(error => {
  console.error(error)
})
.finally(() => process.exit(0))
