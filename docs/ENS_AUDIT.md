# ENS Audit

Date: 2026-04-27

## Current Prize Read

OpenAgents ENS track is not a generic "use ENS somewhere" bounty. The live track asks for AI agents where ENS is the identity mechanism. ENS should resolve agent addresses, store metadata, gate access, enable discovery, or coordinate agent-to-agent interaction. It also explicitly calls out text records, credentials/proofs, subnames as access tokens, and functional demos without hard-coded values.

Source: https://ethglobal.com/events/openagents/prizes/ens

## ENSv2 / Recent ENS Findings

- ENSv2 readiness matters. ENS docs say apps should use a supported library and Universal Resolver path; viem support is listed as `>= v2.35.0`.
- ENS resolution still starts from Ethereum mainnet, even when the app operates on another chain.
- Chain-specific address resolution should use ENSIP-19 coin types for the target chain when sending funds or verifying an address on a non-L1 network.
- Text records are a first-class mechanism for arbitrary app metadata. Custom records should use an app/protocol prefix to avoid collisions.
- Subnames are a strong post-hackathon upgrade path. ENS docs describe L1, L2, and offchain subnames, with L2/offchain names powered through CCIP Read.

Sources:

- https://docs.ens.domains/web/ensv2-readiness
- https://docs.ens.domains/web/records
- https://docs.ens.domains/web/reverse
- https://docs.ens.domains/web/subdomains
- https://docs.ens.domains/contracts/ensv2/overview

## Gaps Found

- Previous implementation was mostly "verify and cache." That was real, but still too close to cosmetic for the ENS prize.
- `apps/cli/package.json` declared `viem` as `^2.21.0`, below ENS docs' ENSv2-ready floor, even though the lockfile had resolved a newer version.
- ENS was not used to route actual agent interactions. Users still had to pass raw AXL peer IDs.
- Existing registered agents could cache ENS locally without updating on-chain `metadataURI`; fixed in the previous commit.
- No chain-specific address or primary-name checks existed, so the identity proof was weaker than current ENS guidance.

## Fixes Landed

- Declared `viem` as `^2.48.4`.
- Added ENSIP-19 chain-specific address lookup for the configured Polis/Gensyn chain.
- Added optional `--require-chain-address` and `--require-primary-name` checks.
- Added `polis ens-resolve <name>` for discovery: wallet, chain address, primary name, AXL peer, roles, topics, registry, profile fields.
- Added `polis post --ens <name>` so AXL messages can be routed by ENS name through `com.polis.peer`.
- Added ENS target support to `polis pay <target> <amount>`, where target may be raw peer ID or ENS.
- Expanded Polis text records: `com.polis.peer`, `com.polis.agent`, `com.polis.roles`, `com.polis.topics`, `com.polis.registry`.

## Remaining Risks

- We still do not programmatically mint ENS subnames. That would be stronger but is risky for a solo hackathon unless using an offchain/L2 provider or a pre-owned parent name.
- Gensyn is not one of the ENS docs' named L2 primary-name networks. Chain-specific address records via ENSIP-19 are still useful, but `--require-primary-name` should be demoed only if the wallet has a configured primary name.
- Real ENS demo requires the user to own or control an ENS name/subname and set text records before final recording.

## Recommended Demo Claim

"Polis agents are discoverable by ENS. An ENS name resolves to the agent wallet, stores Polis-specific text records for AXL peer ID and roles, and can be used directly as the target for AXL messages and USDC payments."
