import { AxlClient } from "@polis/axl-client";
import { readConfig } from "../config.js";
import {
  shortenPeer,
  sleep,
  startAxlNode,
  waitForAxl,
  type StartAxlNodeOptions,
} from "../axl-node.js";
import { parseMessage } from "../town-message.js";

export interface RunOptions extends StartAxlNodeOptions {
  noSpawn: boolean;
  pollMs: number;
}

export async function runNode(opts: RunOptions): Promise<void> {
  if (!Number.isFinite(opts.pollMs) || opts.pollMs < 100) {
    throw new Error("--poll-ms must be a number >= 100");
  }

  const cfg = readConfig();
  const client = new AxlClient({ baseUrl: cfg.axl.apiUrl });
  const child = opts.noSpawn ? null : startAxlNode(cfg, opts);

  const shutdown = (): void => {
    if (child && !child.killed) child.kill("SIGTERM");
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await waitForAxl(client);
  const topology = await client.topology();
  console.log(`polis node ready: ${shortenPeer(topology.our_public_key)}`);
  console.log(`AXL API: ${cfg.axl.apiUrl}`);
  console.log("listening for TownMessage v1 packets. Ctrl-C to stop.");

  for (;;) {
    const msg = await client.recv();
    if (!msg) {
      await sleep(opts.pollMs);
      continue;
    }

    const town = parseMessage(msg.body);
    if (town) {
      const archive = town.archiveUri ? ` archive=${town.archiveUri}` : "";
      console.log(
        `[${town.topic}] ${town.kind} from ${shortenPeer(town.from)}: ${town.content}${archive}`,
      );
    } else {
      console.log(
        `[raw] ${msg.body.byteLength} bytes from ${shortenPeer(msg.fromPeerId)}`,
      );
    }
  }
}
