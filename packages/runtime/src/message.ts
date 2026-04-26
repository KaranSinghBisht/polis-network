import { createHash } from "node:crypto";

const ALLOWED_KINDS = new Set(["post", "reply", "offer", "accept", "vote"]);
const MAX_CONTENT_BYTES = 16_384;

/**
 * Messages that agents exchange over AXL. Small, versioned, JSON-encoded.
 * Unknown kinds are rejected at the parser boundary so agents only act on
 * message types this runtime understands.
 */
export interface TownMessage {
  v: 1;
  kind: "post" | "reply" | "offer" | "accept" | "vote";
  /** Stable content hash for dedupe and parent/child threading. */
  id?: string;
  topic: string;
  from: string; // AXL peerId hex
  content: string;
  ts: number;
  /** Parent TownMessage id, used when agents build a review chain. */
  parentId?: string;
  /** Remaining fanout/reply budget. Prevents autonomous reply storms. */
  ttl?: number;
  parentCid?: string; // ref to a prior post on 0G, once we wire 0G storage
  archiveUri?: string;
  archiveTxHash?: string;
}

export function encodeMessage(msg: TownMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(msg));
}

export function parseMessage(body: Uint8Array): TownMessage | null {
  try {
    const obj = JSON.parse(new TextDecoder().decode(body)) as unknown;
    if (!isTownMessage(obj)) return null;
    return obj;
  } catch {
    return null;
  }
}

export function isTownMessage(value: unknown): value is TownMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.v === 1 &&
    typeof v.kind === "string" &&
    ALLOWED_KINDS.has(v.kind) &&
    typeof v.topic === "string" &&
    v.topic.length > 0 &&
    typeof v.from === "string" &&
    typeof v.content === "string" &&
    new TextEncoder().encode(v.content).byteLength <= MAX_CONTENT_BYTES &&
    typeof v.ts === "number" &&
    Number.isFinite(v.ts) &&
    (v.id === undefined || typeof v.id === "string") &&
    (v.parentId === undefined || typeof v.parentId === "string") &&
    (v.ttl === undefined ||
      (typeof v.ttl === "number" && Number.isInteger(v.ttl) && v.ttl >= 0 && v.ttl <= 8))
  );
}

export function normalizePeerId(peerId: string): string {
  return peerId.startsWith("0x") ? peerId.slice(2).toLowerCase() : peerId.toLowerCase();
}

export function messageId(msg: TownMessage): string {
  if (msg.id && /^[0-9a-f]{64}$/i.test(msg.id)) return msg.id.toLowerCase();
  const payload = {
    v: msg.v,
    kind: msg.kind,
    topic: msg.topic,
    from: normalizePeerId(msg.from),
    content: msg.content,
    ts: msg.ts,
    parentId: msg.parentId,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function withMessageId(msg: TownMessage): TownMessage {
  return { ...msg, id: messageId(msg) };
}
