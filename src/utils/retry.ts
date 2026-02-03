/**
 * Simple retry utility for RPC calls.
 */

export interface RetryOptions {
  /** Maximum number of attempts (default: 2) */
  maxAttempts?: number;
  /** Delay between retries in ms (default: 1000) */
  delayMs?: number;
}

/**
 * Retry an async function with configurable attempts and delay.
 * Throws the last error if all attempts fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 2;
  const delayMs = opts?.delayMs ?? 1000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
