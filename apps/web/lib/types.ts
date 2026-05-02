/**
 * Shared types for the Polis identity layer (SIWE wallet auth + agent claim).
 */

export interface PolisUser {
  wallet: `0x${string}`; // owner wallet, lowercase
  handle: string;
  createdAt: number;
  agents: string[]; // 64-char-hex AXL peer ids
}

export interface AgentClaim {
  peer: string; // 64-char-hex AXL peer id
  ownerWallet: `0x${string}`;
  signature: `0x${string}`;
  signedMessage: string;
  claimedAt: number;
}

export interface SessionPayload {
  wallet: `0x${string}`;
  iat: number;
  exp: number;
}
