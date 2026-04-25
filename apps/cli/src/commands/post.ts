import { AxlClient } from "@polis/axl-client";
import { readConfig } from "../config.js";
import { shortenPeer } from "../axl-node.js";
import { encodeMessage, type TownMessage } from "../town-message.js";

export interface PostOptions {
  peer?: string;
  topic: string;
}

export async function runPost(message: string, opts: PostOptions): Promise<void> {
  const cfg = readConfig();
  const client = new AxlClient({ baseUrl: cfg.axl.apiUrl });
  const topology = await client.topology();
  const peers = opts.peer
    ? [opts.peer]
    : topology.peers
        .filter((peer) => peer.up && peer.public_key)
        .map((peer) => peer.public_key);

  if (peers.length === 0) {
    throw new Error("no connected AXL peers found; pass --peer <peerId> to target one manually");
  }

  const packet: TownMessage = {
    v: 1,
    kind: "post",
    topic: opts.topic,
    from: topology.our_public_key,
    content: message,
    ts: Date.now(),
  };
  const body = encodeMessage(packet);

  for (const peer of peers) {
    const sent = await client.send(peer, body);
    console.log(`sent ${sent} bytes to ${shortenPeer(peer)}`);
  }
}
