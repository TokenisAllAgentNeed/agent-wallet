import type { EvmChainConfig } from '../types.js';

export const baseChain: EvmChainConfig = {
  id: 'base',
  name: 'Base',
  chainId: 8453,
  nativeToken: 'ETH',
  rpcUrl: 'https://base.drpc.org',
  stablecoins: [
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6 },
  ],
};
