require('dotenv').config()
import prompt from 'prompt'
import { BigNumber } from 'ethers'
import {
  readConfigFile,
  updateConfigFile,
  execScript,
  getNetworkDataByNetworkName,
  getTokenSymbolLetterCase,
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
  let l2CanonicalTokenIsEth: boolean
  let isEthDeployment: boolean
  let deploymentStep: number

  ;({
    l1NetworkName,
    l2NetworkName,
    tokenSymbol,
    bonderAddress,
    isL1BridgeDeploy,
    l2CanonicalTokenIsEth,
    isEthDeployment,
    deploymentStep 
  } = await getPrompts())

  validateInput(l1NetworkName, l2NetworkName, tokenSymbol, bonderAddress)

  const basePath: string = 'scripts/deployAndSetupHop'
  const scripts: string[] = []
  if (isL1BridgeDeploy) {
    setL1BridgeNetworkParams(l1NetworkName, l2NetworkName, tokenSymbol, bonderAddress)
    scripts.push(`hardhat run ${basePath}/deployL1.ts --network ${l1NetworkName}`)
  }

  setNetworkParams(
    l1NetworkName,
    l2NetworkName,
    tokenSymbol,
    bonderAddress,
    l2CanonicalTokenIsEth,
    isEthDeployment
  )

  l2NetworkName = handleCustomL2NetworkName(l1NetworkName, l2NetworkName)
  const deployL2Cmd = `hardhat run ${basePath}/deployL2.ts --network ${l2NetworkName}`
  const setupL1Cmd = `hardhat run ${basePath}/setupL1.ts --network ${l1NetworkName}`
  const setupL2Cmd = `hardhat run ${basePath}/setupL2.ts --network ${l2NetworkName}`
  if (deploymentStep === 0) {
    scripts.push(
      deployL2Cmd,
      setupL1Cmd,
      setupL2Cmd
    )
  } else if (deploymentStep === 1) {
    scripts.push(deployL2Cmd)
  } else if (deploymentStep === 2) {
    scripts.push(setupL1Cmd)
  } else if (deploymentStep === 3) {
    scripts.push(setupL2Cmd)
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
  prompt.message = ''
  prompt.delimiter = ''

  const res = await prompt.get([{
    name: 'l1NetworkName',
    description: 'L1 Network Name:',
    type: 'string',
    required: true,
  }, {
    name: 'l2NetworkName',
    description: 'L2 Network Name:',
    type: 'string',
    required: true
  }, {
    name: 'tokenSymbol',
    description: 'Token Symbol:',
    type: 'string',
    required: true
  }, {
    name: 'bonderAddress',
    description: 'Bonder Address:',
    type: 'string',
    required: true,
    default: ZERO_ADDRESS
  }, {
    name: 'isL1BridgeDeploy',
    description: 'Is this an L1 Bridge Deployment:',
    type: 'boolean',
    required: true,
    default: false
  }, {
    name: 'l2CanonicalTokenIsEth',
    description: 'Is the l2 canonical token a native asset',
    type: 'boolean',
    required: true,
    default: false
  }, {
    name: 'isEthDeployment',
    description: 'Is this a deployment for an ETH bridge set',
    type: 'boolean',
    required: true,
    default: false
  }, {
    name: 'deploymentStep',
    description: 'Deployment Step (0 for all) (0, 1, 2, or 3)',
    type: 'number',
    required: true,
    default: 0
  }, {
    name: 'didSendBridgeFunds',
    description: 'Do you have tokens on L1 & did you send tokens over the native bridge for LP AND convert to wrapped if needed?',
    type: 'boolean',
    required: true,
    default: true
  }])

  const l1NetworkName: string = (res.l1NetworkName as string).toLowerCase()
  const l2NetworkName: string = (res.l2NetworkName as string).toLowerCase()
  const tokenSymbol: string = (res.tokenSymbol as string).toLowerCase()
  const bonderAddress: string = (res.bonderAddress as string)
  const isL1BridgeDeploy: boolean = res.isL1BridgeDeploy as boolean
  const l2CanonicalTokenIsEth: boolean = res.l2CanonicalTokenIsEth as boolean
  const isEthDeployment: boolean = res.isEthDeployment as boolean
  const deploymentStep: number = res.deploymentStep as number

  return {
    l1NetworkName,
    l2NetworkName,
    tokenSymbol,
    bonderAddress,
    isL1BridgeDeploy,
    l2CanonicalTokenIsEth,
    isEthDeployment,
    deploymentStep
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
  bonderAddress: string,
  l2CanonicalTokenIsEth: boolean,
  isEthDeployment: boolean
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
    liquidityProviderSendAmount
  } = tokens[expectedTokenSymbolLetterCase]

  const liquidityProviderAmmAmount: BigNumber = BigNumber.from(liquidityProviderSendAmount).div(2)

  const data = {
    l1ChainId,
    l2ChainId,
    l1BridgeAddress,
    l1MessengerAddress,
    l2TokenBridgeAddress,
    l2MessengerAddress,
    l1CanonicalTokenAddress,
    l2CanonicalTokenAddress,
    l2HBridgeTokenName,
    l2HBridgeTokenSymbol,
    l2HBridgeTokenDecimals,
    l2SwapLpTokenName,
    l2SwapLpTokenSymbol,
    liquidityProviderSendAmount,
    liquidityProviderAmmAmount: liquidityProviderAmmAmount.toString(),
    bonderAddress,
    l2CanonicalTokenIsEth,
    isEthDeployment
  }

  console.log('data:', data)
  updateConfigFile(data)
}

function handleCustomL2NetworkName(l1NetworkName: string, l2NetworkName: string) {
  if (l2NetworkName === 'optimism' || l2NetworkName === 'arbitrum') {
    if (l1NetworkName === 'mainnet') {
      return `${l2NetworkName}_mainnet`
    } else if (l1NetworkName === 'rinkeby' || l1NetworkName === 'goerli') {
      return `${l2NetworkName}_testnet`
    } else {
      throw new Error('Unknown L1 network name')
    }
  }

  return l2NetworkName
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    logger.error(error)
    process.exit(1)
  })
