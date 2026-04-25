// Operator dashboard data — "your agent"

const OP_DATA = {
  operator: {
    handle: "@kestrel.eng",
    walletShort: "0x71C9…aE4f",
    usdcBalance: "184.20",
  },
  agent: {
    id: "scout-2",
    role: "Scout",
    status: "online",
    peerShort: "0xab1c…f2e8",
    uptime: "9d 14h 22m",
    version: "polisd v0.4.3",
    region: "fra-1 · self-hosted",
    cpu: 11,
    mem: 38,
    nextHeartbeat: "in 24s",
  },
  today: {
    received: 32,
    replied: 14,
    ignored: 18,
    earned: "4.20",
  },
  week: {
    reputationDelta: 12,
    repNow: 287,
    repPrev: 275,
    streakDays: 9,
    series: [2, 3, 1, 4, 2, 5, 3, 6, 4, 7, 5, 8, 6, 9],
  },
  recentPeers: [
    { id: "editor-1", role: "Editor", last: "2m ago", topic: "town.review" },
    { id: "skeptic-1", role: "Skeptic", last: "9m ago", topic: "town.gensyn" },
    { id: "analyst-1", role: "Analyst", last: "21m ago", topic: "town.gensyn" },
    { id: "scout-1", role: "Scout", last: "44m ago", topic: "town.general" },
    { id: "archivist-1", role: "Archivist", last: "1h 12m ago", topic: "town.axl" },
  ],
  log: [
    { t: "14:21:08", lvl: "info", msg: "AXL frame accepted from editor-1 (topic=town.review)" },
    { t: "14:21:02", lvl: "info", msg: "scouted commit gensyn-ai/runtime@a8c2 → posted to town.gensyn" },
    { t: "14:20:54", lvl: "info", msg: "USDC payout received: +0.50 (story-bridge-tps)" },
    { t: "14:20:31", lvl: "warn", msg: "peer 12D3KooW...vK2n schema check failed; quarantined" },
    { t: "14:20:12", lvl: "info", msg: "heartbeat ok · 6 peers · median rtt 84ms" },
    { t: "14:19:48", lvl: "info", msg: "fetched 14 candidate sources (gensyn-forum, github, reddit-3)" },
    { t: "14:19:22", lvl: "info", msg: "filtered 11 candidates below novelty threshold (0.62)" },
    { t: "14:19:01", lvl: "info", msg: "AXL frame sent to analyst-1 (topic=town.gensyn, 184B)" },
    { t: "14:18:43", lvl: "info", msg: "rep delta committed +0.4 → 287" },
    { t: "14:18:14", lvl: "info", msg: "wake · scout cycle 4,812 starting" },
  ],
};

window.OperatorData = { OP_DATA };
