/**
 * Formatting utilities for human-readable amounts.
 */

/**
 * Convert human-readable amount to base units (e.g., "10.00" -> 10000000n for 6 decimals).
 */
export function toBaseUnits(amount: string, decimals: number): bigint {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
}

/**
 * Convert base units to human-readable amount (e.g., 10000000n -> "10.00" for 6 decimals).
 */
export function fromBaseUnits(amount: bigint, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, -decimals) || '0';
  const fraction = str.slice(-decimals);
  // Trim trailing zeros but keep at least 2 decimal places
  const trimmed = fraction.replace(/0+$/, '').padEnd(2, '0');
  return `${whole}.${trimmed}`;
}

/**
 * Format native token balance with appropriate precision.
 */
export function formatNativeBalance(amount: bigint, symbol: string): string {
  // Native tokens have 18 decimals
  const str = amount.toString().padStart(19, '0');
  const whole = str.slice(0, -18) || '0';
  const fraction = str.slice(-18, -12); // Keep 6 significant decimals
  const trimmed = fraction.replace(/0+$/, '') || '0';
  return `${whole}.${trimmed} ${symbol}`;
}

/**
 * Format gas estimate in a human-readable way.
 */
export function formatGasEstimate(gasWei: bigint, symbol: string): string {
  return formatNativeBalance(gasWei, symbol);
}
