/**
 * Unit tests for utils/retry.ts — withRetry function.
 */
import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./retry.js";

describe("withRetry", () => {
  it("returns on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { delayMs: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws last error after all attempts exhausted", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"));
    await expect(withRetry(fn, { maxAttempts: 2, delayMs: 0 })).rejects.toThrow("fail2");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("defaults to 2 attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fail"));
    await expect(withRetry(fn, { delayMs: 0 })).rejects.toThrow("always fail");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("respects maxAttempts option", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(withRetry(fn, { maxAttempts: 5, delayMs: 0 })).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it("succeeds on last attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockResolvedValue("final");
    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 0 });
    expect(result).toBe("final");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("delays between retries", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { delayMs: 500 });

    // First call happens synchronously
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance timer past delay
    await vi.advanceTimersByTimeAsync(500);

    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("handles non-Error throws", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce("string error")
      .mockRejectedValueOnce(42);
    await expect(withRetry(fn, { maxAttempts: 2, delayMs: 0 })).rejects.toBe(42);
  });

  it("works with maxAttempts = 1 (no retry)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("one shot"));
    await expect(withRetry(fn, { maxAttempts: 1 })).rejects.toThrow("one shot");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
