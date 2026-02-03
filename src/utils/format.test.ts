import { describe, it, expect } from 'vitest';
import { toBaseUnits, fromBaseUnits, formatNativeBalance } from './format.js';

describe('toBaseUnits', () => {
  it('converts whole numbers', () => {
    expect(toBaseUnits('100', 6)).toBe(100_000_000n);
    expect(toBaseUnits('1', 6)).toBe(1_000_000n);
  });

  it('converts decimals', () => {
    expect(toBaseUnits('10.50', 6)).toBe(10_500_000n);
    expect(toBaseUnits('0.01', 6)).toBe(10_000n);
    expect(toBaseUnits('0.000001', 6)).toBe(1n);
  });

  it('handles 18 decimals (BNB)', () => {
    expect(toBaseUnits('1', 18)).toBe(1_000_000_000_000_000_000n);
    expect(toBaseUnits('0.5', 18)).toBe(500_000_000_000_000_000n);
  });

  it('truncates extra decimal places', () => {
    expect(toBaseUnits('1.1234567', 6)).toBe(1_123_456n);
  });
});

describe('fromBaseUnits', () => {
  it('converts to human readable', () => {
    expect(fromBaseUnits(100_000_000n, 6)).toBe('100.00');
    expect(fromBaseUnits(1_000_000n, 6)).toBe('1.00');
    expect(fromBaseUnits(10_500_000n, 6)).toBe('10.50');
  });

  it('handles small amounts', () => {
    expect(fromBaseUnits(1n, 6)).toBe('0.000001');
    expect(fromBaseUnits(10_000n, 6)).toBe('0.01');
  });

  it('handles zero', () => {
    expect(fromBaseUnits(0n, 6)).toBe('0.00');
  });

  it('handles 18 decimals', () => {
    expect(fromBaseUnits(1_000_000_000_000_000_000n, 18)).toBe('1.00');
    expect(fromBaseUnits(500_000_000_000_000_000n, 18)).toBe('0.50');
  });
});

describe('formatNativeBalance', () => {
  it('formats ETH balance', () => {
    expect(formatNativeBalance(1_000_000_000_000_000_000n, 'ETH')).toBe('1.0 ETH');
    expect(formatNativeBalance(1_500_000_000_000_000_000n, 'ETH')).toBe('1.5 ETH');
  });

  it('formats small balances', () => {
    expect(formatNativeBalance(100_000_000_000_000n, 'ETH')).toBe('0.0001 ETH');
  });

  it('formats zero', () => {
    expect(formatNativeBalance(0n, 'ETH')).toBe('0.0 ETH');
  });
});
