/**
 * Unit tests for cashu/diagnostics.ts — token version detection and CBOR structure parsing.
 */
import { describe, it, expect } from "vitest";
import { detectTokenVersion, extractCborStructure } from "./diagnostics.js";

describe("detectTokenVersion", () => {
  it("detects V3 token (cashuA prefix)", () => {
    expect(detectTokenVersion("cashuAeyJwcm9vZnMiOlt7InByb29mcyI6W10sIm1pbnQiOiIifV19")).toBe("V3");
  });

  it("detects V4 token (cashuB prefix)", () => {
    expect(detectTokenVersion("cashuBo2FtdGh0dHBzOi8vbWludC5leGFtcGxlLmNvbWF1Y3NhdGFwgQ")).toBe("V4");
  });

  it("returns unknown for invalid prefix", () => {
    expect(detectTokenVersion("invalidTokenString")).toBe("unknown");
  });

  it("returns unknown for empty string", () => {
    expect(detectTokenVersion("")).toBe("unknown");
  });

  it("handles whitespace-padded tokens", () => {
    expect(detectTokenVersion("  cashuAeyJ0b2tlbiI6W119  ")).toBe("V3");
    expect(detectTokenVersion("  cashuBo2FtdGh0dHA  ")).toBe("V4");
  });

  it("is case-sensitive", () => {
    expect(detectTokenVersion("CashuAeyJ0b2tlbiI6W119")).toBe("unknown");
    expect(detectTokenVersion("CASHUA...")).toBe("unknown");
  });
});

describe("extractCborStructure", () => {
  it("returns error for invalid base64", () => {
    const result = extractCborStructure("cashuB!!!invalid!!!");
    expect(result).toContain("Error");
  });

  it("parses a simple CBOR map", () => {
    // Construct a simple CBOR map: {0: "sat", 1: "https://mint.example.com"}
    // CBOR: A2 (map of 2) 00 (int 0) 63 73 61 74 (text "sat") 01 (int 1) ...
    const bytes = new Uint8Array([
      0xa2, // map(2)
      0x00, // unsigned(0)
      0x63, 0x73, 0x61, 0x74, // text(3) "sat"
      0x01, // unsigned(1)
      0x63, 0x75, 0x72, 0x6c, // text(3) "url"
    ]);
    // Encode to base64url
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const base64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const token = `cashuB${base64}`;

    const result = extractCborStructure(token);
    expect(result).toContain("sat");
    expect(result).toContain("url");
  });

  it("handles CBOR array", () => {
    // CBOR: 83 (array of 3) 01 02 03
    const bytes = new Uint8Array([0x83, 0x01, 0x02, 0x03]);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const base64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const token = `cashuB${base64}`;

    const result = extractCborStructure(token);
    expect(result).toContain("[");
    expect(result).toContain("int");
  });

  it("handles CBOR boolean and null values", () => {
    // CBOR: 83 F4 F5 F6 (array of 3: false, true, null)
    const bytes = new Uint8Array([0x83, 0xf4, 0xf5, 0xf6]);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const base64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const token = `cashuB${base64}`;

    const result = extractCborStructure(token);
    expect(result).toContain("false");
    expect(result).toContain("true");
    expect(result).toContain("null");
  });

  it("handles empty input after prefix", () => {
    const result = extractCborStructure("cashuB");
    // Should handle gracefully (empty base64 → empty bytes → EOF or error)
    expect(typeof result).toBe("string");
  });

  it("handles negative integers", () => {
    // CBOR: 20 = negative integer -1
    const bytes = new Uint8Array([0x20]);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const base64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const token = `cashuB${base64}`;

    const result = extractCborStructure(token);
    expect(result).toContain("neg-int");
  });

  it("handles byte strings", () => {
    // CBOR: 43 01 02 03 = bytes(3)
    const bytes = new Uint8Array([0x43, 0x01, 0x02, 0x03]);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    const base64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const token = `cashuB${base64}`;

    const result = extractCborStructure(token);
    expect(result).toContain("bytes[3]");
  });
});
