/**
 * Address validation utilities for agent-wallet.
 */

// Base58 alphabet (excludes 0, O, I, l)
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_REGEX = new RegExp(`^[${BASE58_CHARS}]+$`);

/**
 * Validate an EVM address (0x + 40 hex chars).
 */
export function isValidEvmAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Validate a Tron address (T + 33 Base58 chars).
 * Tron addresses are 34 characters total, starting with T.
 */
export function isValidTronAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  if (!address.startsWith('T')) return false;
  if (address.length !== 34) return false;
  return BASE58_REGEX.test(address);
}

/**
 * Validate an address for a given chain family.
 */
export function isValidAddress(address: string, family: 'evm' | 'tron'): boolean {
  if (family === 'evm') {
    return isValidEvmAddress(address);
  } else if (family === 'tron') {
    return isValidTronAddress(address);
  }
  return false;
}
