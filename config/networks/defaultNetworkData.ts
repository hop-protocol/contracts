import {
  LIQUIDITY_PROVIDER_INITIAL_BALANCE,
  LIQUIDITY_PROVIDER_AMM_AMOUNT,
  LIQUIDITY_PROVIDER_INITIAL_BALANCE_USDC,
  LIQUIDITY_PROVIDER_AMM_AMOUNT_USDC
} from '../constants'

export const DEFAULT_NETWORK_DATA = {
  DAI: {
    l2HBridgeTokenName: 'DAI Hop Token',
    l2HBridgeTokenSymbol: 'hDAI',
    l2HBridgeTokenDecimals: 18,
    l2SwapLpTokenName: 'Hop DAI LP Token',
    l2SwapLpTokenSymbol: 'HOP-LP-DAI',
    liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
    liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
  },
  sETH: {
    l2HBridgeTokenName: 'Synth sETH Hop Token',
    l2HBridgeTokenSymbol: 'hsETH',
    l2HBridgeTokenDecimals: 18,
    l2SwapLpTokenName: 'Hop sETH LP Token',
    l2SwapLpTokenSymbol: 'HOP-LP-sETH',
    liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
    liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
  },
  sBTC: {
    l2HBridgeTokenName: 'Synth sBTC Hop Token',
    l2HBridgeTokenSymbol: 'hsBTC',
    l2HBridgeTokenDecimals: 18,
    l2SwapLpTokenName: 'Hop sBTC LP Token',
    l2SwapLpTokenSymbol: 'HOP-LP-sBTC',
    liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
    liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
  },
  USDC: {
    l2HBridgeTokenName: 'USD Coin Hop Token',
    l2HBridgeTokenSymbol: 'hUSDC',
    l2HBridgeTokenDecimals: 6,
    l2SwapLpTokenName: 'Hop USDC LP Token',
    l2SwapLpTokenSymbol: 'HOP-LP-USDC',
    liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE_USDC.toString(),
    liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT_USDC.toString()
  },
  WBTC: {
    l2HBridgeTokenName: 'Wrapped BTC Hop Token',
    l2HBridgeTokenSymbol: 'hWBTC',
    l2HBridgeTokenDecimals: 18,
    l2SwapLpTokenName: 'Hop WBTC LP Token',
    l2SwapLpTokenSymbol: 'HOP-LP-WBTC',
    liquidityProviderSendAmount: LIQUIDITY_PROVIDER_INITIAL_BALANCE.toString(),
    liquidityProviderAmmAmount: LIQUIDITY_PROVIDER_AMM_AMOUNT.toString()
  }
}
