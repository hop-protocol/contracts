require('dotenv').config()
import prompt from 'prompt'
import { BigNumber } from 'ethers'
import {
  readConfigFile,
  updateConfigFile,
  execScript,
  getNetworkDataByNetworkName,
  getTokenSymbolLetterCase,
  getLpSendAmount,
  Logger
} from '../shared/utils'
import { ZERO_ADDRESS } from '../../config/constants'
import { NetworkData } from '../../config/networks/index'

const logger = Logger('deploy')

async function main () {
  logger.log('deploy script initiated')

  let l1NetworkName: string
  let l2NetworkName: string
  let tokenSymbol: string
  let bonderAddress: string
  let isL1BridgeDeploy: boolean

  ;({
    l1NetworkName,
    l2NetworkName,
    tokenSymbol,
    bonderAddress,
    isL1BridgeDeploy
  } = await getPrompts())

  validateInput(l1NetworkName, l2NetworkName, tokenSymbol, bonderAddress)

  const basePath: string = 'scripts/deployAndSetupHop'
  const scripts: string[] = []
  if (isL1BridgeDeploy) {
    setL1BridgeNetworkParams(l1NetworkName, l2NetworkName, tokenSymbol, bonderAddress)
    scripts.push(`hardhat run ${basePath}/deployL1.ts --network ${l1NetworkName}`)
  }

  setNetworkParams(l1NetworkName, l2NetworkName, tokenSymbol, bonderAddress)
  scripts.push(
    `hardhat run ${basePath}/deployL2.ts --network ${l2NetworkName}`,
    `hardhat run ${basePath}/setupL1.ts --network ${l1NetworkName}`,
    `hardhat run ${basePath}/setupL2.ts --network ${l2NetworkName}`,
  )

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i]
    logger.log(`executing script ${i + 1}/${scripts.length} "${script}"`)
    await execScript(script)
  }

  logger.log('complete')
}

async function getPrompts () {
  prompt.start()
  prompt.message = ''
  prompt.delimiter = ''

  const res = await prompt.get([{
    name: 'l1NetworkName',
    type: 'string',
    required: true,
  }, {
    name: 'l2NetworkName',
    type: 'string',
    required: true
  }, {
    name: 'tokenSymbol',
    type: 'string',
    required: true
  }, {
    name: 'bonderAddress',
    type: 'string',
    required: true,
    default: ZERO_ADDRESS
  }, {
    name: 'isL1BridgeDeploy',
    type: 'boolean',
    required: true,
    default: false
  }])

  const l1NetworkName: string = (res.l1NetworkName as string).toLowerCase()
  const l2NetworkName: string = (res.l2NetworkName as string).toLowerCase()
  const tokenSymbol: string = (res.tokenSymbol as string).toLowerCase()
  const bonderAddress: string = (res.bonderAddress as string)
  const isL1BridgeDeploy: boolean = res.isL1BridgeDeploy as boolean

  return {
    l1NetworkName,
    l2NetworkName,
    tokenSymbol,
    bonderAddress,
    isL1BridgeDeploy
  }
}

function validateInput (
  l1NetworkName: string,
  l2NetworkName: string,
  tokenSymbol: string,
  bonderAddress: string
) {
  if (!l1NetworkName) {
    throw new Error('L1 network name is invalid')
  }

  if (!l2NetworkName) {
    throw new Error('L2 network name is invalid')
  }

  if (!tokenSymbol) {
    throw new Error('Token symbol is invalid')
  }

  if (bonderAddress.length !== 42) {
    throw new Error('Bonder address is invalid')
  }
}

function setL1BridgeNetworkParams (
  l1NetworkName: string,
  l2NetworkName: string,
  tokenSymbol: string,
  bonderAddress: string
) {
  const expectedTokenSymbolLetterCase: string = getTokenSymbolLetterCase(tokenSymbol)
  const networkData: NetworkData = getNetworkDataByNetworkName(l1NetworkName)

  const l1ChainId = networkData[l2NetworkName].l1ChainId
  const l1CanonicalTokenAddress = networkData[l2NetworkName].tokens[expectedTokenSymbolLetterCase].l1CanonicalTokenAddress

  updateConfigFile({
    l1ChainId,
    l1CanonicalTokenAddress,
    bonderAddress
  })
}

function setNetworkParams (
  l1NetworkName: string,
  l2NetworkName: string,
  tokenSymbol: string,
  bonderAddress: string
) {
  const { l1BridgeAddress } = readConfigFile()

  const liquidityProviderSendAmount: BigNumber = getLpSendAmount(l1NetworkName, tokenSymbol)
  const liquidityProviderAmmAmount: BigNumber = liquidityProviderSendAmount.div(2)

  const expectedTokenSymbolLetterCase: string = getTokenSymbolLetterCase(tokenSymbol)
  const networkData: NetworkData = getNetworkDataByNetworkName(l1NetworkName)

  const {
    l1ChainId,
    l2ChainId,
    l1MessengerAddress,
    l2TokenBridgeAddress,
    l2MessengerAddress,
    l1TokenBridgeAddress,
    tokens
  } = networkData[l2NetworkName]

  const {
    l1CanonicalTokenAddress,
    l2CanonicalTokenAddress,
    l2HBridgeTokenName,
    l2HBridgeTokenSymbol,
    l2HBridgeTokenDecimals,
    l2SwapLpTokenName,
    l2SwapLpTokenSymbol
  } = tokens[expectedTokenSymbolLetterCase]

  const data = {
    l1ChainId,
    l2ChainId,
    l1BridgeAddress,
    l1MessengerAddress,
    l2TokenBridgeAddress,
    l2MessengerAddress,
    l1TokenBridgeAddress,
    l1CanonicalTokenAddress,
    l2CanonicalTokenAddress,
    l2HBridgeTokenName,
    l2HBridgeTokenSymbol,
    l2HBridgeTokenDecimals,
    l2SwapLpTokenName,
    l2SwapLpTokenSymbol,
    liquidityProviderSendAmount: liquidityProviderSendAmount.toString(),
    liquidityProviderAmmAmount: liquidityProviderAmmAmount.toString(),
    bonderAddress
  }

  console.log('data:', data)
  updateConfigFile(data)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    logger.error(error)
    process.exit(1)
  })
