/**
 * AgentWallet - AI-first multi-chain wallet.
 */

import { HDKey } from 'viem/accounts';
import { getChain, getChainIds, type ChainWallet, createLightningWallet, type LightningWallet } from './chains/index.js';
import { toBaseUnits, fromBaseUnits, formatNativeBalance, formatGasEstimate } from './utils/format.js';
import { isValidAddress } from './utils/address.js';
import type {
  WalletData,
  SendParams,
  CheckResult,
  SendResult,
  AggregatedBalances,
  BalanceResult,
  LightningBalance,
} from './types.js';
import { EVM_FALLBACK_GAS_ESTIMATE } from './constants.js';

/** Lightning configuration for AgentWallet */
export interface LightningOptions {
  nodeUrl: string;
  nodePassword?: string;
  nodeType: 'phoenixd' | 'lnd' | 'cln';
}

/** Options for creating an AgentWallet */
export interface AgentWalletOptions {
  lightning?: LightningOptions;
}

/** Extended balances including Lightning */
export interface ExtendedBalances extends AggregatedBalances {
  lightning?: LightningBalance;
}

export class AgentWallet {
  readonly address: string;
  private readonly privateKey: `0x${string}`;
  private readonly walletCache: Map<string, ChainWallet> = new Map();
  private readonly _lightning?: LightningWallet;

  private constructor(privateKey: `0x${string}`, address: string, options?: AgentWalletOptions) {
    this.privateKey = privateKey;
    this.address = address;
    
    // Initialize Lightning wallet if configured
    if (options?.lightning) {
      this._lightning = createLightningWallet({
        id: 'lightning',
        family: 'lightning',
        name: 'Lightning Network',
        nativeToken: 'SAT',
        nodeUrl: options.lightning.nodeUrl,
        nodePassword: options.lightning.nodePassword,
        nodeType: options.lightning.nodeType,
      });
    }
  }

  /**
   * Access the Lightning wallet (if configured).
   * Throws if Lightning was not configured.
   */
  get lightning(): LightningWallet {
    if (!this._lightning) {
      throw new Error('Lightning not configured. Pass lightning config to fromSeed() or fromPrivateKey().');
    }
    return this._lightning;
  }

  /**
   * Check if Lightning is configured.
   */
  get hasLightning(): boolean {
    return this._lightning !== undefined;
  }

  /**
   * Validate that the Lightning node is reachable and responding.
   * Returns false if Lightning is not configured or node is unreachable.
   */
  async validateLightning(): Promise<boolean> {
    if (!this._lightning) return false;
    return this._lightning.validateConnection();
  }

  /**
   * Create a wallet from a seed (uses BIP-44 derivation).
   */
  static fromSeed(seed: Uint8Array, options?: AgentWalletOptions): AgentWallet {
    const hdKey = HDKey.fromMasterSeed(seed);
    // BIP-44: m/44'/60'/0'/0/0
    const derived = hdKey.derive(`m/44'/60'/0'/0/0`);
    const privateKey = `0x${Buffer.from(derived.privateKey!).toString('hex')}` as `0x${string}`;
    
    // Derive address from private key
    const wallet = getChain('base').createWallet(privateKey);
    return new AgentWallet(privateKey, wallet.address, options);
  }

  /**
   * Create a wallet from an existing private key.
   */
  static fromPrivateKey(key: string, options?: AgentWalletOptions): AgentWallet {
    const privateKey = key.startsWith('0x') ? key as `0x${string}` : `0x${key}` as `0x${string}`;
    const wallet = getChain('base').createWallet(privateKey);
    return new AgentWallet(privateKey, wallet.address, options);
  }

  /**
   * Get wallet for a specific chain.
   */
  private getChainWallet(chainId: string): ChainWallet {
    let wallet = this.walletCache.get(chainId);
    if (!wallet) {
      wallet = getChain(chainId).createWallet(this.privateKey);
      this.walletCache.set(chainId, wallet);
    }
    return wallet;
  }

  /**
   * Get token decimals for a chain/token pair.
   */
  private getDecimals(chainId: string, token: string): number {
    const chain = getChain(chainId);
    const stablecoin = chain.config.stablecoins.find(
      (s) => s.symbol.toUpperCase() === token.toUpperCase()
    );
    if (!stablecoin) {
      throw new Error(`Token ${token} not supported on ${chain.chain.name}`);
    }
    return stablecoin.decimals;
  }

