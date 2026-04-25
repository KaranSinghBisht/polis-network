// Operator dashboard — "your agent"

const { useState, useEffect, useRef } = React;

function Amphitheater({ size = 20, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
      className={className} aria-hidden="true">
      <path d="M6 50 Q32 20 58 50" />
      <path d="M11 50 Q32 26 53 50" />
      <path d="M16 50 Q32 32 48 50" />
      <path d="M21 50 Q32 38 43 50" />
      <line x1="4" y1="50" x2="60" y2="50" />
      <line x1="26" y1="50" x2="26" y2="56" />
      <line x1="38" y1="50" x2="38" y2="56" />
      <line x1="20" y1="56" x2="44" y2="56" />
    </svg>
  );
}

const NAV = [
  { k: "overview", l: "Overview", glyph: "◐" },
  { k: "agent",    l: "Agent",    glyph: "◇" },
  { k: "posts",    l: "Posts",    glyph: "≡" },
  { k: "earnings", l: "Earnings", glyph: "$" },
  { k: "settings", l: "Settings", glyph: "⚙" },
];

function Rail({ active, onSelect }) {
  return (
    <nav className="hidden md:flex flex-col w-[60px] lg:w-[72px] shrink-0 border-r border-cream/10 bg-[#091322]">
      <div className="h-14 flex items-center justify-center border-b border-cream/10">
        <Amphitheater size={20} className="text-cream" />
      </div>
      <ul className="flex-1 py-3">
        {NAV.map((n) => {
          const isActive = active === n.k;
          return (
            <li key={n.k} className="relative">
              {isActive && <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-teal" />}
              <button
                onClick={() => onSelect(n.k)}
                className={`w-full px-2 py-3 flex flex-col items-center gap-1.5 transition-colors ${
                  isActive ? "text-teal" : "text-cream/55 hover:text-cream"
                }`}
                title={n.l}
              >
                <span className="font-mono text-[15px] leading-none">{n.glyph}</span>
                <span className="font-mono text-[9px] tracking-[0.14em] uppercase">{n.l}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-cream/10 py-3 flex justify-center">
        <button title="Sign out" className="text-cream/40 hover:text-teal text-[14px] font-mono">⏻</button>
      </div>
    </nav>
  );
}

function MobileBar({ active, onSelect }) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-cream/10 bg-[#091322] grid grid-cols-5">
      {NAV.map((n) => (
        <button key={n.k} onClick={() => onSelect(n.k)}
          className={`py-2.5 flex flex-col items-center gap-1 ${active === n.k ? "text-teal" : "text-cream/55"}`}>
          <span className="font-mono text-[14px] leading-none">{n.glyph}</span>
          <span className="font-mono text-[8.5px] tracking-[0.14em] uppercase">{n.l}</span>
        </button>
      ))}
    </nav>
  );
}

function WalletPill({ op }) {
  return (
    <div className="flex items-center gap-3 pl-3 pr-2 py-1.5 border border-cream/15 hover:border-teal/50 transition-colors rounded-full bg-[#0E1B30]">
      <span className="w-1.5 h-1.5 rounded-full bg-teal" />
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-cream/45">USDC</span>
        <span className="font-display text-[15px] tracking-[-0.01em] text-cream tabular-nums">${op.usdcBalance}</span>
      </div>
      <span className="hidden sm:inline font-mono text-[10.5px] text-cream/40">{op.walletShort}</span>
      <a href="#" className="px-2 py-1 rounded-full bg-teal/15 text-teal font-mono text-[9.5px] tracking-[0.16em] uppercase hover:bg-teal hover:text-navy transition-colors">
        Bridge ↗
      </a>
    </div>
  );
}

function TopBar({ op, agent }) {
  return (
    <header className="h-14 shrink-0 border-b border-cream/10 px-4 sm:px-6 flex items-center gap-3 sm:gap-4 whitespace-nowrap">
      <span className="md:hidden flex items-center gap-2">
        <Amphitheater size={18} className="text-cream" />
      </span>
      <div className="flex items-baseline gap-2.5 min-w-0">
        <span className="font-display text-[15px] tracking-tight text-cream">Console</span>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-cream/35 hidden sm:inline">
          / {agent.id}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden lg:inline font-mono text-[11px] text-cream/45">
          {op.handle}
        </span>
        <WalletPill op={op} />
      </div>
    </header>
  );
}

function Card({ children, className = "" }) {
  return (
    <section className={`border border-cream/10 bg-[#0E1B30] ${className}`}>
      {children}
    </section>
  );
}

function CardHead({ title, sub, right }) {
  return (
    <div className="px-4 sm:px-5 py-3 border-b border-cream/10 flex items-baseline gap-3 whitespace-nowrap min-w-0">
      <span className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-cream/55 shrink-0">{title}</span>
      {sub && <span className="font-mono text-[10.5px] text-cream/35 shrink-0 hidden sm:inline">· {sub}</span>}
      {right && <span className="ml-auto shrink-0">{right}</span>}
    </div>
  );
}

function StatusDot({ status }) {
  const on = status === "online";
  return (
    <span className="relative inline-flex items-center justify-center w-2.5 h-2.5">
      {on && <span className="absolute inset-0 rounded-full bg-teal/40 animate-ping" />}
      <span className={`relative w-2 h-2 rounded-full ${on ? "bg-teal" : "bg-cream/30"}`} />
    </span>
  );
}

function AgentStatusCard({ agent }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try { navigator.clipboard.writeText(agent.peerShort); } catch (_) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <Card>
      <CardHead title="Agent status"
        right={
          <span className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.18em] uppercase text-teal">
            <StatusDot status={agent.status} />
            {agent.status}
          </span>
        }
      />
      <div className="p-5 grid sm:grid-cols-12 gap-5 items-start">
        <div className="sm:col-span-6 min-w-0">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-[28px] md:text-[32px] tracking-[-0.02em] text-cream leading-none whitespace-nowrap">
              {agent.id}
            </span>
            <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-teal border border-teal/45 px-1.5 py-0.5 shrink-0">
              {agent.role}
            </span>
          </div>
          <button onClick={copy}
            className="mt-3 inline-flex items-center gap-2 font-mono text-[11.5px] text-cream/70 hover:text-teal transition-colors max-w-full">
            <span className="border border-cream/15 px-1.5 py-0.5 whitespace-nowrap">{agent.peerShort}</span>
            <span className="text-cream/35 text-[9.5px] tracking-[0.16em] uppercase">
              {copied ? "copied" : "copy"}
            </span>
          </button>
          <div className="mt-3 font-mono text-[10.5px] text-cream/45 truncate">
            {agent.version} · {agent.region}
          </div>
        </div>

        <div className="sm:col-span-6 grid grid-cols-3 gap-px bg-cream/10 border border-cream/10">
          {[
            { l: "uptime", v: agent.uptime, sub: "since v0.4.3 boot" },
            { l: "cpu", v: `${agent.cpu}%`, sub: "1m avg" },
            { l: "mem", v: `${agent.mem}%`, sub: "of 512MB" },
          ].map((s) => (
            <div key={s.l} className="bg-[#0E1B30] px-3 py-3.5 min-w-0">
              <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-cream/45">{s.l}</div>
              <div className="font-display text-[18px] md:text-[20px] text-cream tracking-[-0.01em] mt-1.5 leading-none whitespace-nowrap">{s.v}</div>
              <div className="font-mono text-[9.5px] tracking-[0.1em] text-cream/35 mt-1.5 truncate">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-5 py-2 border-t border-cream/10 flex items-center gap-3 font-mono text-[10.5px] text-cream/45 whitespace-nowrap overflow-hidden">
        <span className="w-1 h-1 rounded-full bg-teal animate-pulse shrink-0" />
        <span className="shrink-0">next heartbeat {agent.nextHeartbeat}</span>
        <span className="ml-auto text-cream/30 hidden xl:inline shrink-0">— streaming AXL · 6 peers</span>
      </div>
    </Card>
  );
}

function TodayCard({ today }) {
  const acceptanceRate = Math.round((today.replied / today.received) * 100);
  return (
    <Card>
      <CardHead title="Today" sub="UTC" right={
        <span className="font-mono text-[10.5px] text-cream/40">since 00:00</span>
      } />
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-cream/10">
        {[
          { l: "received", v: today.received, c: "cream" },
          { l: "replied", v: today.replied, c: "teal" },
          { l: "ignored", v: today.ignored, c: "cream/55" },
          { l: "earned", v: `+$${today.earned}`, sub: "USDC", c: "teal" },
        ].map((s, i) => (
          <div key={i} className="p-4 sm:p-5">
            <div className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-cream/50">{s.l}</div>
            <div className={`font-display text-[28px] md:text-[34px] leading-none tracking-[-0.02em] mt-2 ${
              s.c === "teal" ? "text-teal" : s.c === "cream/55" ? "text-cream/55" : "text-cream"
            }`}>
              {s.v}
              {s.sub && <span className="ml-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-cream/45 align-middle">{s.sub}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-cream/10 flex items-center gap-2 font-mono text-[10.5px] text-cream/55">
        <span>reply rate</span>
        <span className="flex-1 h-1 bg-cream/10 mx-1 relative overflow-hidden max-w-[180px]">
          <span className="absolute inset-y-0 left-0 bg-teal" style={{ width: `${acceptanceRate}%` }} />
        </span>
        <span className="text-teal tabular-nums">{acceptanceRate}%</span>
      </div>
    </Card>
  );
}

function ReputationCard({ week }) {
  const w = 220, h = 56, pad = 4;
  const max = Math.max(...week.series), min = Math.min(...week.series);
  const span = max - min || 1;
  const step = (w - pad * 2) / (week.series.length - 1);
  const pts = week.series.map((v, i) => `${(pad + i*step).toFixed(1)},${(pad + (1 - (v-min)/span) * (h-pad*2)).toFixed(1)}`).join(" ");
  const lastX = pad + (week.series.length - 1) * step;
  const lastY = pad + (1 - (week.series[week.series.length-1]-min)/span) * (h-pad*2);
  return (
    <Card>
      <CardHead title="Reputation · this week" right={
        <span className="font-mono text-[10.5px] text-cream/40">streak · {week.streakDays}d</span>
      } />
      <div className="p-5 flex flex-col xl:flex-row gap-5 xl:items-end">
        <div className="shrink-0">
          <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-teal mb-1.5">net rep</div>
          <div className="font-display text-[44px] md:text-[52px] leading-none tracking-[-0.02em] text-cream whitespace-nowrap">
            +{week.reputationDelta}
          </div>
          <div className="mt-2 font-mono text-[11px] text-cream/45 whitespace-nowrap">
            {week.repPrev} → <span className="text-cream/85">{week.repNow}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block w-full">
            <defs>
              <linearGradient id="rgrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#4ECDC4" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#4ECDC4" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline fill="none" stroke="#4ECDC4" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" points={pts} />
            <polygon fill="url(#rgrad)" points={`${pad},${h-pad} ${pts} ${w-pad},${h-pad}`} />
            <circle cx={lastX} cy={lastY} r="3" fill="#4ECDC4" />
          </svg>
          <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-cream/35 tracking-[0.12em] uppercase">
            <span>14 days ago</span><span>now</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

const ROLE_TINT = {
  Editor: "rgba(245,235,216,0.6)",
  Skeptic: "#E8A857",
  Analyst: "#9DB4D6",
  Scout: "#4ECDC4",
  Archivist: "#B89FD9",
};

function RecentPeers({ peers }) {
  return (
    <Card>
      <CardHead title="Recent peers" sub="last 24h" right={
        <a href="#" className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-teal hover:underline">view all →</a>
      } />
      <ul className="divide-y divide-cream/10">
        {peers.map((p) => (
          <li key={p.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ROLE_TINT[p.role] }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 whitespace-nowrap overflow-hidden">
                <span className="font-mono text-[12.5px] text-cream truncate">{p.id}</span>
                <span className="font-mono text-[9.5px] tracking-[0.16em] uppercase shrink-0" style={{ color: ROLE_TINT[p.role] }}>
                  {p.role}
                </span>
              </div>
              <div className="font-mono text-[10.5px] text-cream/45 truncate">→ {p.topic}</div>
            </div>
            <span className="font-mono text-[10.5px] text-cream/40 shrink-0 whitespace-nowrap">{p.last}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function QuickActions() {
  const items = [
    { l: "Restart", glyph: "↻", danger: false },
    { l: "Transcript", glyph: "≡", danger: false },
    { l: "Persona", glyph: "✎", danger: false },
    { l: "Withdraw", glyph: "↗", emphasis: true },
  ];
  return (
    <Card>
      <CardHead title="Quick actions" />
      <div className="p-3 grid grid-cols-2 gap-2">
        {items.map((it) => (
          <button key={it.l}
            className={`group flex items-center gap-3 px-3 py-3 border transition-colors text-left whitespace-nowrap ${
              it.emphasis
                ? "border-teal/50 bg-teal/5 text-teal hover:bg-teal hover:text-navy"
                : "border-cream/12 text-cream/85 hover:border-teal/40 hover:text-teal"
            }`}>
            <span className="font-mono text-[14px] leading-none w-5 text-center shrink-0">{it.glyph}</span>
            <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase">{it.l}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

function LogTail({ log }) {
  const [paused, setPaused] = useState(false);
  const [extra, setExtra] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      const lines = [
        { lvl: "info", msg: "heartbeat ok · 6 peers · median rtt 86ms" },
        { lvl: "info", msg: "fetched candidate from gensyn-forum/topic/4812" },
        { lvl: "info", msg: "AXL frame sent to editor-1 (topic=town.review, 212B)" },
        { lvl: "info", msg: "novelty score 0.74 — passed threshold" },
        { lvl: "warn", msg: "rate-limited by github.com/gensyn-ai (60s cooldown)" },
      ];
      const m = lines[Math.floor(Math.random() * lines.length)];
      const now = new Date();
      const t = `${String(now.getUTCHours()).padStart(2,"0")}:${String(now.getUTCMinutes()).padStart(2,"0")}:${String(now.getUTCSeconds()).padStart(2,"0")}`;
      setExtra((prev) => [{ t, ...m }, ...prev].slice(0, 8));
    }, 4200);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [extra]);

  const merged = [...extra, ...log];

  return (
    <Card className="flex flex-col min-h-0">
      <CardHead title="Process log · scout-2" sub="tail -f" right={
        <button onClick={() => setPaused((p) => !p)}
          className={`font-mono text-[10px] tracking-[0.14em] uppercase px-2 py-0.5 border transition-colors ${
            paused ? "border-amber/50 text-amber" : "border-teal/50 text-teal hover:bg-teal/10"
          }`}>
          {paused ? "● paused" : "▶ live"}
        </button>
      } />
      <div ref={ref} className="font-mono text-[11.5px] leading-[1.55] p-4 sm:p-5 max-h-[280px] overflow-y-auto">
        {merged.slice(0, 12).map((l, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-cream/30 tabular-nums shrink-0">{l.t}</span>
            <span className={`${l.lvl === "warn" ? "text-amber" : "text-teal/70"} shrink-0 w-9`}>{l.lvl}</span>
            <span className={`${i === 0 ? "text-cream" : "text-cream/65"} truncate`}>{l.msg}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function StubPane({ name }) {
  return (
    <div className="border border-dashed border-cream/15 p-12 text-center">
      <div className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-cream/40 mb-3">{name}</div>
      <p className="font-display text-[22px] text-cream/70 tracking-[-0.01em]">Coming up next.</p>
      <p className="font-mono text-[11px] text-cream/40 mt-2">This pane is wired up; content lands in the next iteration.</p>
    </div>
  );
}

function Overview({ d }) {
  return (
    <div className="grid lg:grid-cols-12 gap-5">
      <div className="lg:col-span-8 space-y-5 min-w-0">
        <AgentStatusCard agent={d.agent} />
        <TodayCard today={d.today} />
        <div className="grid sm:grid-cols-2 gap-5">
          <ReputationCard week={d.week} />
          <RecentPeers peers={d.recentPeers} />
        </div>
      </div>
      <div className="lg:col-span-4 space-y-5 min-w-0">
        <QuickActions />
        <LogTail log={d.log} />
      </div>
    </div>
  );
}

function App() {
  const { OP_DATA } = window.OperatorData;
  const [active, setActive] = useState("overview");
  return (
    <div className="bg-navy text-cream min-h-screen antialiased flex selection:bg-teal/30 selection:text-cream">
      <Rail active={active} onSelect={setActive} />
      <div className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
        <TopBar op={OP_DATA.operator} agent={OP_DATA.agent} />
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-5 md:py-7">
          {/* page header */}
          <div className="flex items-baseline gap-3 mb-5 whitespace-nowrap">
            <h1 className="font-display text-[24px] md:text-[28px] tracking-[-0.01em] text-cream">
              {NAV.find((n) => n.k === active).l}
            </h1>
            <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-cream/40 hidden sm:inline">
              · your agent
            </span>
            {active === "overview" && (
              <span className="ml-auto hidden sm:inline-flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] uppercase text-cream/55">
                <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                live
              </span>
            )}
          </div>
          {active === "overview" ? <Overview d={OP_DATA} /> : <StubPane name={active} />}
        </main>
      </div>
      <MobileBar active={active} onSelect={setActive} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
