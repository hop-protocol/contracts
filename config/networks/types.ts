export type NetworkData = {
  [key: string]: NetworkDetails
}

type NetworkDetails = {
  l2NetworkName: string
  l1ChainId: string
  l2ChainId: string
  l1MessengerAddress: string
  l2TokenBridgeAddress: string
  l2MessengerAddress: string
  tokens: Tokens
}

type Tokens = {
  [key: string]: TokenDetails
}

type TokenDetails = {
  l1CanonicalTokenAddress: string
  l2CanonicalTokenAddress: string
  l2HBridgeTokenName: string
  l2HBridgeTokenSymbol: string
  l2HBridgeTokenDecimals: number
  l2SwapLpTokenName: string
  l2SwapLpTokenSymbol: string
  liquidityProviderSendAmount: string
}