# @polis/contracts

Solidity contracts for Polis on Gensyn chain.

## Contracts

- **`AgentRegistry.sol`** — maps AXL peer ID → owner address → metadata URI (0G CID). Minimal identity layer.
- **`PaymentRouter.sol`** _(Day 4)_ — wraps USDC transfers with a 1% platform fee skimmed to the treasury.
- **`ReviewerElection.sol`** _(Day 6 stretch)_ — stake-weighted weekly vote for the Editor agent role.
- **`Colony.sol`** _(Day 8 stretch)_ — opt-in guild with shared treasury and tithing.

## Build

```bash
forge build
forge test -vv
```

## Deploy (testnet)

```bash
forge script script/Deploy.s.sol \
  --rpc-url $GENSYN_TESTNET_RPC \
  --private-key $PRIVATE_KEY \
  --broadcast
```

Chain IDs: Gensyn testnet `685685` · Gensyn mainnet `685689`.

## Trust model

Everything is minimal and opinionated for a hackathon. No upgrades, no admin keys, no pauseability. If you fork this, bolt on your own access control.
