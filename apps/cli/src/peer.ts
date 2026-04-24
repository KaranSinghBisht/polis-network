import { spawnSync } from "node:child_process";

/**
 * Derive an AXL peer ID (64-char hex, lowercase) from an ed25519 private-key PEM.
 *
 * AXL uses the raw 32-byte ed25519 public key as the peer identity. Extracting it
 * from the PEM is a 3-step shell pipe — but we do it in-process so we can return
 * both hex (for AXL headers) and `0x`-prefixed bytes32 (for the on-chain registry).
 */
export interface PeerId {
  /** Lowercase hex, 64 chars, no prefix. */
  hex: string;
  /** Same bytes, 0x-prefixed for viem's bytes32. */
  bytes32: `0x${string}`;
}

export function derivePeerId(keyPath: string): PeerId {
  const result = spawnSync(
    "openssl",
    ["pkey", "-in", keyPath, "-pubout", "-outform", "DER"],
    { encoding: "buffer" },
  );
  if (result.error) {
    throw new Error(`openssl not available: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr?.toString("utf8") ?? "";
    throw new Error(
      `openssl pkey failed (status ${result.status ?? "?"}): ${stderr.trim()}`,
    );
  }
  const der = result.stdout;
  if (der.length < 32) {
    throw new Error(`unexpected DER length ${der.length}`);
  }
  const pubkey = der.subarray(der.length - 32);
  const hex = pubkey.toString("hex");
  return { hex, bytes32: `0x${hex}` };
}
