/**
 * agent-wallet - AI-first multi-chain wallet library
 */

export { AgentWallet } from './wallet.js';
export type { LightningOptions, AgentWalletOptions, ExtendedBalances } from './wallet.js';

// Types
export type {
  ChainFamily,
  ChainInfo,
  StablecoinInfo,
  WalletData,
  SendParams,
  CheckResult,
  SendResult,
  AggregatedBalances,
  BalanceResult,
  ChainBalance,
  LightningBalance,
} from './types.js';

// Chain utilities
export { getChain, listChains, getChainIds } from './chains/index.js';
export type { ChainAdapter, ChainWallet, EvmChainConfig } from './chains/index.js';
export { toChainInfo } from './chains/types.js';

// Chain configs (for consumers that need raw configs)
export {
  ethereumChain,
  baseChain,
  arbitrumChain,
  bnbChain,
  tronConfig,
} from './chains/configs/index.js';

// Lightning utilities
export { createLightningWallet, PhoenixdClient } from './chains/index.js';
export type { LightningConfig, LightningWallet, PhoenixdConfig } from './chains/index.js';

// Format utilities
export { toBaseUnits, fromBaseUnits, formatNativeBalance } from './utils/format.js';

// Cashu eCash utilities
export {
  detectTokenVersion,
  extractCborStructure,
  type DecodeDiagnostics,
} from './cashu/index.js';
