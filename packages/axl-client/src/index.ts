import { request } from "undici";

export interface AxlClientOptions {
  baseUrl?: string;
  requestTimeoutMs?: number;
}

export interface Peer {
  uri: string;
  up: boolean;
  inbound: boolean;
  public_key: string;
  [key: string]: unknown;
}

export interface Topology {
  our_ipv6: string;
  our_public_key: string;
  peers: Peer[];
  tree: unknown[];
}

export interface ReceivedMessage {
  fromPeerId: string;
  body: Uint8Array;
}

/**
 * Minimal client for the AXL node's local HTTP API.
 * Assumes a node is running on 127.0.0.1:9002 (configurable via AXL node-config.json).
 */
export class AxlClient {
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;

  constructor(opts: AxlClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "http://127.0.0.1:9002";
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 10_000;
  }

  async topology(): Promise<Topology> {
    const res = await request(`${this.baseUrl}/topology`, {
      method: "GET",
      signal: this.deadline(),
    });
    if (res.statusCode !== 200) {
      throw new Error(`topology failed: ${res.statusCode}`);
    }
    return (await res.body.json()) as Topology;
  }

  /**
   * Fire-and-forget raw binary send to a peer.
   * Returns the number of bytes the node reported as sent.
   */
  async send(destPeerId: string, body: Uint8Array | string): Promise<number> {
    if (!destPeerId) throw new Error("send requires a destination peer id");
    const bytes =
      typeof body === "string" ? new TextEncoder().encode(body) : body;
    const res = await request(`${this.baseUrl}/send`, {
      method: "POST",
      headers: { "X-Destination-Peer-Id": destPeerId },
      body: bytes,
      signal: this.deadline(),
    });
    if (res.statusCode !== 200) {
      throw new Error(`send failed: ${res.statusCode}`);
    }
    const sentBytes = res.headers["x-sent-bytes"];
    return typeof sentBytes === "string" ? Number.parseInt(sentBytes, 10) : bytes.length;
  }

  /**
   * Poll for a single inbound message.
   * Returns `null` if the queue is empty (204 No Content).
   * MCP/A2A envelopes are routed automatically and do not appear here.
   */
  async recv(): Promise<ReceivedMessage | null> {
    const res = await request(`${this.baseUrl}/recv`, {
      method: "GET",
      signal: this.deadline(),
    });
    if (res.statusCode === 204) return null;
    if (res.statusCode !== 200) {
      throw new Error(`recv failed: ${res.statusCode}`);
    }
    const fromPeerId = res.headers["x-from-peer-id"];
    if (typeof fromPeerId !== "string") {
      throw new Error("recv missing X-From-Peer-Id header");
    }
    const buf = new Uint8Array(await res.body.arrayBuffer());
    return { fromPeerId, body: buf };
  }

  /**
   * JSON-RPC to a remote peer's MCP service.
   * Service name routes to the peer's local MCP server.
   */
  async mcp<TResult = unknown>(
    peerId: string,
    service: string,
    jsonRpcBody: unknown,
  ): Promise<TResult> {
    const res = await request(`${this.baseUrl}/mcp/${peerId}/${service}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonRpcBody),
      signal: this.deadline(),
    });
    if (res.statusCode !== 200) {
      throw new Error(`mcp failed: ${res.statusCode}`);
    }
    return (await res.body.json()) as TResult;
  }

  /**
   * JSON-RPC to a remote peer's A2A server.
   */
  async a2a<TResult = unknown>(peerId: string, jsonRpcBody: unknown): Promise<TResult> {
    const res = await request(`${this.baseUrl}/a2a/${peerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonRpcBody),
      signal: this.deadline(),
    });
    if (res.statusCode !== 200) {
      throw new Error(`a2a failed: ${res.statusCode}`);
    }
    return (await res.body.json()) as TResult;
  }

  private deadline(): AbortSignal {
    return AbortSignal.timeout(this.requestTimeoutMs);
  }
}

export default AxlClient;
