require('dotenv').config()
import prompt from 'prompt'
import {
  readConfigFile,
  updateConfigFile,
  execScript,
  getNetworkDataByNetworkName,
  getTokenSymbolLetterCase,
  Logger
} from './shared/utils'
import { NetworkData } from '../config/networks/index'

const logger = Logger('deploy')

async function main () {
  logger.log('deploy script initiated')

  let l1NetworkName: string
  let l2NetworkName: string
  let tokenSymbol: string
  let isL1BridgeDeploy: boolean

  ;({
    l1NetworkName,
    l2NetworkName,
    tokenSymbol,
    isL1BridgeDeploy
  } = await getPrompts())

  validateInput(l1NetworkName, l2NetworkName, tokenSymbol)

  const scripts: string[] = []
  if (isL1BridgeDeploy) {
    setL1BridgeNetworkParams(l1NetworkName, l2NetworkName, tokenSymbol)
    scripts.push(`npm run deploy:l1-${l1NetworkName}`)
  } else {
    setNetworkParams(l1NetworkName, l2NetworkName, tokenSymbol)
    scripts.push(
      `npm run deploy:l2-${l2NetworkName}`,
      `npm run setup:l1-${l1NetworkName}`,
      `npm run setup:l2-${l2NetworkName}`
    )
  }

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i]
    logger.log(`executing script ${i + 1}/${scripts.length} "${script}"`)
    await execScript(script)
  }

  logger.log('complete')
}

async function getPrompts () {
  prompt.start()
  const res = await prompt.get([{
    name: 'l1NetworkName',
    type: 'string',
    required: true
  }, {
    name: 'l2NetworkName',
    type: 'string',
    required: true
  }, {
    name: 'tokenSymbol',
    type: 'string',
    required: true
  }, {
    name: 'isL1BridgeDeploy',
    type: 'boolean',
    required: true,
    default: false
  }])

  const l1NetworkName: string = (res.l1NetworkName as string).toLowerCase()
  const l2NetworkName: string = (res.l2NetworkName as string).toLowerCase()
  const tokenSymbol: string = (res.tokenSymbol as string).toLowerCase()
  const isL1BridgeDeploy: boolean = res.isL1BridgeDeploy as boolean

  return {
    l1NetworkName,
    l2NetworkName,
    tokenSymbol,
    isL1BridgeDeploy
  }
}

function validateInput (
  l1NetworkName: string,
  l2NetworkName: string,
  tokenSymbol: string
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
}

function setL1BridgeNetworkParams (
  l1NetworkName: string,
  l2NetworkName: string,
  tokenSymbol: string
) {
  const expectedTokenSymbolLetterCase: string = getTokenSymbolLetterCase(tokenSymbol)
  const networkData: NetworkData = getNetworkDataByNetworkName(l1NetworkName)

  const l1ChainId = networkData[l2NetworkName].l1ChainId
  const l1CanonicalTokenAddress = networkData[l2NetworkName].tokens[expectedTokenSymbolLetterCase].l1CanonicalTokenAddress

  updateConfigFile({
    l1ChainId,
    l1CanonicalTokenAddress
  })
}

function setNetworkParams (
  l1NetworkName: string,
  l2NetworkName: string,
  tokenSymbol: string
) {
  const { l1BridgeAddress } = readConfigFile()

  const expectedTokenSymbolLetterCase: string = getTokenSymbolLetterCase(tokenSymbol)
  const networkData: NetworkData = getNetworkDataByNetworkName(l1NetworkName)

  const {
    l1ChainId,
    l2ChainId,
    l1MessengerAddress,
    l2TokenBridgeAddress,
    l2MessengerAddress,
    l1TokenBridgeAddress,
    l2MessengerProxyAddress,
    tokens
  } = networkData[l2NetworkName]

  const {
    l1CanonicalTokenAddress,
    l2CanonicalTokenAddress,
    l2HBridgeTokenName,
    l2HBridgeTokenSymbol,
    l2HBridgeTokenDecimals,
    l2SwapLpTokenName,
    l2SwapLpTokenSymbol,
    liquidityProviderSendAmount,
    liquidityProviderAmmAmount
  } = tokens[expectedTokenSymbolLetterCase]

  const data = {
    l1ChainId,
    l2ChainId,
    l1BridgeAddress,
    l1MessengerAddress,
    l2TokenBridgeAddress,
    l2MessengerAddress,
    l1TokenBridgeAddress,
    l2MessengerProxyAddress,
    l1CanonicalTokenAddress,
    l2CanonicalTokenAddress,
    l2HBridgeTokenName,
    l2HBridgeTokenSymbol,
    l2HBridgeTokenDecimals,
    l2SwapLpTokenName,
    l2SwapLpTokenSymbol,
    liquidityProviderSendAmount,
    liquidityProviderAmmAmount
  }

  console.log('data: ', data)
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
