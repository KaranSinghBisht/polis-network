import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cli = join(repoRoot, "apps/cli/dist/index.js");
const axlBin = process.env.AXL_NODE_BIN ?? resolve(repoRoot, "../refs/axl/node");

const nodes = [
  { id: 1, apiPort: 9101, listenPort: 9201, peers: [] },
  { id: 2, apiPort: 9102, listenPort: 9202, peers: ["tls://127.0.0.1:9201"] },
  { id: 3, apiPort: 9103, listenPort: 9203, peers: ["tls://127.0.0.1:9201"] },
];

if (!existsSync(cli)) {
  throw new Error("apps/cli/dist/index.js not found. Run `pnpm build` first.");
}

if (!existsSync(axlBin)) {
  throw new Error(
    `AXL binary not found at ${axlBin}. Run \`make build\` in ../refs/axl or set AXL_NODE_BIN.`,
  );
}

for (const node of nodes) {
  const home = `/tmp/polis-term-${node.id}`;
  run("node", [cli, "init", "--force"], { HOME: home });
  run("node", [cli, "keygen-axl", "--force"], { HOME: home });

  const cfgPath = `${home}/.polis/config.json`;
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.axl.apiUrl = `http://127.0.0.1:${node.apiPort}`;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

  const nodeConfig = {
    PrivateKeyPath: cfg.axl.keyPath,
    Peers: node.peers,
    Listen: [`tls://127.0.0.1:${node.listenPort}`],
    api_port: node.apiPort,
    bridge_addr: "127.0.0.1",
    tcp_port: 7000,
  };
  writeFileSync(cfg.axl.nodeConfigPath, JSON.stringify(nodeConfig, null, 2));
}

console.log("Local AXL smoke homes created:");
for (const node of nodes) {
  console.log(`  /tmp/polis-term-${node.id} -> API :${node.apiPort}, listen :${node.listenPort}`);
}

console.log("\nRun these in three terminals:");
for (const node of nodes) {
  console.log(
    `  HOME=/tmp/polis-term-${node.id} AXL_NODE_BIN=${axlBin} node apps/cli/dist/index.js run`,
  );
}

console.log("\nThen copy a peer id from a receiving terminal and send:");
console.log(
  '  HOME=/tmp/polis-term-2 node apps/cli/dist/index.js post --peer <peerId> "hello from terminal 2"',
);

function run(cmd, args, env) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: "ignore",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with ${result.status}`);
  }
}
