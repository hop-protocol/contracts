import { BigNumber } from 'ethers'

export type IGetMessengerWrapperDefaults = string | number | undefined
export type IGetL2BridgeDefaults =
  | BigNumber
  | string
  | string[]
  | number
  | boolean
  | undefined
