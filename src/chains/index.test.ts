import { describe, it, expect } from 'vitest';
import { getChain, listChains, getChainIds } from './index.js';

describe('Chain Registry', () => {
  describe('getChain', () => {
    it('returns adapter for known chain', () => {
      const adapter = getChain('base');
      expect(adapter.chain.id).toBe('base');
      expect(adapter.chain.name).toBe('Base');
    });

    it('returns adapter for tron chain', () => {
      const adapter = getChain('tron');
      expect(adapter.chain.id).toBe('tron');
      expect(adapter.chain.name).toBe('Tron');
      expect(adapter.chain.family).toBe('tron');
    });

    it('throws for unknown chain', () => {
      expect(() => getChain('unknown-chain')).toThrow('Chain not supported: unknown-chain');
    });
  });

  describe('listChains', () => {
    it('returns all registered chains', () => {
      const chains = listChains();
      expect(chains.length).toBeGreaterThanOrEqual(5);
      
      const ids = chains.map(c => c.id);
      expect(ids).toContain('base');
      expect(ids).toContain('ethereum');
      expect(ids).toContain('arbitrum');
      expect(ids).toContain('bnb');
      expect(ids).toContain('tron');
    });
  });

  describe('getChainIds', () => {
    it('returns all chain ids', () => {
      const ids = getChainIds();
      expect(ids).toContain('base');
      expect(ids).toContain('ethereum');
      expect(ids).toContain('arbitrum');
      expect(ids).toContain('bnb');
      expect(ids).toContain('tron');
    });
  });

  describe('chain configs', () => {
    it('base has correct config', () => {
      const adapter = getChain('base');
      expect((adapter.config as any).chainId).toBe(8453);
      expect(adapter.config.nativeToken).toBe('ETH');
      expect(adapter.config.stablecoins.length).toBeGreaterThanOrEqual(2);
    });

    it('ethereum has correct config', () => {
      const adapter = getChain('ethereum');
      expect((adapter.config as any).chainId).toBe(1);
      expect(adapter.config.nativeToken).toBe('ETH');
    });

    it('bnb has 18 decimal stablecoins', () => {
      const adapter = getChain('bnb');
      const usdc = adapter.config.stablecoins.find(s => s.symbol === 'USDC');
      expect(usdc?.decimals).toBe(18);
    });

    it('tron has correct config', () => {
      const adapter = getChain('tron');
      expect(adapter.config.nativeToken).toBe('TRX');
      expect(adapter.config.rpcUrl).toBe('https://api.trongrid.io');
      
      const usdt = adapter.config.stablecoins.find(s => s.symbol === 'USDT');
      expect(usdt?.address).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
      expect(usdt?.decimals).toBe(6);
    });
  });
});