  /**
   * Get aggregated balances across all chains (including Lightning if configured).
   */
  async getBalances(): Promise<ExtendedBalances> {
    const chainIds = getChainIds();
    const byChain: AggregatedBalances['byChain'] = {};
    let totalUsd = 0;

    // Fetch chain balances
    await Promise.all(
      chainIds.map(async (chainId) => {
        const chain = getChain(chainId);
        const wallet = this.getChainWallet(chainId);
        const chainBalance: Record<string, string> = {};

        await Promise.all(
          chain.config.stablecoins.map(async (stablecoin) => {
            try {
              const balance = await wallet.getBalance(stablecoin.symbol);
              const formatted = fromBaseUnits(balance, stablecoin.decimals);
              chainBalance[stablecoin.symbol] = formatted;
              totalUsd += parseFloat(formatted);
            } catch {
              chainBalance[stablecoin.symbol] = '0.00';
            }
          })
        );

        byChain[chainId] = chainBalance;
      })
    );

    // Build result
    const formattedTotal = totalUsd.toFixed(2);
    const chainCount = chainIds.length + (this._lightning ? 1 : 0);
    const result: ExtendedBalances = {
      total: {
        usd: formattedTotal,
        humanReadable: `You have $${formattedTotal} across ${chainCount} chains`,
      },
      byChain,
    };

    // Include Lightning balance if configured
    if (this._lightning) {
      try {
        const satBalance = await this._lightning.getBalance();
        const satStr = satBalance.toString();
        const formatted = Number(satBalance).toLocaleString();
        result.lightning = {
          SAT: satStr,
          humanReadable: `${formatted} sats`,
        };
      } catch {
        result.lightning = {
          SAT: '0',
          humanReadable: '0 sats (error fetching)',
        };
      }
    }

    return result;
  }

  /**
   * Get balance for a specific chain and token.
   */
  async getBalance(chain: string, token: string): Promise<BalanceResult> {
    const wallet = this.getChainWallet(chain);
    const decimals = this.getDecimals(chain, token);
    const balance = await wallet.getBalance(token);
    const formatted = fromBaseUnits(balance, decimals);
    
    return {
      balance: formatted,
      humanReadable: `${formatted} ${token} on ${getChain(chain).chain.name}`,
    };
  }

  /**
   * Check if a send is possible (dry run).
   */
  async checkSend(params: SendParams): Promise<CheckResult> {
    const { chain, token, to, amount } = params;
    const chainInfo = getChain(chain);
    
    // Validate address format first
    const family = chainInfo.chain.family as 'evm' | 'tron';
    if (!isValidAddress(to, family)) {
      return {
        canSend: false,
        balance: '0.00',
        gasBalance: '0.00',
        estimatedGas: '0.00',
        reason: 'invalid_address',
        humanReadable: `Invalid address: ${to || '(empty)'}`,
      };
    }

    const wallet = this.getChainWallet(chain);
    const decimals = this.getDecimals(chain, token);
    const amountBase = toBaseUnits(amount, decimals);

    // Get balances
    const [tokenBalance, nativeBalance] = await Promise.all([
      wallet.getBalance(token),
      wallet.getNativeBalance(),
    ]);

    const tokenFormatted = fromBaseUnits(tokenBalance, decimals);
    const nativeSymbol = chainInfo.config.nativeToken;
    const gasFormatted = formatNativeBalance(nativeBalance, nativeSymbol);

    // Estimate gas
    let estimatedGas: bigint;
    try {
      estimatedGas = await wallet.estimateGas(to, token, amountBase);
    } catch {
      estimatedGas = EVM_FALLBACK_GAS_ESTIMATE;
    }
    const gasEstimateFormatted = formatGasEstimate(estimatedGas, nativeSymbol);

    // Check conditions
    if (tokenBalance < amountBase) {
      return {
        canSend: false,
        balance: tokenFormatted,
        gasBalance: gasFormatted,
        estimatedGas: gasEstimateFormatted,
        reason: 'insufficient_balance',
        humanReadable: `Cannot send: need ${amount} ${token}, but you only have ${tokenFormatted}`,
      };
    }

    if (nativeBalance < estimatedGas) {
      return {
        canSend: false,
        balance: tokenFormatted,
        gasBalance: gasFormatted,
        estimatedGas: gasEstimateFormatted,
        reason: 'insufficient_gas',
        humanReadable: `Cannot send: need ${gasEstimateFormatted} for gas, but you only have ${gasFormatted}`,
      };
    }

    return {
      canSend: true,
      balance: tokenFormatted,
      gasBalance: gasFormatted,
      estimatedGas: gasEstimateFormatted,
      humanReadable: `OK to send. You have ${tokenFormatted} ${token} and enough gas.`,
    };
  }

  /**
   * Send tokens.
   */
  async send(params: SendParams): Promise<SendResult> {
    const { chain, token, to, amount } = params;
    const chainInfo = getChain(chain);
    
    // Validate address format first
    const family = chainInfo.chain.family as 'evm' | 'tron';
    if (!isValidAddress(to, family)) {
      return {
        success: false,
        error: 'invalid_address',
        humanReadable: `Invalid address: ${to || '(empty)'}`,
      };
    }

    const wallet = this.getChainWallet(chain);
    const decimals = this.getDecimals(chain, token);
    const amountBase = toBaseUnits(amount, decimals);

    try {
      const txHash = await wallet.send(to, token, amountBase);
      return {
        success: true,
        txHash,
        humanReadable: `Sent ${amount} ${token} to ${to} on ${getChain(chain).chain.name}. Tx: ${txHash}`,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error,
        humanReadable: `Failed to send: ${error}`,
      };
    }
  }

  /**
   * Export wallet data for persistence.
   */
  export(): WalletData {
    return {
      privateKey: this.privateKey,
      address: this.address,
    };
  }
}
