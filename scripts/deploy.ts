require('dotenv').config()
import util from 'util'

import { updateConfigFile } from './shared/utils'
import {
  CHAIN_IDS,
  DEFAULT_H_BRIDGE_TOKEN_NAME,
  DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
  DEFAULT_H_BRIDGE_TOKEN_DECIMALS
} from '../config/constants'

interface NetworkParams {
  l2_networkName: string
  l1_chainId: string
  l2_chainId: string
  l1_bridgeAddress: string
  l1_canonicalTokenAddress: string
  l1_messengerAddress: string
  l2_canonicalTokenAddress: string
  l2_messengerAddress: string
  l2_hBridgeTokenName: string
  l2_hBridgeTokenSymbol: string
  l2_hBridgeTokenDecimals: number
}

const exec = util.promisify(require('child_process').exec)

async function main() {
  const l2_networkName: string = 'xdai'
  const networkParams: NetworkParams = getNetworkParams(l2_networkName)
  validateInputs(networkParams)
  updateConfigFile(networkParams)

  await execScript(`npm run deploy:l2-${l2_networkName}`)
  await execScript(`npm run setup:l1-kovan`)
  await execScript(`npm run setup:l2-${l2_networkName}`)
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

function getNetworkParams(networkName: string): NetworkParams {
  const l1_bridgeAddress: string = '0xC3AfC5D83d99eac3450aC9801cd6dd839d93f962'
  if (networkName === 'optimism') {
    return {
      l2_networkName: networkName,
      l1_chainId: CHAIN_IDS.ETHEREUM.KOVAN.toString(),
      l2_chainId: CHAIN_IDS.OPTIMISM.HOP_TESTNET.toString(),
      l1_bridgeAddress,
      l1_canonicalTokenAddress: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
      l1_messengerAddress: '0x77eeDe6CC8B46C76e50979Ce3b4163253979c519',
      l2_canonicalTokenAddress: '0x57eaeE3D9C99b93D8FD1b50EF274579bFEC8e14B',
      l2_messengerAddress: '0x6d2f304CFF4e0B67dA4ab38C6A5C8184a2424D05',
      l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
      l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
      l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS
    }
  }
  if (networkName === 'arbitrum') {
    return {
      l2_networkName: networkName,
      l1_chainId: CHAIN_IDS.ETHEREUM.KOVAN.toString(),
      l2_chainId: CHAIN_IDS.ARBITRUM.TESTNET_3.toString(),
      l1_bridgeAddress,
      l1_canonicalTokenAddress: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
      l1_messengerAddress: '0xE681857DEfE8b454244e701BA63EfAa078d7eA85',
      l2_canonicalTokenAddress: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
      l2_messengerAddress: '0x0000000000000000000000000000000000000064',
      l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
      l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
      l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS
    }
  }
  if (networkName === 'xdai') {
    return {
      l2_networkName: networkName,
      l1_chainId: CHAIN_IDS.ETHEREUM.KOVAN.toString(),
      l2_chainId: CHAIN_IDS.XDAI.SOKOL.toString(),
      l1_bridgeAddress,
      l1_canonicalTokenAddress: '0x7d669A64deb8a4A51eEa755bb0E19FD39CE25Ae9',
      l1_messengerAddress: '0xFe446bEF1DbF7AFE24E81e05BC8B271C1BA9a560',
      l2_canonicalTokenAddress: '0x714983a8Dc3329bf3BeB8F36b49878CF944E5A3B',
      l2_messengerAddress: '0x40CdfF886715A4012fAD0219D15C98bB149AeF0e',
      l2_hBridgeTokenName: DEFAULT_H_BRIDGE_TOKEN_NAME,
      l2_hBridgeTokenSymbol: DEFAULT_H_BRIDGE_TOKEN_SYMBOL,
      l2_hBridgeTokenDecimals: DEFAULT_H_BRIDGE_TOKEN_DECIMALS
    }
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
