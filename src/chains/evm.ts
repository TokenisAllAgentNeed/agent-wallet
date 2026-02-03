/**
 * EVM chain adapter implementation using viem.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
  type Chain,
  type Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { ChainAdapter, ChainWallet, EvmChainConfig } from './types.js';
import { toChainInfo } from './types.js';
import type { ChainInfo, StablecoinInfo } from '../types.js';
import { withRetry } from '../utils/retry.js';
import { EVM_FALLBACK_GAS_ESTIMATE } from '../constants.js';

const erc20Abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

/** Build a viem Chain object from our config */
function toViemChain(config: EvmChainConfig): Chain {
  return {
    id: config.chainId,
    name: config.name,
    nativeCurrency: {
      name: config.nativeToken,
      symbol: config.nativeToken,
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [config.rpcUrl] },
    },
  } as Chain;
}

/** EVM wallet implementation */
class EvmWallet implements ChainWallet {
  readonly address: string;
  private readonly account: Account;
  private readonly config: EvmChainConfig;
  private readonly stablecoinMap: Map<string, StablecoinInfo>;

  constructor(privateKey: `0x${string}`, config: EvmChainConfig) {
    this.config = config;
    this.account = privateKeyToAccount(privateKey);
    this.address = this.account.address;
    this.stablecoinMap = new Map(
      config.stablecoins.map((s) => [s.symbol.toUpperCase(), s])
    );
  }

  private getClient() {
    const chain = toViemChain(this.config);
    const transport = http(this.config.rpcUrl);
    return createPublicClient({ chain, transport });
  }

  private getWalletClient() {
    const chain = toViemChain(this.config);
    const transport = http(this.config.rpcUrl);
    return createWalletClient({
      account: this.account,
      chain,
      transport,
    });
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
    const client = this.getClient();
    return withRetry(() =>
      client.readContract({
        address: info.address as Address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [this.address as Address],
      }) as Promise<bigint>
    );
  }

  async getNativeBalance(): Promise<bigint> {
    const client = this.getClient();
    return withRetry(() =>
      client.getBalance({
        address: this.address as Address,
      })
    );
  }

  async send(to: string, token: string, amount: bigint): Promise<string> {
    const info = this.getStablecoin(token);
    const walletClient = this.getWalletClient();
    const hash = await walletClient.writeContract({
      address: info.address as Address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to as Address, amount],
      account: this.account,
      chain: toViemChain(this.config),
    });
    return hash;
  }

  async estimateGas(to: string, token: string, amount: bigint): Promise<bigint> {
    const info = this.getStablecoin(token);
    const client = this.getClient();
    try {
      const gas = await withRetry(() =>
        client.estimateContractGas({
          address: info.address as Address,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [to as Address, amount],
          account: this.account,
        })
      );
      const gasPrice = await withRetry(() => client.getGasPrice());
      return gas * gasPrice;
    } catch {
      // Tier 2 fallback: try getGasPrice with 100k gas units
      try {
        const gasPrice = await withRetry(() => client.getGasPrice());
        return 100_000n * gasPrice;
      } catch {
        return EVM_FALLBACK_GAS_ESTIMATE;
      }
    }
  }
}

/** EVM chain adapter */
export class EvmAdapter implements ChainAdapter {
  readonly chain: ChainInfo;
  readonly config: EvmChainConfig;

  constructor(config: EvmChainConfig) {
    this.config = config;
    this.chain = toChainInfo(config);
  }

  createWallet(privateKey: `0x${string}`): ChainWallet {
    return new EvmWallet(privateKey, this.config);
  }
}
