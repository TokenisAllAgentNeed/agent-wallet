import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TronAdapter, type TronChainConfig } from './tron.js';
import { tronConfig } from './configs/tron.js';

// Mock TronWeb
vi.mock('tronweb', () => {
  const mockTronWeb = {
    address: {
      fromPrivateKey: vi.fn((pk: string) => 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC'),
      isAddress: vi.fn((addr: string) => addr.startsWith('T') && addr.length === 34),
    },
    trx: {
      getBalance: vi.fn().mockResolvedValue(1000000), // 1 TRX = 1,000,000 sun
    },
    contract: vi.fn(() => ({
      methods: {
        balanceOf: vi.fn(() => ({
          call: vi.fn().mockResolvedValue(10000000), // 10 USDT
        })),
        transfer: vi.fn(() => ({
          send: vi.fn().mockResolvedValue({
            txid: 'mock-tron-txid-12345',
          }),
        })),
      },
    })),
    setPrivateKey: vi.fn(),
  };

  return {
    TronWeb: vi.fn().mockImplementation(() => mockTronWeb),
    default: {
      TronWeb: vi.fn().mockImplementation(() => mockTronWeb),
    },
  };
});

describe('TronAdapter', () => {
  let adapter: TronAdapter;

  beforeEach(() => {
    adapter = new TronAdapter(tronConfig);
  });

  describe('chain info', () => {
    it('has correct chain metadata', () => {
      expect(adapter.chain.id).toBe('tron');
      expect(adapter.chain.family).toBe('tron');
      expect(adapter.chain.name).toBe('Tron');
      expect(adapter.chain.nativeToken).toBe('TRX');
    });

    it('has USDT and USDC stablecoins', () => {
      const symbols = adapter.chain.stablecoins.map((s) => s.symbol);
      expect(symbols).toContain('USDT');
      expect(symbols).toContain('USDC');
    });

    it('config has correct stablecoin addresses', () => {
      const usdt = adapter.config.stablecoins.find((s) => s.symbol === 'USDT');
      expect(usdt?.address).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
      expect(usdt?.decimals).toBe(6);
    });
  });

  describe('createWallet', () => {
    it('creates wallet from private key', () => {
      const privateKey = '0x' + 'a'.repeat(64);
      const wallet = adapter.createWallet(privateKey);
      
      expect(wallet.address).toBeTruthy();
      expect(wallet.address.startsWith('T')).toBe(true);
    });

    it('accepts private key without 0x prefix', () => {
      const privateKey = 'a'.repeat(64) as `0x${string}`;
      const wallet = adapter.createWallet(privateKey);
      
      expect(wallet.address).toBeTruthy();
    });
  });

  describe('TronWallet', () => {
    it('getBalance returns TRC20 balance', async () => {
      const privateKey = '0x' + 'a'.repeat(64) as `0x${string}`;
      const wallet = adapter.createWallet(privateKey);
      
      const balance = await wallet.getBalance('USDT');
      expect(balance).toBe(10000000n);
    });

    it('getNativeBalance returns TRX balance', async () => {
      const privateKey = '0x' + 'a'.repeat(64) as `0x${string}`;
      const wallet = adapter.createWallet(privateKey);
      
      const balance = await wallet.getNativeBalance();
      expect(balance).toBe(1000000n); // 1 TRX in sun
    });

    it('send returns transaction hash', async () => {
      const privateKey = '0x' + 'a'.repeat(64) as `0x${string}`;
      const wallet = adapter.createWallet(privateKey);
      
      const txHash = await wallet.send(
        'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC',
        'USDT',
        1000000n
      );
      
      expect(txHash).toBe('mock-tron-txid-12345');
    });

    it('estimateGas returns a reasonable estimate', async () => {
      const privateKey = '0x' + 'a'.repeat(64) as `0x${string}`;
      const wallet = adapter.createWallet(privateKey);
      
      const gas = await wallet.estimateGas(
        'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC',
        'USDT',
        1000000n
      );
      
      // TRC20 transfer costs ~15 TRX energy/bandwidth
      expect(gas).toBeGreaterThan(0n);
    });

    it('throws for unsupported token', async () => {
      const privateKey = '0x' + 'a'.repeat(64) as `0x${string}`;
      const wallet = adapter.createWallet(privateKey);
      
      await expect(wallet.getBalance('DAI')).rejects.toThrow('Token DAI not supported');
    });
  });
});

describe('Tron address format', () => {
  it('Tron addresses start with T', () => {
    const adapter = new TronAdapter(tronConfig);
    const privateKey = '0x' + 'b'.repeat(64) as `0x${string}`;
    const wallet = adapter.createWallet(privateKey);
    
    expect(wallet.address[0]).toBe('T');
  });

  it('Tron addresses are 34 characters', () => {
    const adapter = new TronAdapter(tronConfig);
    const privateKey = '0x' + 'c'.repeat(64) as `0x${string}`;
    const wallet = adapter.createWallet(privateKey);
    
    expect(wallet.address.length).toBe(34);
  });
});
