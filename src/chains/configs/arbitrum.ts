import type { EvmChainConfig } from '../types.js';

export const arbitrumChain: EvmChainConfig = {
  id: 'arbitrum',
  name: 'Arbitrum One',
  chainId: 42161,
  nativeToken: 'ETH',
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  stablecoins: [
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
  ],
};
