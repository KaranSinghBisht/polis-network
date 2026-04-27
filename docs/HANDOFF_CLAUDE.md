# Claude Handoff

## Goal

Finish the ENS/Gensyn/0G demo path for Polis. Current branch is `main`; latest commits include real ENS identity/discovery support.

## Current State

- ENS support is now load-bearing:
  - `polis ens <name>` verifies the name resolves to the local Polis wallet.
  - `polis ens-resolve <name>` resolves wallet, chain address, primary name, AXL peer, roles, topics, registry, and profile records.
  - `polis post --ens <name> "..."` sends an AXL message to `com.polis.peer` from ENS.
  - `polis pay <name.eth> <amount>` resolves ENS to AXL peer, then AgentRegistry owner, then pays via PaymentRouter.
  - `polis register --ens <name>` writes `ens://<name>?peer=<peerId>` into `AgentRegistry.metadataURI`; if already registered, it updates metadata through `setMetadataURI`.
- Declared viem dependency is now ENSv2-ready (`^2.48.4`).
- Local docs: `docs/ENS_AUDIT.md`.

## User Must Provide

- An ENS name or subname they control.
- Set the address record to the Polis wallet in `~/.polis/config.json`.
- Set text record `com.polis.peer` to the current AXL peer ID.
- Optional but strong:
  - `com.polis.agent` as JSON-ish profile metadata.
  - `com.polis.roles=scout,critic` or similar.
  - `com.polis.topics=town.gensyn,town.axl`.
  - `com.polis.registry=<AgentRegistry address>`.
  - Chain-specific address record for chain `685685`.

## Exact Commands To Run After ENS Records Are Set

```bash
cd /Users/kryptos/Desktop/Projects/openagents/polis-network
pnpm build

node apps/cli/dist/index.js ens-resolve <YOUR_ENS_NAME>

node apps/cli/dist/index.js ens <YOUR_ENS_NAME> \
  --require-peer-text

node apps/cli/dist/index.js register \
  --registry 0xAFb77Ad4626b9A2ECA78905F7420102FB5F2A930 \
  --ens <YOUR_ENS_NAME> \
  --require-ens-peer-text

node apps/cli/dist/index.js post \
  --ens <YOUR_ENS_NAME> \
  --storage local \
  "ENS-routed AXL message from Polis"
```

If the user has configured a chain-specific ENS address for Gensyn chain `685685`, strengthen the verification:

```bash
node apps/cli/dist/index.js ens <YOUR_ENS_NAME> \
  --require-peer-text \
  --require-chain-address
```

Only add `--require-primary-name` if reverse primary name is actually configured.

## Next Build Task

Make a short "ENS identity" panel in the web profile or dashboard that displays live output copied from `polis ens-resolve`: ENS name, wallet, AXL peer, roles/topics, and `AgentRegistry.metadataURI`. Avoid hard-coded claims in the final demo; if no live API is wired, mark it clearly as "demo transcript" and use real command output in the video.

