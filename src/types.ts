/**
 * Core types for agent-wallet.
 */

/** Chain family identifier */
export type ChainFamily = 'evm' | 'tron' | 'lightning';

/** Chain descriptor */
export interface ChainInfo {
  /** Unique chain identifier, e.g. "ethereum", "base" */
  id: string;
  /** Chain family */
  family: ChainFamily;
  /** Human-readable name */
  name: string;
  /** Native token symbol, e.g. "ETH", "BNB" */
  nativeToken: string;
  /** Supported stablecoins on this chain */
  stablecoins: StablecoinInfo[];
}

/** Stablecoin descriptor */
export interface StablecoinInfo {
  /** Token symbol, e.g. "USDC", "USDT" */
  symbol: string;
  /** Contract address */
  address: string;
  /** Token decimals (typically 6 for USDC/USDT) */
  decimals: number;
}

/** Serializable wallet data for persistence */
export interface WalletData {
  /** Private key (hex string with 0x prefix for EVM) */
  privateKey: string;
  /** Wallet address */
  address: string;
}

/** Parameters for sending tokens */
export interface SendParams {
  /** Chain identifier */
  chain: string;
  /** Token symbol, e.g. "USDC" */
  token: string;
  /** Recipient address */
  to: string;
  /** Amount in human-readable format (e.g. "10.00", not wei) */
  amount: string;
}

/** Result of checkSend */
export interface CheckResult {
  /** Whether the send can proceed */
  canSend: boolean;
  /** Token balance in human-readable format */
  balance: string;
  /** Native token balance for gas */
  gasBalance: string;
  /** Estimated gas cost */
  estimatedGas: string;
  /** Reason if canSend is false */
  reason?: 'insufficient_balance' | 'insufficient_gas' | 'invalid_address';
  /** Human-readable summary */
  humanReadable: string;
}

/** Result of send */
export interface SendResult {
  /** Whether the send succeeded */
  success: boolean;
  /** Transaction hash */
  txHash?: string;
  /** Error message if failed */
  error?: string;
  /** Human-readable summary */
  humanReadable: string;
}

/** Balance for a single chain */
export interface ChainBalance {
  [token: string]: string;
}

/** Aggregated balances across all chains */
export interface AggregatedBalances {
  /** Total value */
  total: {
    usd: string;
    humanReadable: string;
  };
  /** Balances by chain */
  byChain: {
    [chainId: string]: ChainBalance;
  };
}

/** Single balance result */
export interface BalanceResult {
  /** Balance in human-readable format */
  balance: string;
  /** Human-readable summary */
  humanReadable: string;
}

/** Lightning balance result */
export interface LightningBalance {
  /** Balance in satoshis as string */
  SAT: string;
  /** Human-readable balance */
  humanReadable: string;
}
