require('dotenv').config()
import util from 'util'

import { updateConfigFile } from './shared/utils'
import {
  CHAIN_IDS,
  DEFAULT_H_BRIDGE_TOKEN_NAME,
  DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
  DEFAULT_H_BRIDGE_TOKEN_DECIMALS
} from '../config/constants'

const exec = util.promisify(require('child_process').exec)

async function main() {
  const l2_networkName: string = 'optimism'
  const l1_chainId: string = CHAIN_IDS.ETHEREUM.KOVAN.toString()
  const l2_chainId: string = CHAIN_IDS.OPTIMISM.HOP_TESTNET.toString()
  const l1_bridgeAddress: string = '0xB4585D433075bdF1B503C1e5ca8431999F7042C6'
  const l1_canonicalTokenAddress: string = '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9'
  const l1_messengerAddress: string = '0x77eeDe6CC8B46C76e50979Ce3b4163253979c519'
  const l2_canonicalTokenAddress: string = '0x57eaeE3D9C99b93D8FD1b50EF274579bFEC8e14B'
  const l2_messengerAddress: string = '0x6d2f304CFF4e0B67dA4ab38C6A5C8184a2424D05'
  const l2_hBridgeTokenName: string = DEFAULT_H_BRIDGE_TOKEN_NAME
  const l2_hBridgeTokenSymbol: string = DEFAULT_H_BRIDGE_TOKEN_SYMBOL
  const l2_hBridgeTokenDecimals: number = DEFAULT_H_BRIDGE_TOKEN_DECIMALS

  const inputs: any = {
    l2_networkName,
    l1_chainId,
    l2_chainId,
    l1_bridgeAddress,
    l1_canonicalTokenAddress,
    l1_messengerAddress,
    l2_canonicalTokenAddress,
    l2_messengerAddress,
    l2_hBridgeTokenName,
    l2_hBridgeTokenSymbol,
    l2_hBridgeTokenDecimals
  }

  validateInputs(inputs)
  updateConfigFile(inputs)

  await execScript(`npm run deploy:l2-${l2_networkName}`)
  // await execScript(`npm run setup:l1-kovan`)
  // await execScript(`npm run setup:l2-${l2_networkName}`)
}

async function execScript(cmd: string) {
  let {stdout, stderr} = await exec(cmd)
  if (stdout) {
    process.stdout.write(stdout)
  }
  if (stderr) {
    process.stderr.write(stderr)
    process.exit(0)
  }
}

function validateInputs(inputs: any) {
  if (
    !inputs.l2_networkName ||
    !inputs.l1_chainId ||
    !inputs.l2_chainId ||
    !inputs.l1_bridgeAddress ||
    !inputs.l1_canonicalTokenAddress ||
    !inputs.l1_messengerAddress ||
    !inputs.l2_canonicalTokenAddress ||
    !inputs.l2_messengerAddress ||
    !inputs.l2_hBridgeTokenName ||
    !inputs.l2_hBridgeTokenSymbol ||
    !inputs.l2_hBridgeTokenDecimals
  ) {
    throw new Error('Inputs must be defined')
  }
}

main()
.catch(error => {
  console.error(error)
})
.finally(() => process.exit(0))
