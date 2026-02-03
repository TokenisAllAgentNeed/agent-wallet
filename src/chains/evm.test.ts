/**
 * Unit tests for chains/evm.ts — EvmAdapter and EvmWallet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvmAdapter } from './evm.js';
import type { EvmChainConfig } from './types.js';
import { EVM_FALLBACK_GAS_ESTIMATE } from '../constants.js';

// ── Mock viem ──────────────────────────────────────────────────

const mockReadContract = vi.fn();
const mockGetBalance = vi.fn();
const mockEstimateContractGas = vi.fn();
const mockGetGasPrice = vi.fn();
const mockWriteContract = vi.fn();

vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    readContract: mockReadContract,
    getBalance: mockGetBalance,
    estimateContractGas: mockEstimateContractGas,
    getGasPrice: mockGetGasPrice,
  })),
  createWalletClient: vi.fn(() => ({
    writeContract: mockWriteContract,
  })),
  http: vi.fn((url: string) => ({ type: 'http', url })),
  parseAbi: vi.fn((abi: string[]) => abi),
}));

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn((key: string) => ({
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38',
    type: 'local' as const,
  })),
}));

// ── Test config ──────────────────────────────────────────────

const testConfig: EvmChainConfig = {
  id: 'test-chain',
  name: 'Test Chain',
  nativeToken: 'ETH',
  rpcUrl: 'https://rpc.test.local',
  chainId: 1,
  stablecoins: [
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  ],
};

const TEST_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`;

// ── Tests ────────────────────────────────────────────────────

describe('EvmAdapter', () => {
  let adapter: EvmAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new EvmAdapter(testConfig);
  });

  describe('chain info', () => {
    it('has correct chain metadata', () => {
      expect(adapter.chain.id).toBe('test-chain');
      expect(adapter.chain.family).toBe('evm');
      expect(adapter.chain.name).toBe('Test Chain');
      expect(adapter.chain.nativeToken).toBe('ETH');
    });

    it('has correct stablecoins', () => {
      const symbols = adapter.chain.stablecoins.map((s) => s.symbol);
      expect(symbols).toContain('USDC');
      expect(symbols).toContain('USDT');
    });

    it('stores config', () => {
      expect(adapter.config.chainId).toBe(1);
      expect(adapter.config.rpcUrl).toBe('https://rpc.test.local');
    });
  });

  describe('createWallet', () => {
    it('creates wallet with correct address', () => {
      const wallet = adapter.createWallet(TEST_KEY);
      expect(wallet.address).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38');
    });
  });
});

describe('EvmWallet', () => {
  let adapter: EvmAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new EvmAdapter(testConfig);
  });

  describe('getBalance', () => {
    it('returns token balance', async () => {
      mockReadContract.mockResolvedValue(1_000_000n);
      const wallet = adapter.createWallet(TEST_KEY);
      const balance = await wallet.getBalance('USDC');
      expect(balance).toBe(1_000_000n);
      expect(mockReadContract).toHaveBeenCalledTimes(1);
    });

    it('is case-insensitive for token symbol', async () => {
      mockReadContract.mockResolvedValue(500_000n);
      const wallet = adapter.createWallet(TEST_KEY);
      const balance = await wallet.getBalance('usdc');
      expect(balance).toBe(500_000n);
    });

    it('throws for unsupported token', async () => {
      const wallet = adapter.createWallet(TEST_KEY);
      await expect(wallet.getBalance('DAI')).rejects.toThrow('not supported');
    });
  });

  describe('getNativeBalance', () => {
    it('returns native balance', async () => {
      mockGetBalance.mockResolvedValue(1_000_000_000_000_000_000n);
      const wallet = adapter.createWallet(TEST_KEY);
      const balance = await wallet.getNativeBalance();
      expect(balance).toBe(1_000_000_000_000_000_000n);
    });
  });

  describe('send', () => {
    it('sends tokens and returns hash', async () => {
      mockWriteContract.mockResolvedValue('0xabcdef1234567890');
      const wallet = adapter.createWallet(TEST_KEY);
      const hash = await wallet.send('0x1111111111111111111111111111111111111111', 'USDC', 1_000_000n);
      expect(hash).toBe('0xabcdef1234567890');
      expect(mockWriteContract).toHaveBeenCalledTimes(1);
    });

    it('throws for unsupported token', async () => {
      const wallet = adapter.createWallet(TEST_KEY);
      await expect(
        wallet.send('0x1111111111111111111111111111111111111111', 'DAI', 1_000_000n)
      ).rejects.toThrow('not supported');
    });

    it('propagates writeContract error', async () => {
      mockWriteContract.mockRejectedValue(new Error('insufficient gas'));
      const wallet = adapter.createWallet(TEST_KEY);
      await expect(
        wallet.send('0x1111111111111111111111111111111111111111', 'USDC', 1_000_000n)
      ).rejects.toThrow('insufficient gas');
    });
  });

  describe('estimateGas', () => {
    it('returns gas * gasPrice on success', async () => {
      mockEstimateContractGas.mockResolvedValue(65_000n);
      mockGetGasPrice.mockResolvedValue(30_000_000_000n);
      const wallet = adapter.createWallet(TEST_KEY);
      const estimate = await wallet.estimateGas(
        '0x1111111111111111111111111111111111111111', 'USDC', 1_000_000n
      );
      expect(estimate).toBe(65_000n * 30_000_000_000n);
    });

    it('falls back to 100k * gasPrice when estimateContractGas fails', async () => {
      mockEstimateContractGas.mockRejectedValue(new Error('estimation failed'));
      mockGetGasPrice.mockResolvedValue(20_000_000_000n);
      const wallet = adapter.createWallet(TEST_KEY);
      const estimate = await wallet.estimateGas(
        '0x1111111111111111111111111111111111111111', 'USDC', 1_000_000n
      );
      expect(estimate).toBe(100_000n * 20_000_000_000n);
    });

    it('falls back to EVM_FALLBACK_GAS_ESTIMATE when all RPC fails', async () => {
      mockEstimateContractGas.mockRejectedValue(new Error('rpc down'));
      mockGetGasPrice.mockRejectedValue(new Error('rpc down'));
      const wallet = adapter.createWallet(TEST_KEY);
      const estimate = await wallet.estimateGas(
        '0x1111111111111111111111111111111111111111', 'USDC', 1_000_000n
      );
      expect(estimate).toBe(EVM_FALLBACK_GAS_ESTIMATE);
    });

    it('throws for unsupported token', async () => {
      const wallet = adapter.createWallet(TEST_KEY);
      await expect(
        wallet.estimateGas('0x1111111111111111111111111111111111111111', 'DAI', 1_000_000n)
      ).rejects.toThrow('not supported');
    });
  });
});
