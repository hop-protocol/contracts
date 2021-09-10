require('dotenv').config()
import { BigNumber } from 'ethers'
import prompt from 'prompt'

import {
  getAddBonderMessage,
  getRemoveBonderMessage,
  getSetL1GovernanceMessage,
  getSetAmmWrapperMessage,
  getSetL1BridgeConnectorMessage,
  getSetL1CallerMessage,
  getAddActiveChainIdsMessage,
  getRemoveActiveChainIdsMessage,
  getSetMinimumForceCommitDelayMessage,
  getSetMaxPendingTransfersMessage,
  getSetHopBridgeTokenOwnerMessage,
  getSetMinimumBonderFeeRequirementsMessage,
  getSetMessengerMessage,
  getSetDefaultGasLimitUint256Message,
  getSetDefaultGasLimitUint32Message,
  getSetMessengerProxyMessage
} from '../../test/shared/contractFunctionWrappers'

const FUNCTIONS = {
  ADD_BONDER: 'addBonder',
  REMOVE_BONDER: 'removeBonder',
  SET_L1_GOVERNANCE: 'setL1Governance',
  SET_AMM_WRAPPER: 'setAmmWrapper',
  SET_L1_BRIDGE_ADDRESS: 'setL1BridgeConnector',
  SET_L1_BRIDGE_CALLER: 'setL1Caller',
  ADD_ACTIVE_CHAIN_IDS: 'addActiveChainIds',
  REMOVE_ACTIVE_CHAIN_IDS: 'removeActiveChainIds',
  SET_MINIMUM_FORCE_COMMIT_DELAY: 'setMinimumForceCommitDelay',
  SET_MAX_PENDING_TRANSFERS: 'setMaxPendingTransfers',
  SET_HOP_BRIDGE_TOKEN_OWNER: 'setHopBridgeTokenOwner',
  SET_MINIMUM_BONDER_FEE_REQUIREMENTS: 'setMinimumBonderFeeRequirements',
  SET_MESSENGER: 'setMessenger',
  SET_DEFAULT_GAS_LIMIT_256: 'setDefaultGasLimit256',
  SET_DEFAULT_GAS_LIMIT_32: 'setDefaultGasLimit32',
  SET_MESSENGER_PROXY: 'setMessengerProxy'
}

async function main () {
  let functionToCall: string
  let input: any

  ;({
    functionToCall,
    input
  } = await getPromptRes())

  const messageToSend: string = getMessageToSend(functionToCall, input)

  console.log('------------')
  console.log('Message data:', messageToSend)
  console.log('See executeCanonicalMessengerSendMessage() for additional params')
  console.log('Address to call is the `l1_messenger` on all networks except Polygon/Mumbai where it is `l1_messengerWrapper`')
  console.log('Polygon is the L1 Messenger Wrapper')
  console.log('xDai messenger is labeled l1Amb in the addresses package')
  console.log('Optimism messenger is the Proxy__OVM_L1CrossDomainMessenger in their addresses repository')
  console.log('Arbitrum messenger is their inbox')

  console.log('------------')
  console.log('Mainnet Values')
  console.log('Poly: <messenger wrapper>, sendCrossDomainMessage(data)')
  console.log('xDai: 0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e, requireToPassMessage(l2Bridge, data, 1500000)')
  console.log('Opt: 0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1, sendMessage(l2Bridge, data, 5000000)')
  console.log('Arb: 0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f, createRetryableTicket(see executeCanonicalMessengerSendMessage for params)')
}

const getPromptRes = async() => {
  prompt.start()
  prompt.message = ''
  prompt.delimiter = ''

  const res = await prompt.get([{
    name: 'functionToCall',
    type: 'string',
    required: true,
  }, {
    name: 'input',
    type: 'any',
    required: true
  }])

  const functionToCall: string = (res.functionToCall as string)
  const input: any = res.input

  return {
    functionToCall,
    input
  }
}

const getMessageToSend = (
  functionToCall: string,
  input: any
): string => {
  functionToCall = functionToCall.toLowerCase()
  switch(functionToCall) {
    case FUNCTIONS.ADD_BONDER.toLowerCase(): {
      return getAddBonderMessage(input)
    } 
    case FUNCTIONS.REMOVE_BONDER.toLowerCase(): {
      return getRemoveBonderMessage(input)
    } 
    case FUNCTIONS.SET_L1_GOVERNANCE.toLowerCase(): {
      return getSetL1GovernanceMessage(input)
    } 
    case FUNCTIONS.SET_AMM_WRAPPER.toLowerCase(): {
      return getSetAmmWrapperMessage(input)
    } 
    case FUNCTIONS.SET_L1_BRIDGE_ADDRESS.toLowerCase(): {
      return getSetL1BridgeConnectorMessage(input)
    } 
    case FUNCTIONS.SET_L1_BRIDGE_CALLER.toLowerCase(): {
      return getSetL1CallerMessage(input)
    } 
    case FUNCTIONS.ADD_ACTIVE_CHAIN_IDS.toLowerCase(): {
      return getAddActiveChainIdsMessage([BigNumber.from(input)])
    } 
    case FUNCTIONS.REMOVE_ACTIVE_CHAIN_IDS.toLowerCase(): {
      return getRemoveActiveChainIdsMessage([BigNumber.from(input)])
    } 
    case FUNCTIONS.SET_MINIMUM_FORCE_COMMIT_DELAY.toLowerCase(): {
      return getSetMinimumForceCommitDelayMessage(input)
    } 
    case FUNCTIONS.SET_MAX_PENDING_TRANSFERS.toLowerCase(): {
      return getSetMaxPendingTransfersMessage(input)
    } 
    case FUNCTIONS.SET_HOP_BRIDGE_TOKEN_OWNER.toLowerCase(): {
      return getSetHopBridgeTokenOwnerMessage(input)
    } 
    case FUNCTIONS.SET_MINIMUM_BONDER_FEE_REQUIREMENTS.toLowerCase(): {
      throw new Error('This function requires two inputs. Please manually enter the second input.')
      const firstInput: BigNumber = BigNumber.from(input)
      const secondInput: BigNumber = BigNumber.from('0')
      return getSetMinimumBonderFeeRequirementsMessage(firstInput, secondInput)
    } 
    case FUNCTIONS.SET_MESSENGER.toLowerCase(): {
      return getSetMessengerMessage(input)
    } 
    case FUNCTIONS.SET_DEFAULT_GAS_LIMIT_256.toLowerCase(): {
      return getSetDefaultGasLimitUint256Message(input)
    } 
    case FUNCTIONS.SET_DEFAULT_GAS_LIMIT_32.toLowerCase(): {
      return getSetDefaultGasLimitUint32Message(input)
    } 
    case FUNCTIONS.SET_MESSENGER_PROXY.toLowerCase(): {
      return getSetMessengerProxyMessage(input)
    } 
    default: {
      throw new Error('Unknown function')
    }
  }
}

main()
  .catch(error => {
    console.error(error)
  })
  .finally(() => process.exit(0))
