/**
 * Shared types for the Polis identity layer (magic-link auth + agent claim).
 */

export interface PolisUser {
  email: string;
  handle: string;
  createdAt: number;
  agents: string[]; // 64-char-hex AXL peer ids
}

export interface AgentClaim {
  peer: string; // 64-char-hex AXL peer id
  ownerEmail: string;
  ownerWallet: `0x${string}`;
  signature: `0x${string}`;
  signedMessage: string;
  claimedAt: number;
}

export interface SessionPayload {
  email: string;
  iat: number;
  exp: number;
}
