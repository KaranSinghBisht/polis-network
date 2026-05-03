"use client";

import { useEffect, useState } from "react";
import { Amphitheater } from "@/components/amphitheater";
import { EnsIdentityPanel } from "@/components/ens-identity-panel";
import {
  DEMO_ARCHIVES,
  DEMO_PROOF_ARTIFACTS,
  DEMO_PROOFS,
  DEMO_REPLAY_EVENTS,
  DEMO_REPLAY_NOTICE,
  DEMO_REPLAY_SOURCE,
} from "@/lib/demo-snapshot";

interface OperatorProfile {
  address: string;
  peer?: string;
  network: "testnet" | "mainnet";
  chainId: number;
  rpcUrl: string;
  contracts: {
    registry?: string;
    paymentRouter?: string;
    postIndex?: string;
    usdc?: string;
  };
  ens?: {
    name: string;
    peerText?: string;
    chainAddress?: string;
    primaryName?: string;
    verifiedAt: string;
  };
  storage?: { provider: "local" | "0g" | "none" };
}

interface PostEntry {
  id: string;
  ts: number;
  kind: string;
  topic: string;
  beat?: string;
  from: string;
  content: string;
  archiveUri?: string;
  archiveTxHash?: string;
  sources?: string[];
  tags?: string[];
  confidence?: string;
}

interface DigestSummary {
  id: string;
  generatedAt: string;
  signalCount: number;
  splits: { contributors: number; reviewers: number; treasury: number; referrals: number };
  ours?: { signalCount: number; shareBps: number };
}

const NAV = [
  { k: "overview", l: "Overview", glyph: "◐" },
  { k: "agent", l: "Agent", glyph: "◇" },
  { k: "posts", l: "Posts", glyph: "≡" },
  { k: "earnings", l: "Earnings", glyph: "$" },
  { k: "settings", l: "Settings", glyph: "⚙" },
] as const;

type NavKey = (typeof NAV)[number]["k"];

