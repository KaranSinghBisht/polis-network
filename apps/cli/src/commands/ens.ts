import { readConfig, writeConfig } from "../config.js";
import { derivePeerId } from "../peer.js";
import { peerIdFromEns, resolveEnsAgent, verifyEnsIdentity } from "../ens.js";

export interface EnsVerifyOptions {
  name: string;
  ethRpcUrl?: string;
  requirePeerText: boolean;
  requireChainAddress: boolean;
  requirePrimaryName: boolean;
}

export interface EnsResolveOptions {
  name: string;
  ethRpcUrl?: string;
  chainId?: number;
}

export async function runEnsVerify(opts: EnsVerifyOptions): Promise<void> {
  const cfg = readConfig();
  const peerId = derivePeerId(cfg.axl.keyPath).hex;
  const verification = await verifyEnsIdentity(cfg, {
    name: opts.name,
    ethRpcUrl: opts.ethRpcUrl,
    chainId: cfg.chainId,
    requirePeerText: opts.requirePeerText,
    requireChainAddress: opts.requireChainAddress,
    requirePrimaryName: opts.requirePrimaryName,
  });

  writeConfig({ ...cfg, ens: verification });

  console.log(`ENS name:     ${verification.name}`);
  console.log(`wallet:       ${cfg.address}`);
  console.log(`resolved:     ${verification.resolvedAddress}`);
  console.log(`chain addr:   ${verification.chainAddress ?? "(not set)"}`);
  console.log(`primary:      ${verification.primaryName ?? "(not set)"}`);
  console.log(`AXL peer:     ${peerId}`);
  console.log(`text peer:    ${verification.peerText ?? "(not set)"}`);
  console.log(`text agent:   ${verification.agentText ?? "(not set)"}`);
  console.log(`text roles:   ${verification.rolesText ?? "(not set)"}`);
  console.log(`text topics:  ${verification.topicsText ?? "(not set)"}`);
  console.log(`text registry:${verification.registryText ?? "(not set)"}`);
  if (verification.url) console.log(`url:          ${verification.url}`);
  if (verification.avatar) console.log(`avatar:       ${verification.avatar}`);
  console.log("saved ENS identity to ~/.polis/config.json");
}

export async function runEnsResolve(opts: EnsResolveOptions): Promise<void> {
  const cfg = readConfig();
  const resolution = await resolveEnsAgent({
    name: opts.name,
    ethRpcUrl: opts.ethRpcUrl,
    chainId: opts.chainId ?? cfg.chainId,
  });

  console.log(`ENS name:     ${resolution.name}`);
  console.log(`address:      ${resolution.resolvedAddress}`);
  console.log(`chain addr:   ${resolution.chainAddress ?? "(not set)"}`);
  console.log(`primary:      ${resolution.primaryName ?? "(not set)"}`);
  console.log(`coinType:     ${resolution.coinType ?? "(not requested)"}`);
  console.log(`text peer:    ${resolution.peerText ?? "(not set)"}`);
  if (resolution.peerText) console.log(`AXL peer:     ${peerIdFromEns(resolution)}`);
  console.log(`text agent:   ${resolution.agentText ?? "(not set)"}`);
  console.log(`text roles:   ${resolution.rolesText ?? "(not set)"}`);
  console.log(`text topics:  ${resolution.topicsText ?? "(not set)"}`);
  console.log(`text registry:${resolution.registryText ?? "(not set)"}`);
  if (resolution.description) console.log(`description:  ${resolution.description}`);
  if (resolution.url) console.log(`url:          ${resolution.url}`);
  if (resolution.avatar) console.log(`avatar:       ${resolution.avatar}`);
}
