/**
 * Chain registry - manages chain adapters.
 */

import type { ChainInfo } from '../types.js';
import type { ChainAdapter } from './types.js';
import { EvmAdapter } from './evm.js';
import { TronAdapter } from './tron.js';
import { baseChain, ethereumChain, arbitrumChain, bnbChain, tronConfig } from './configs/index.js';

// Pre-registered chains
const adapters = new Map<string, ChainAdapter>();

// Register default EVM chains
const evmChains = [baseChain, ethereumChain, arbitrumChain, bnbChain];
for (const config of evmChains) {
  adapters.set(config.id, new EvmAdapter(config));
}

// Register Tron chain
adapters.set(tronConfig.id, new TronAdapter(tronConfig));

/** Get an adapter by chain id; throws if not registered */
export function getChain(chainId: string): ChainAdapter {
  const adapter = adapters.get(chainId);
  if (!adapter) throw new Error(`Chain not supported: ${chainId}`);
  return adapter;
}

/** List all registered chain infos */
export function listChains(): ChainInfo[] {
  return [...adapters.values()].map((a) => a.chain);
}

/** Get all chain IDs */
export function getChainIds(): string[] {
  return [...adapters.keys()];
}

// Re-export types
export type { ChainAdapter, ChainWallet, EvmChainConfig } from './types.js';
export { toChainInfo } from './types.js';

// Re-export Lightning (special - not a ChainAdapter)
export { createLightningWallet, PhoenixdClient } from './lightning.js';
export type { LightningConfig, LightningWallet, PhoenixdConfig } from './lightning.js';
