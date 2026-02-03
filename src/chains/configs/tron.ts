import type { TronChainConfig } from '../tron.js';

export const tronConfig: TronChainConfig = {
  id: 'tron',
  family: 'tron',
  name: 'Tron',
  nativeToken: 'TRX',
  rpcUrl: 'https://api.trongrid.io',
  stablecoins: [
    {
      symbol: 'USDT',
      address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // TRC20 USDT
      decimals: 6,
    },
    {
      symbol: 'USDC',
      address: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', // TRC20 USDC
      decimals: 6,
    },
  ],
};
