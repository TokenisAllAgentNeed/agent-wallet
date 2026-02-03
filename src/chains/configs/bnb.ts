import type { EvmChainConfig } from '../types.js';

export const bnbChain: EvmChainConfig = {
  id: 'bnb',
  name: 'BNB Chain',
  chainId: 56,
  nativeToken: 'BNB',
  rpcUrl: 'https://bsc-dataseed.binance.org',
  stablecoins: [
    { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
    { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  ],
};