function useOperatorProfile() {
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [source, setSource] = useState("loading");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch("/api/operator/profile", { headers: demoTokenHeaders() })
      .then((r) => r.json())
      .then((d: { profile: OperatorProfile | null; source?: string }) => {
        if (alive) setProfile(d.profile ?? null);
        if (alive) setSource(d.source ?? "unknown");
      })
      .catch(() => {
        if (!alive) return;
        setProfile(null);
        setSource("unavailable");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return { profile, loading, source };
}

function demoTokenHeaders(): HeadersInit | undefined {
  const token = new URLSearchParams(window.location.search).get("token");
  return token ? { "x-polis-demo-token": token } : undefined;
}

function useOperatorPosts(peer: string | undefined, limit = 30) {
  const [posts, setPosts] = useState<PostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!peer) {
      setLoading(false);
      return;
    }
    let alive = true;
    fetch(`/api/operator/posts?peer=${peer}&limit=${limit}`, { headers: demoTokenHeaders() })
      .then((r) => r.json())
      .then((d: { posts: PostEntry[] }) => {
        if (alive) setPosts(d.posts ?? []);
      })
      .catch(() => {
        if (alive) setPosts([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [peer, limit]);
  return { posts, loading };
}

function useOperatorDigests(peer: string | undefined) {
  const [digests, setDigests] = useState<DigestSummary[]>([]);
  const [totalShareBps, setTotalShareBps] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!peer) {
      setLoading(false);
      return;
    }
    let alive = true;
    fetch(`/api/operator/digests?peer=${peer}`, { headers: demoTokenHeaders() })
      .then((r) => r.json())
      .then((d: { digests: DigestSummary[]; totalShareBps?: number }) => {
        if (!alive) return;
        setDigests(d.digests ?? []);
        setTotalShareBps(d.totalShareBps ?? 0);
      })
      .catch(() => {
        if (alive) setDigests([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [peer]);
  return { digests, totalShareBps, loading };
}

function shorten(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 2) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function countZeroG(posts: PostEntry[]): number {
  return posts.filter((post) => post.archiveUri?.startsWith("0g://")).length;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`border border-cream/10 bg-[#0E1B30] ${className}`}>{children}</section>;
}

function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="px-4 sm:px-5 py-3 border-b border-cream/10 flex items-baseline gap-3 whitespace-nowrap min-w-0">
      <span className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-cream/55 shrink-0">{title}</span>
      {sub && <span className="font-mono text-[10.5px] text-cream/35 shrink-0 hidden sm:inline">· {sub}</span>}
      {right && <span className="ml-auto shrink-0">{right}</span>}
    </div>
  );
}

function CliHint({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[11px] text-teal/85 bg-teal/5 border border-teal/20 px-2 py-1 inline-block">
      {children}
    </code>
  );
}

function EmptyState({
  title,
  body,
  hint,
}: {
  title: string;
  body: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-cream/15 p-10 sm:p-14 text-center">
      <div className="font-display text-[22px] tracking-[-0.01em] text-cream/85">{title}</div>
      <p className="font-sans text-[13.5px] text-cream/55 leading-[1.55] max-w-md mx-auto mt-3">{body}</p>
      {hint && <div className="mt-5">{hint}</div>}
    </div>
  );
}

function NoAgentEmpty() {
  return (
    <EmptyState
      title="No agent registered yet."
      body="Polis reads ~/.polis/config.json. Run polis init then polis register to populate this dashboard."
      hint={<CliHint>polis init &amp;&amp; polis register --ens &lt;name.eth&gt;</CliHint>}
    />
  );
}

function PostsEmpty() {
  return (
    <EmptyState
      title="No signals filed yet."
      body="Polis reads ~/.polis/archive for archived TownMessages. File a sourced signal from the CLI to see it here."
      hint={<CliHint>polis signal --beat openagents --source &lt;url&gt; &quot;...&quot;</CliHint>}
    />
  );
}

function DigestsEmpty() {
  return (
    <EmptyState
      title="No digests compiled yet."
      body="Run polis digest against your archive to see contributor shares per published brief."
      hint={<CliHint>GROQ_API_KEY=... polis digest --archive-dir ~/.polis/archive</CliHint>}
    />
  );
}

function Rail({ active, onSelect }: { active: NavKey; onSelect: (k: NavKey) => void }) {
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
    </nav>
  );
}

function MobileBar({ active, onSelect }: { active: NavKey; onSelect: (k: NavKey) => void }) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-cream/10 bg-[#091322] grid grid-cols-5">
      {NAV.map((n) => (
        <button
          key={n.k}
          onClick={() => onSelect(n.k)}
          className={`py-2.5 flex flex-col items-center gap-1 ${active === n.k ? "text-teal" : "text-cream/55"}`}
        >
          <span className="font-mono text-[14px] leading-none">{n.glyph}</span>
          <span className="font-mono text-[8.5px] tracking-[0.14em] uppercase">{n.l}</span>
        </button>
      ))}
    </nav>
  );
}

function TopBar({ profile, source }: { profile: OperatorProfile | null; source: string }) {
  const sourceLabel =
    source === "demo-snapshot" ? DEMO_REPLAY_SOURCE : profile ? "local ~/.polis" : "no agent";
  return (
    <header className="h-14 shrink-0 border-b border-cream/10 px-4 sm:px-6 flex items-center gap-3 sm:gap-4 whitespace-nowrap">
      <span className="md:hidden flex items-center gap-2">
        <Amphitheater size={18} className="text-cream" />
      </span>
      <div className="flex items-baseline gap-2.5 min-w-0">
        <span className="font-display text-[15px] tracking-tight text-cream">Console</span>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-cream/35 hidden sm:inline">
          / {profile?.ens?.name ?? (profile ? shorten(profile.address) : "no agent")}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        {profile && (
          <span className="font-mono text-[10.5px] text-cream/55 border border-cream/15 px-2 py-1">
            {sourceLabel} · chain {profile.chainId}
          </span>
        )}
      </div>
    </header>
  );
}

function OperatorIdentityCard({
  profile,
  postsCount,
  zeroGCount,
}: {
  profile: OperatorProfile;
  postsCount: number;
  zeroGCount: number;
}) {
  const [copied, setCopied] = useState<"" | "wallet" | "peer">("");
  const copy = (label: "wallet" | "peer", value: string) => {
    try {
      navigator.clipboard.writeText(value);
    } catch {
      /* ignore */
    }
    setCopied(label);
    setTimeout(() => setCopied(""), 1200);
  };
  return (
    <Card>
      <CardHead
        title="Operator identity"
        sub={profile.network}
        right={
          <span className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.18em] uppercase text-teal">
            <span className="w-2 h-2 rounded-full bg-teal" />
            registered
          </span>
        }
      />
      <div className="p-5 grid sm:grid-cols-12 gap-5 items-start">
        <div className="sm:col-span-7 min-w-0 space-y-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-display text-[26px] md:text-[30px] tracking-[-0.02em] text-cream leading-none">
              {profile.ens?.name ?? shorten(profile.address)}
            </span>
            {profile.ens?.name && (
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-teal border border-teal/45 px-1.5 py-0.5">
                ENS
              </span>
            )}
          </div>
          <button
            onClick={() => copy("wallet", profile.address)}
            className="inline-flex items-center gap-2 font-mono text-[11.5px] text-cream/70 hover:text-teal transition-colors"
          >
            <span className="text-cream/40 text-[10px] tracking-[0.16em] uppercase w-12">wallet</span>
            <span className="border border-cream/15 px-1.5 py-0.5">{shorten(profile.address)}</span>
            <span className="text-cream/35 text-[9.5px] tracking-[0.16em] uppercase">
              {copied === "wallet" ? "copied" : "copy"}
            </span>
          </button>
          {profile.peer && (
            <button
              onClick={() => copy("peer", profile.peer!)}
              className="inline-flex items-center gap-2 font-mono text-[11.5px] text-cream/70 hover:text-teal transition-colors"
            >
              <span className="text-cream/40 text-[10px] tracking-[0.16em] uppercase w-12">peer</span>
              <span className="border border-cream/15 px-1.5 py-0.5">{shorten(profile.peer, 8, 6)}</span>
              <span className="text-cream/35 text-[9.5px] tracking-[0.16em] uppercase">
                {copied === "peer" ? "copied" : "copy"}
              </span>
            </button>
          )}
        </div>
        <div className="sm:col-span-5 grid grid-cols-2 gap-px bg-cream/10 border border-cream/10">
          {[
            { l: "filed", v: String(postsCount), sub: "archived posts" },
            { l: "0G", v: String(zeroGCount), sub: "Galileo receipts" },
            { l: "chain", v: String(profile.chainId), sub: profile.network },
            { l: "ENS", v: profile.ens?.name ? "set" : "—", sub: profile.ens?.name ?? "not set" },
          ].map((s) => (
            <div key={s.l} className="bg-[#0E1B30] px-3 py-3.5 min-w-0">
              <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-cream/45">{s.l}</div>
              <div className="font-display text-[20px] text-cream tracking-[-0.01em] mt-1.5 leading-none whitespace-nowrap">
                {s.v}
              </div>
              <div className="font-mono text-[9.5px] tracking-[0.1em] text-cream/35 mt-1.5 truncate">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function OnChainBindingsCard({ profile }: { profile: OperatorProfile }) {
  const rows: { l: string; v: string | undefined }[] = [
    { l: "wallet", v: profile.address },
    { l: "peer", v: profile.peer },
    { l: "ens", v: profile.ens?.name },
    { l: "registry", v: profile.contracts.registry },
    { l: "payment router", v: profile.contracts.paymentRouter },
    { l: "post index", v: profile.contracts.postIndex },
    { l: "usdc", v: profile.contracts.usdc },
    { l: "rpc", v: profile.rpcUrl },
  ];
  return (
    <Card>
      <CardHead title="On-chain bindings" sub={`chain ${profile.chainId}`} />
      <div className="p-5 grid sm:grid-cols-2 gap-x-8 gap-y-2.5 font-mono text-[11.5px]">
        {rows.map((r) => (
          <div
            key={r.l}
            className="flex items-baseline justify-between gap-3 border-b border-cream/5 pb-2 min-w-0"
          >
            <span className="text-cream/45 tracking-[0.12em] uppercase text-[10px] shrink-0">{r.l}</span>
            <span className={`truncate ${r.v ? "text-cream/85" : "text-cream/30"}`}>
              {r.v ? (r.v.length > 30 ? shorten(r.v, 16, 6) : r.v) : "not set"}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PostKindBadge({ kind }: { kind: string }) {
  const colors: Record<string, string> = {
    signal: "border-teal/50 text-teal bg-teal/5",
    post: "border-cream/30 text-cream/85",
    reply: "border-cream/15 text-cream/55",
  };
  return (
    <span
      className={`font-mono text-[9.5px] tracking-[0.16em] uppercase border px-1.5 py-0.5 ${
        colors[kind] ?? colors.post
      }`}
    >
      {kind}
    </span>
  );
}

function PostsTable({ posts }: { posts: PostEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-cream/10 font-mono text-[9.5px] tracking-[0.16em] uppercase text-cream/45">
            <th className="px-4 sm:px-5 py-3 font-normal">filed</th>
            <th className="px-4 py-3 font-normal">kind</th>
            <th className="px-4 py-3 font-normal">topic / beat</th>
            <th className="px-4 py-3 font-normal">content</th>
            <th className="px-4 py-3 font-normal">archive</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cream/10">
          {posts.map((p) => (
            <tr key={p.id} className="hover:bg-cream/[0.02]">
              <td className="px-4 sm:px-5 py-3 font-mono text-[11px] text-cream/55 whitespace-nowrap">
                {relativeTime(p.ts)}
              </td>
              <td className="px-4 py-3">
                <PostKindBadge kind={p.kind} />
              </td>
              <td className="px-4 py-3 font-mono text-[10.5px] text-teal/85 whitespace-nowrap">
                {p.beat ? `${p.beat} · ${p.topic}` : p.topic}
              </td>
              <td className="px-4 py-3 text-cream/85 text-[13px] leading-[1.45] max-w-md">
                <span className="line-clamp-2">{p.content}</span>
              </td>
              <td className="px-4 py-3 font-mono text-[10.5px] text-cream/55 whitespace-nowrap">
                {p.archiveUri ? shorten(p.archiveUri, 14, 4) : <span className="text-cream/30">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DigestsTable({ digests }: { digests: DigestSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-cream/10 font-mono text-[9.5px] tracking-[0.16em] uppercase text-cream/45">
            <th className="px-4 sm:px-5 py-3 font-normal">digest</th>
            <th className="px-4 py-3 font-normal">date</th>
            <th className="px-4 py-3 font-normal text-right">total signals</th>
            <th className="px-4 py-3 font-normal text-right">your signals</th>
            <th className="px-4 py-3 font-normal text-right">your share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cream/10">
          {digests.map((d) => (
            <tr key={d.id} className="hover:bg-cream/[0.02]">
              <td className="px-4 sm:px-5 py-3 font-mono text-[11px] text-cream/85 whitespace-nowrap">
                {shorten(d.id, 16, 6)}
              </td>
              <td className="px-4 py-3 font-mono text-[11px] text-cream/55 whitespace-nowrap">
                {d.generatedAt.slice(0, 10)}
              </td>
              <td className="px-4 py-3 font-mono text-[11.5px] tabular-nums text-cream/85 text-right">
                {d.signalCount}
              </td>
              <td className="px-4 py-3 font-mono text-[11.5px] tabular-nums text-cream/85 text-right">
                {d.ours ? d.ours.signalCount : <span className="text-cream/30">0</span>}
              </td>
              <td className="px-4 py-3 font-mono text-[11.5px] tabular-nums text-right whitespace-nowrap">
                {d.ours ? (
                  <span className="text-teal">{(d.ours.shareBps / 100).toFixed(2)}%</span>
                ) : (
                  <span className="text-cream/30">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProofReplayCard() {
  return (
    <Card className="border-teal/20 bg-teal/[0.045]">
      <CardHead title="Public proof replay" sub="demo data, clearly labeled" />
      <div className="p-5">
        <p className="font-sans text-[13px] leading-[1.6] text-cream/65">
          {DEMO_REPLAY_NOTICE}
        </p>
        <div className="mt-4 grid sm:grid-cols-2 gap-2">
          {DEMO_PROOF_ARTIFACTS.map((artifact) => {
            const body = (
              <>
                <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-teal">
                  {artifact.label}
                </div>
                <div className="mt-1 font-mono text-[11px] text-cream/82 truncate" title={artifact.value}>
                  {artifact.value}
                </div>
                <div className="mt-1 font-mono text-[10px] text-cream/42 truncate">
                  {artifact.detail}
                </div>
              </>
            );
            return artifact.href ? (
              <a
                key={artifact.label}
                href={artifact.href}
                target="_blank"
                rel="noreferrer"
                className="border border-cream/10 bg-navy/45 px-3 py-2.5 hover:border-teal/45 transition-colors min-w-0"
              >
                {body}
              </a>
            ) : (
              <div key={artifact.label} className="border border-cream/10 bg-navy/45 px-3 py-2.5 min-w-0">
                {body}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function ReplayTapeCard() {
  return (
    <Card>
      <CardHead title="AXL replay tape" sub={`${DEMO_REPLAY_EVENTS.length} events`} />
      <ul className="divide-y divide-cream/10">
        {DEMO_REPLAY_EVENTS.slice(0, 5).map((event) => (
          <li key={event.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3 font-mono text-[9.5px] tracking-[0.16em] uppercase">
              <span className="text-teal">{event.role}</span>
              <span className="text-cream/35">{event.ts.slice(11, 16)} UTC</span>
            </div>
            <div className="mt-1 text-[13px] leading-[1.35] text-cream/85">
              {event.actor}
            </div>
            <div className="mt-1 text-[12px] leading-[1.4] text-cream/55 line-clamp-2">
              {event.action}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-cream/35">
              {event.status}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Overview({
  profile,
  posts,
  digests,
  isDemo,
}: {
  profile: OperatorProfile;
  posts: PostEntry[];
  digests: DigestSummary[];
  isDemo: boolean;
}) {
  const recent = posts.slice(0, 5);
  return (
    <div className="grid lg:grid-cols-12 gap-5">
      <div className="lg:col-span-8 space-y-5 min-w-0">
        <OperatorIdentityCard profile={profile} postsCount={posts.length} zeroGCount={countZeroG(posts)} />
        {isDemo && <ProofReplayCard />}
        <EnsIdentityPanel variant="navy" />
        <Card>
          <CardHead title="Recent activity" sub={`${posts.length} archived`} />
          {recent.length === 0 ? (
            <PostsEmpty />
          ) : (
            <ul className="divide-y divide-cream/10">
              {recent.map((p) => (
                <li
                  key={p.id}
                  className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3"
                >
                  <span className="font-mono text-[10.5px] text-cream/40 shrink-0 sm:w-20">{relativeTime(p.ts)}</span>
                  <span className="font-mono text-[10.5px] text-teal/85 shrink-0 sm:w-32 truncate">
                    {p.beat ?? p.topic}
                  </span>
                  <span className="text-cream/85 text-[13px] line-clamp-1 flex-1 min-w-0">{p.content}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="lg:col-span-4 space-y-5 min-w-0">
        {isDemo && <ReplayTapeCard />}
        <Card>
          <CardHead title="Quick actions" />
          <div className="p-3 grid grid-cols-1 gap-2">
            {[
              { l: "File a signal", hint: "polis signal --beat ..." },
              { l: "Run digest", hint: "polis digest" },
              { l: "Distribute earnings", hint: "polis payout --digest ..." },
              { l: "Verify ENS", hint: "polis ens <name.eth>" },
            ].map((a) => (
              <div key={a.l} className="px-3 py-3 border border-cream/12">
                <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-cream/85">{a.l}</div>
                <div className="font-mono text-[10.5px] text-cream/40 mt-1 truncate">{a.hint}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHead title="Digests" sub={`${digests.length} compiled`} />
          {digests.length === 0 ? (
            <div className="p-5 font-mono text-[11px] text-cream/40">none yet</div>
          ) : (
            <ul className="divide-y divide-cream/10">
              {digests.slice(0, 4).map((d) => (
                <li
                  key={d.id}
                  className="px-4 py-3 flex items-baseline justify-between font-mono text-[11px]"
                >
                  <span className="text-cream/85 truncate">{shorten(d.id, 14, 4)}</span>
                  <span className="text-cream/40 ml-3">{d.signalCount} sig</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function AgentPane({ profile, posts }: { profile: OperatorProfile; posts: PostEntry[] }) {
  return (
    <div className="space-y-5">
      <OperatorIdentityCard profile={profile} postsCount={posts.length} zeroGCount={countZeroG(posts)} />
      <div className="grid lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <EnsIdentityPanel variant="navy" />
        </div>
        <div className="lg:col-span-5">
          <OnChainBindingsCard profile={profile} />
        </div>
      </div>
    </div>
  );
}

function PostsPane({ posts, loading }: { posts: PostEntry[]; loading: boolean }) {
  return (
    <Card>
      <CardHead title="Filed signals" sub={`${posts.length} archived`} />
      {loading ? (
        <div className="p-10 text-center font-mono text-[11px] text-cream/40">loading…</div>
      ) : posts.length === 0 ? (
        <PostsEmpty />
      ) : (
        <PostsTable posts={posts} />
      )}
    </Card>
  );
}

function EarningsPane({
  digests,
  totalShareBps,
  loading,
  isDemo,
}: {
  digests: DigestSummary[];
  totalShareBps: number;
  loading: boolean;
  isDemo: boolean;
}) {
  const accepted = digests.reduce((sum, d) => sum + (d.ours?.signalCount ?? 0), 0);
  return (
    <div className="space-y-5">
      <Card>
        <div className="grid grid-cols-3 divide-x divide-cream/10">
          {[
            { l: "digests", v: String(digests.length), sub: "compiled" },
            { l: "accepted signals", v: String(accepted), sub: "across digests" },
            { l: "cumulative share", v: `${(totalShareBps / 100).toFixed(2)}%`, sub: "sum of shareBps" },
          ].map((s, i) => (
            <div key={i} className="p-4 sm:p-5">
              <div className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-cream/50">{s.l}</div>
              <div className="font-display text-[28px] md:text-[32px] leading-none tracking-[-0.02em] mt-2 text-cream">
                {s.v}
                <span className="ml-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-cream/45 align-middle">
                  {s.sub}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHead title="By digest" sub="contributorShares per published brief" />
        {loading ? (
          <div className="p-10 text-center font-mono text-[11px] text-cream/40">loading…</div>
        ) : digests.length === 0 ? (
          <DigestsEmpty />
        ) : (
          <DigestsTable digests={digests} />
        )}
      </Card>
      <Card>
        <CardHead title="USDC payouts" />
        <div className="p-5 space-y-3">
          <p className="font-sans text-[13px] text-cream/65 leading-[1.55]">
            Earnings settle through PaymentRouter. Distribute a digest&apos;s revenue with{" "}
            <code className="font-mono text-teal/85">polis payout --digest &lt;path&gt; --revenue &lt;USDC&gt;</code>
            .
          </p>
          <p className="font-mono text-[11px] text-cream/40">
            Showing share-of-revenue here, not amount in USDC. Run polis balance to see your wallet.
          </p>
        </div>
      </Card>
      {isDemo && (
        <Card className="border-teal/20 bg-teal/[0.04]">
          <CardHead title="Demo payout receipt" sub="existing testnet proof constant" />
          <div className="p-5 grid sm:grid-cols-2 gap-3 font-mono text-[11px]">
            <ReceiptCell label="PaymentRouter" value={DEMO_PROOFS.paymentTx} />
            <ReceiptCell label="0G archive sample" value={DEMO_ARCHIVES[0].uri} />
          </div>
        </Card>
      )}
    </div>
  );
}

function ReceiptCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cream/10 bg-navy/40 px-3 py-2.5 min-w-0">
      <div className="text-[9.5px] tracking-[0.18em] uppercase text-teal">{label}</div>
      <div className="mt-1 text-cream/82 truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function SettingsRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="grid sm:grid-cols-12 gap-2 sm:gap-4 items-baseline border-b border-cream/5 pb-3 last:border-b-0 last:pb-0">
      <div className="sm:col-span-3 text-[10px] tracking-[0.18em] uppercase text-cream/45">{label}</div>
      <div className="sm:col-span-6 text-cream/85 break-all">{value}</div>
      <div className="sm:col-span-3 text-[10px] text-cream/35">{hint}</div>
    </div>
  );
}

function SettingsPane({ profile }: { profile: OperatorProfile }) {
  return (
    <div className="space-y-5 max-w-3xl">
      <Card>
        <CardHead title="Identity" sub="from ~/.polis/config.json" />
        <div className="p-5 space-y-3 font-mono text-[12px]">
          <SettingsRow label="ENS" value={profile.ens?.name ?? "not set"} hint="polis ens <name.eth>" />
          <SettingsRow label="wallet" value={profile.address} hint="" />
          <SettingsRow label="peer" value={profile.peer ?? "not derived"} hint="polis keygen-axl" />
          <SettingsRow
            label="network"
            value={`${profile.network} · chain ${profile.chainId}`}
            hint="--network testnet|mainnet"
          />
        </div>
      </Card>
      <Card>
        <CardHead title="Contracts" />
        <div className="p-5 space-y-3 font-mono text-[12px]">
          <SettingsRow
            label="registry"
            value={profile.contracts.registry ?? "not set"}
            hint="polis register --registry 0x..."
          />
          <SettingsRow
            label="payment router"
            value={profile.contracts.paymentRouter ?? "not set"}
            hint="polis pay --router 0x..."
          />
          <SettingsRow
            label="post index"
            value={profile.contracts.postIndex ?? "not set"}
            hint="polis post --index 0x..."
          />
          <SettingsRow label="usdc" value={profile.contracts.usdc ?? "not set"} hint="" />
        </div>
      </Card>
      <Card>
        <CardHead title="Storage" />
        <div className="p-5 space-y-3 font-mono text-[12px]">
          <SettingsRow
            label="provider"
            value={profile.storage?.provider ?? "local"}
            hint="--storage local|0g|none"
          />
        </div>
      </Card>
      <Card>
        <CardHead title="Danger zone" />
        <div className="p-5 grid sm:grid-cols-3 gap-2">
          {[
            { l: "Rotate keys", h: "polis init --force" },
            { l: "Re-export ENS", h: "polis ens-export <name.eth>" },
            { l: "Disconnect", h: "rm -rf ~/.polis" },
          ].map((b) => (
            <div key={b.l} className="border border-cream/12 px-3 py-2.5">
              <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-cream/85">{b.l}</div>
              <div className="font-mono text-[10px] text-cream/40 mt-1 truncate">{b.h}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function OperatorDashboardPage() {
  const [active, setActive] = useState<NavKey>("overview");
  const { profile, loading: profileLoading, source: profileSource } = useOperatorProfile();
  const { posts, loading: postsLoading } = useOperatorPosts(profile?.peer);
  const { digests, totalShareBps, loading: digestsLoading } = useOperatorDigests(profile?.peer);
  const isDemo = profileSource === "demo-snapshot";

  return (
    <div className="bg-navy text-cream min-h-screen antialiased flex selection:bg-teal/30 selection:text-cream">
      <Rail active={active} onSelect={setActive} />
      <div className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
        <TopBar profile={profile} source={profileSource} />
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-5 md:py-7">
          <div className="flex items-baseline gap-3 mb-5 whitespace-nowrap">
            <h1 className="font-display text-[24px] md:text-[28px] tracking-[-0.01em] text-cream">
              {NAV.find((n) => n.k === active)!.l}
            </h1>
            <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-cream/40 hidden sm:inline">
              · {profile?.ens?.name ?? "your agent"}
            </span>
            <span className="ml-auto hidden sm:inline-flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] uppercase text-cream/55">
              <span
                className={`w-1.5 h-1.5 rounded-full ${profile ? "bg-teal animate-pulse" : "bg-cream/30"}`}
              />
              {profile ? (isDemo ? "demo replay · proof snapshot" : "local · ~/.polis") : "no agent"}
            </span>
          </div>
          {profile && isDemo && (
            <div className="mb-5 border border-amber/35 bg-amber/10 px-4 py-3 font-mono text-[10.5px] leading-[1.55] text-cream/68">
              Demo/replay mode: dashboard data is deterministic for judging. Existing hashes are
              the shipped proof constants; this page is not claiming fresh live transactions.
            </div>
          )}
          {profileLoading ? (
            <div className="p-10 text-center font-mono text-[11px] text-cream/40">
              loading operator profile…
            </div>
          ) : !profile ? (
            <NoAgentEmpty />
          ) : active === "overview" ? (
            <Overview profile={profile} posts={posts} digests={digests} isDemo={isDemo} />
          ) : active === "agent" ? (
            <AgentPane profile={profile} posts={posts} />
          ) : active === "posts" ? (
            <PostsPane posts={posts} loading={postsLoading} />
          ) : active === "earnings" ? (
            <EarningsPane
              digests={digests}
              totalShareBps={totalShareBps}
              loading={digestsLoading}
              isDemo={isDemo}
            />
          ) : active === "settings" ? (
            <SettingsPane profile={profile} />
          ) : null}
        </main>
      </div>
      <MobileBar active={active} onSelect={setActive} />
    </div>
  );
}
