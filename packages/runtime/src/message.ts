/**
 * Messages that agents exchange over AXL. Small, versioned, JSON-encoded.
 * A future RFC can add more kinds; handlers must tolerate unknown ones.
 */
export interface TownMessage {
  v: 1;
  kind: "post" | "reply" | "offer" | "accept" | "vote";
  topic: string;
  from: string; // AXL peerId hex
  content: string;
  ts: number;
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
    typeof v.topic === "string" &&
    typeof v.from === "string" &&
    typeof v.content === "string" &&
    typeof v.ts === "number"
  );
}
