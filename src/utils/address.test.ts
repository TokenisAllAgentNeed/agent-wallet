/**
 * Unit tests for utils/address.ts — address validation utilities.
 */
import { describe, it, expect } from "vitest";
import { isValidEvmAddress, isValidTronAddress, isValidAddress } from "./address.js";

describe("isValidEvmAddress", () => {
  it("accepts valid lowercase address", () => {
    expect(isValidEvmAddress("0x742d35cc6634c0532925a3b844bc9e7595f2bd38")).toBe(true);
  });

  it("accepts valid uppercase address", () => {
    expect(isValidEvmAddress("0x742D35CC6634C0532925A3B844BC9E7595F2BD38")).toBe(true);
  });

  it("accepts valid mixed-case (checksum) address", () => {
    expect(isValidEvmAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38")).toBe(true);
  });

  it("rejects address without 0x prefix", () => {
    expect(isValidEvmAddress("742d35cc6634c0532925a3b844bc9e7595f2bd38")).toBe(false);
  });

  it("rejects short address", () => {
    expect(isValidEvmAddress("0x742d35cc")).toBe(false);
  });

  it("rejects long address", () => {
    expect(isValidEvmAddress("0x742d35cc6634c0532925a3b844bc9e7595f2bd38aa")).toBe(false);
  });

  it("rejects address with non-hex chars", () => {
    expect(isValidEvmAddress("0x742d35cc6634c0532925a3b844bc9e7595f2bgzz")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidEvmAddress("")).toBe(false);
  });

  it("rejects null/undefined-like inputs", () => {
    expect(isValidEvmAddress(null as any)).toBe(false);
    expect(isValidEvmAddress(undefined as any)).toBe(false);
  });
});

describe("isValidTronAddress", () => {
  it("accepts valid Tron address", () => {
    expect(isValidTronAddress("TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9")).toBe(true);
  });

  it("rejects address not starting with T", () => {
    expect(isValidTronAddress("AN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9")).toBe(false);
  });

  it("rejects short address", () => {
    expect(isValidTronAddress("TN3W4H")).toBe(false);
  });

  it("rejects long address", () => {
    expect(isValidTronAddress("TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9extra")).toBe(false);
  });

  it("rejects address with invalid Base58 chars (0, O, I, l)", () => {
    // Base58 excludes: 0, O, I, l
    expect(isValidTronAddress("TO3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9")).toBe(false); // O is invalid
    expect(isValidTronAddress("T0IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII")).toBe(false); // 0, I are invalid
    expect(isValidTronAddress("Tl3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9")).toBe(false); // l is invalid
  });

  it("rejects empty string", () => {
    expect(isValidTronAddress("")).toBe(false);
  });

  it("rejects null/undefined-like inputs", () => {
    expect(isValidTronAddress(null as any)).toBe(false);
    expect(isValidTronAddress(undefined as any)).toBe(false);
  });
});

describe("isValidAddress", () => {
  it("validates EVM addresses with family='evm'", () => {
    expect(isValidAddress("0x742d35cc6634c0532925a3b844bc9e7595f2bd38", "evm")).toBe(true);
    expect(isValidAddress("invalid", "evm")).toBe(false);
  });

  it("validates Tron addresses with family='tron'", () => {
    expect(isValidAddress("TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9", "tron")).toBe(true);
    expect(isValidAddress("invalid", "tron")).toBe(false);
  });

  it("returns false for unknown family", () => {
    expect(isValidAddress("0x742d35cc6634c0532925a3b844bc9e7595f2bd38", "bitcoin" as any)).toBe(false);
  });
});
