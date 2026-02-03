/**
 * Cashu Token Diagnostics
 * 
 * Utilities for detecting token versions and debugging CBOR structures.
 * Shared across Gate, Mint, and other Cashu-related services.
 */

/** Diagnostic info from token decoding (for debugging CBOR issues) */
export interface DecodeDiagnostics {
  tokenVersion: "V3" | "V4" | "unknown";
  rawPrefix: string;
  decodeTimeMs: number;
  proofCount: number;
  /** Raw CBOR object structure (for V4 debugging) - only in verbose mode */
  rawCborStructure?: string;
  error?: string;
}

/**
 * Detect token version from prefix.
 * 
 * @param token - Raw Cashu token string
 * @returns "V3" for cashuA tokens, "V4" for cashuB tokens, "unknown" otherwise
 */
export function detectTokenVersion(token: string): "V3" | "V4" | "unknown" {
  const trimmed = token.trim();
  if (trimmed.startsWith("cashuA")) return "V3";
  if (trimmed.startsWith("cashuB")) return "V4";
  return "unknown";
}

/**
 * Extract CBOR structure for debugging (keys only, no sensitive data).
 * Use this when you have a raw V4 token that failed to decode.
 * 
 * @param token - Raw Cashu V4 token string (starting with "cashuB")
 * @returns Human-readable CBOR structure description
 */
export function extractCborStructure(token: string): string {
  try {
    // Remove "cashuB" prefix and decode base64url
    const base64 = token.slice(6);
    // Convert base64url to base64
    const base64Standard = base64.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (base64Standard.length % 4)) % 4;
    const padded = base64Standard + "=".repeat(padding);

    // Decode base64 to bytes
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Parse CBOR manually to get structure (simplified)
    return describeCborStructure(bytes);
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : "unknown"}`;
  }
}

/**
 * Describe CBOR structure (keys and types only).
 * Internal helper for extractCborStructure.
 */
function describeCborStructure(bytes: Uint8Array): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  function readStructure(depth: number = 0): string {
    if (offset >= view.byteLength) return "EOF";

    const initial = view.getUint8(offset++);
    const majorType = initial >> 5;
    const additionalInfo = initial & 0x1f;

    const indent = "  ".repeat(depth);

    switch (majorType) {
      case 0:
        return `int`;
      case 1:
        return `neg-int`;
      case 2:
        return `bytes[${readLength(additionalInfo)}]`;
      case 3: {
        const len = readLength(additionalInfo);
        const str = new TextDecoder().decode(bytes.slice(offset, offset + len));
        offset += len;
        return `"${str.slice(0, 20)}${str.length > 20 ? "..." : ""}"`;
      }
      case 4: {
        const count = readLength(additionalInfo);
        const items: string[] = [];
        for (let i = 0; i < count && i < 5; i++) {
          items.push(readStructure(depth + 1));
        }
        if (count > 5) items.push("...");
        return `[\n${indent}  ${items.join(",\n" + indent + "  ")}\n${indent}]`;
      }
      case 5: {
        const count = readLength(additionalInfo);
        const pairs: string[] = [];
        for (let i = 0; i < count && i < 10; i++) {
          const key = readStructure(depth + 1);
          const val = readStructure(depth + 1);
          pairs.push(`${key}: ${val}`);
        }
        if (count > 10) pairs.push("...");
        return `{\n${indent}  ${pairs.join(",\n" + indent + "  ")}\n${indent}}`;
      }
      case 7:
        if (additionalInfo === 20) return "false";
        if (additionalInfo === 21) return "true";
        if (additionalInfo === 22) return "null";
        if (additionalInfo === 23) return "undefined";
        return `simple(${additionalInfo})`;
      default:
        return `unknown(${majorType})`;
    }
  }

  function readLength(info: number): number {
    if (info < 24) return info;
    if (info === 24) return view.getUint8(offset++);
    if (info === 25) {
      const val = view.getUint16(offset, false);
      offset += 2;
      return val;
    }
    if (info === 26) {
      const val = view.getUint32(offset, false);
      offset += 4;
      return val;
    }
    return 0;
  }

  try {
    return readStructure();
  } catch (e) {
    return `Parse error at offset ${offset}: ${e instanceof Error ? e.message : "unknown"}`;
  }
}
