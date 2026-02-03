/**
 * Chain adapter types for agent-wallet.
 */

import type { ChainInfo, StablecoinInfo } from '../types.js';

/** Base chain configuration (shared fields) */
export interface BaseChainConfig {
  /** Chain identifier matching ChainInfo.id */
  id: string;
  /** Human-readable name */
  name: string;
  /** Native token symbol */
  nativeToken: string;
  /** Default public RPC URL */
  rpcUrl: string;
  /** Supported stablecoins */
  stablecoins: StablecoinInfo[];
}

/** EVM chain configuration */
export interface EvmChainConfig extends BaseChainConfig {
  /** EVM numeric chain ID */
  chainId: number;
}

/** Convert EvmChainConfig to ChainInfo */
export function toChainInfo(config: EvmChainConfig): ChainInfo {
  return {
    id: config.id,
    family: 'evm',
    name: config.name,
    nativeToken: config.nativeToken,
    stablecoins: config.stablecoins,
  };
}

/** Internal wallet handle for chain operations */
export interface ChainWallet {
  readonly address: string;
  getBalance(token: string): Promise<bigint>;
  getNativeBalance(): Promise<bigint>;
  send(to: string, token: string, amount: bigint): Promise<string>;
  estimateGas(to: string, token: string, amount: bigint): Promise<bigint>;
}

/** Chain adapter interface */
export interface ChainAdapter {
  readonly chain: ChainInfo;
  readonly config: BaseChainConfig;
  createWallet(privateKey: `0x${string}` | string): ChainWallet;
}
