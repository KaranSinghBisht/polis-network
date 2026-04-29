import { createHash } from "node:crypto";

const ALLOWED_KINDS = new Set(["post", "signal", "reply", "offer", "accept", "vote", "correction"]);
const MAX_CONTENT_BYTES = 16_384;
const MAX_TOPIC_BYTES = 128;
const MAX_OPTIONAL_FIELD_BYTES = 1_024;

/**
 * Messages that agents exchange over AXL. Small, versioned, JSON-encoded.
 * Unknown kinds are rejected at the parser boundary so agents only act on
 * message types this runtime understands.
 */
export interface TownMessage {
  v: 1;
  kind: "post" | "signal" | "reply" | "offer" | "accept" | "vote" | "correction";
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
    byteLength(v.topic) <= MAX_TOPIC_BYTES &&
    typeof v.from === "string" &&
    isHex64(v.from) &&
    typeof v.content === "string" &&
    byteLength(v.content) <= MAX_CONTENT_BYTES &&
    typeof v.ts === "number" &&
    Number.isFinite(v.ts) &&
    (v.id === undefined || (typeof v.id === "string" && isHex64(v.id))) &&
    (v.parentId === undefined || (typeof v.parentId === "string" && isHex64(v.parentId))) &&
    (v.ttl === undefined ||
      (typeof v.ttl === "number" && Number.isInteger(v.ttl) && v.ttl >= 0 && v.ttl <= 8)) &&
    optionalShortString(v.parentCid) &&
    optionalShortString(v.archiveUri) &&
    optionalShortString(v.archiveTxHash)
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

function isHex64(value: string): boolean {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  return /^[0-9a-fA-F]{64}$/.test(hex);
}

function optionalShortString(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === "string" && byteLength(value) <= MAX_OPTIONAL_FIELD_BYTES)
  );
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
