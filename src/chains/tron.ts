/**
 * Tron chain adapter implementation using TronWeb.
 */

import { TronWeb } from 'tronweb';
import type { ChainAdapter, ChainWallet, BaseChainConfig } from './types.js';
import type { ChainInfo, StablecoinInfo } from '../types.js';
import { withRetry } from '../utils/retry.js';
import { TRON_GAS_ESTIMATE } from '../constants.js';

/** Tron chain configuration */
export interface TronChainConfig extends BaseChainConfig {
  /** Chain family */
  family: 'tron';
}

/** TRC20 ABI for balance and transfer */
const trc20Abi = [
  {
    constant: true,
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
];

/** Tron wallet implementation */
class TronWallet implements ChainWallet {
  readonly address: string;
  private readonly tronWeb: TronWeb;
  private readonly config: TronChainConfig;
  private readonly stablecoinMap: Map<string, StablecoinInfo>;

  constructor(privateKey: string, config: TronChainConfig) {
    this.config = config;
    
    // Remove 0x prefix if present
    const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    
    // Create TronWeb instance
    this.tronWeb = new TronWeb({
      fullHost: config.rpcUrl,
      privateKey: cleanKey,
    });

    // Get address from private key
    const address = this.tronWeb.address.fromPrivateKey(cleanKey);
    if (!address) {
      throw new Error('Invalid private key: could not derive Tron address');
    }
    this.address = address;
    
    this.stablecoinMap = new Map(
      config.stablecoins.map((s) => [s.symbol.toUpperCase(), s])
    );
  }

  private getStablecoin(token: string): StablecoinInfo {
    const info = this.stablecoinMap.get(token.toUpperCase());
    if (!info) {
      throw new Error(`Token ${token} not supported on ${this.config.name}`);
    }
    return info;
  }

  async getBalance(token: string): Promise<bigint> {
    const info = this.getStablecoin(token);

    try {
      return await withRetry(async () => {
        const contract = await this.tronWeb.contract(trc20Abi, info.address);
        const balance = await contract.methods.balanceOf(this.address).call();
        return BigInt(balance.toString());
      });
    } catch {
      // Return 0 if all retries fail
      return 0n;
    }
  }

  async getNativeBalance(): Promise<bigint> {
    try {
      return await withRetry(async () => {
        const balance = await this.tronWeb.trx.getBalance(this.address);
        return BigInt(balance);
      });
    } catch {
      return 0n;
    }
  }

  async send(to: string, token: string, amount: bigint): Promise<string> {
    const info = this.getStablecoin(token);
    
    const contract = await this.tronWeb.contract(trc20Abi, info.address);
    const result = await contract.methods.transfer(to, amount.toString()).send();
    
    // TronWeb returns transaction result with txid
    return result.txid || result;
  }

  async estimateGas(_to: string, _token: string, _amount: bigint): Promise<bigint> {
    return TRON_GAS_ESTIMATE;
  }
}

/** Tron chain adapter */
export class TronAdapter implements ChainAdapter {
  readonly chain: ChainInfo;
  readonly config: TronChainConfig;

  constructor(config: TronChainConfig) {
    this.config = config;
    this.chain = {
      id: config.id,
      family: config.family,
      name: config.name,
      nativeToken: config.nativeToken,
      stablecoins: config.stablecoins,
    };
  }

  createWallet(privateKey: `0x${string}` | string): ChainWallet {
    return new TronWallet(privateKey, this.config);
  }
}
