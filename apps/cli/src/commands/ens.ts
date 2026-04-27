import { readConfig, writeConfig } from "../config.js";
import { derivePeerId } from "../peer.js";
import { verifyEnsIdentity } from "../ens.js";

export interface EnsVerifyOptions {
  name: string;
  ethRpcUrl?: string;
  requirePeerText: boolean;
}

export async function runEnsVerify(opts: EnsVerifyOptions): Promise<void> {
  const cfg = readConfig();
  const peerId = derivePeerId(cfg.axl.keyPath).hex;
  const verification = await verifyEnsIdentity(cfg, {
    name: opts.name,
    ethRpcUrl: opts.ethRpcUrl,
    requirePeerText: opts.requirePeerText,
  });

  writeConfig({ ...cfg, ens: verification });

  console.log(`ENS name:     ${verification.name}`);
  console.log(`wallet:       ${cfg.address}`);
  console.log(`resolved:     ${verification.resolvedAddress}`);
  console.log(`AXL peer:     ${peerId}`);
  console.log(`text peer:    ${verification.peerText ?? "(not set)"}`);
  console.log(`text agent:   ${verification.agentText ?? "(not set)"}`);
  if (verification.url) console.log(`url:          ${verification.url}`);
  if (verification.avatar) console.log(`avatar:       ${verification.avatar}`);
  console.log("saved ENS identity to ~/.polis/config.json");
}
