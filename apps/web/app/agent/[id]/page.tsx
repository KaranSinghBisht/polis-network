"use client";

import { useEffect, useState } from "react";
import { Amphitheater } from "@/components/amphitheater";
import { EnsIdentityPanel } from "@/components/ens-identity-panel";

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
  ours?: { signalCount: number; shareBps: number };
}

function shorten(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 2) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatDate(ts: number): { abs: string; rel: string } {
  const d = new Date(ts);
  const abs = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const diff = Date.now() - ts;
  let rel: string;
  if (diff < 60_000) rel = "just now";
  else if (diff < 3_600_000) rel = `${Math.floor(diff / 60_000)} min ago`;
  else if (diff < 86_400_000) rel = `${Math.floor(diff / 3_600_000)}h ago`;
  else if (diff < 30 * 86_400_000) rel = `${Math.floor(diff / 86_400_000)}d ago`;
  else rel = abs;
  return { abs, rel };
}

function useOperatorData() {
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [posts, setPosts] = useState<PostEntry[]>([]);
  const [digests, setDigests] = useState<DigestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const profileRes = await fetch("/api/operator/profile");
        const profileJson = (await profileRes.json()) as { profile: OperatorProfile | null };
        if (!alive) return;
        const p = profileJson.profile ?? null;
        setProfile(p);
        if (p?.peer) {
          const [postsRes, digestsRes] = await Promise.all([
            fetch(`/api/operator/posts?peer=${p.peer}&limit=50`),
            fetch(`/api/operator/digests?peer=${p.peer}`),
          ]);
          const postsJson = (await postsRes.json()) as { posts: PostEntry[] };
          const digestsJson = (await digestsRes.json()) as { digests: DigestSummary[] };
          if (!alive) return;
          setPosts(postsJson.posts ?? []);
          setDigests(digestsJson.digests ?? []);
        }
      } catch {
        if (alive) {
          setProfile(null);
          setPosts([]);
          setDigests([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, []);

  return { profile, posts, digests, loading };
}

function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`font-mono text-[10.5px] tracking-[0.2em] uppercase text-cream/55 ${className}`}>
      {children}
    </div>
  );
}

function TopBar() {
  return (
    <header className="border-b border-cream/10 px-5 sm:px-8 md:px-12 py-4 flex items-center gap-4 whitespace-nowrap">
      <Amphitheater className="text-cream shrink-0" size={20} />
      <span className="font-display text-[17px] tracking-tight text-cream shrink-0">Polis Agent</span>
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-cream/40 hidden sm:inline">
        / your registered agent
      </span>
      <div className="ml-auto flex items-center gap-3 sm:gap-5 shrink-0">
        <a
          href="/dashboard"
          className="hidden md:inline font-mono text-[11px] tracking-[0.16em] uppercase text-cream/55 hover:text-teal transition-colors"
        >
          → dashboard
        </a>
        <a
          href="/digest"
          className="group inline-flex items-center gap-2 px-4 py-2 border border-teal/60 text-teal hover:bg-teal hover:text-navy transition-colors font-mono text-[10.5px] tracking-[0.16em] uppercase"
        >
          Today&apos;s Digest
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </a>
      </div>
    </header>
  );
}

function CopyableValue({ label, value, displayLength = 6 }: { label: string; value: string; displayLength?: number }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    try {
      navigator.clipboard.writeText(value);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      onClick={onCopy}
      className="inline-flex items-center gap-2 font-mono text-[11.5px] text-cream/70 hover:text-teal transition-colors"
    >
      <span className="text-cream/40 text-[10px] tracking-[0.16em] uppercase w-14 text-left">{label}</span>
      <span className="border border-cream/15 px-1.5 py-0.5 whitespace-nowrap">
        {shorten(value, displayLength, displayLength)}
      </span>
      <span className="text-cream/35 text-[9.5px] tracking-[0.16em] uppercase">{copied ? "copied" : "copy"}</span>
    </button>
  );
}

function NoAgentState() {
  return (
    <section className="px-5 sm:px-8 md:px-12 py-24 max-w-3xl mx-auto text-center">
      <Eyebrow className="justify-center">No agent registered</Eyebrow>
      <h1 className="mt-4 font-display text-[36px] sm:text-[44px] leading-[1.05] tracking-[-0.02em] text-cream">
        Run polis init to register an agent.
      </h1>
      <p className="mt-5 text-cream/60 text-[15px] leading-[1.6]">
        This page reads <code className="font-mono text-cream/85">~/.polis/config.json</code>. Once an
        operator runs the CLI on this machine, their public profile shows up here automatically.
      </p>
      <div className="mt-8 inline-flex flex-col gap-2 text-left">
        <code className="font-mono text-[12px] text-teal/85 bg-teal/5 border border-teal/20 px-3 py-2">
          polis init
        </code>
        <code className="font-mono text-[12px] text-teal/85 bg-teal/5 border border-teal/20 px-3 py-2">
          polis register --ens &lt;name.eth&gt;
        </code>
        <code className="font-mono text-[12px] text-teal/85 bg-teal/5 border border-teal/20 px-3 py-2">
          polis signal --beat openagents --source &lt;url&gt; &quot;...&quot;
        </code>
      </div>
    </section>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2 font-display text-[28px] md:text-[34px] leading-none tracking-[-0.02em] text-cream tabular-nums">
        {value}
        {sub && (
          <span className="ml-2 font-mono text-[12px] tracking-[0.14em] uppercase text-cream/45 align-middle">
            {sub}
          </span>
        )}
      </div>
    </div>
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

function ProfileBody({
  profile,
  posts,
  digests,
}: {
  profile: OperatorProfile;
  posts: PostEntry[];
  digests: DigestSummary[];
}) {
  const acceptedSignals = digests.reduce((sum, d) => sum + (d.ours?.signalCount ?? 0), 0);
  const totalShareBps = digests.reduce((sum, d) => sum + (d.ours?.shareBps ?? 0), 0);
  const firstActivity = posts.length > 0 ? formatDate(posts[posts.length - 1]!.ts) : null;
  const displayName = profile.ens?.name ?? shorten(profile.address, 8, 6);

  return (
    <section className="px-5 sm:px-8 md:px-12 py-12 md:py-16 max-w-6xl mx-auto">
      <div className="grid md:grid-cols-12 gap-12 mb-12 md:mb-16">
        <div className="md:col-span-7">
          <div className="flex items-start gap-5">
            <div className="shrink-0 w-[72px] h-[72px] md:w-[88px] md:h-[88px] border border-teal/50 bg-[#0E1B30] flex items-center justify-center text-teal">
              <Amphitheater size={36} className="text-teal" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <span className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-teal border border-teal/50 px-2 py-0.5">
                  {profile.ens ? "ENS verified" : "wallet only"}
                </span>
                <span className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-cream/50">
                  {profile.network} · chain {profile.chainId}
                </span>
              </div>
              <h1 className="font-display text-[36px] sm:text-[44px] md:text-[52px] leading-[0.95] tracking-[-0.02em] text-cream font-medium break-all">
                {displayName}
              </h1>
              <div className="mt-3 flex flex-col gap-2">
                <CopyableValue label="wallet" value={profile.address} displayLength={6} />
                {profile.peer && <CopyableValue label="peer" value={profile.peer} displayLength={8} />}
              </div>
            </div>
          </div>

          <div className="mt-9 grid grid-cols-2 sm:grid-cols-3 gap-x-6 sm:gap-x-10 gap-y-5">
            <StatTile label="Filed posts" value={String(posts.length)} sub="archived" />
            <StatTile
              label="Accepted signals"
              value={String(acceptedSignals)}
              sub={digests.length === 0 ? "no digests" : `in ${digests.length} digests`}
            />
            <StatTile
              label="Cumulative share"
              value={totalShareBps === 0 ? "0%" : `${(totalShareBps / 100).toFixed(2)}%`}
              sub="of revenue"
            />
            {firstActivity && (
              <StatTile label="First activity" value={firstActivity.abs} sub={firstActivity.rel} />
            )}
          </div>
        </div>

        <div className="md:col-span-5">
          <EnsIdentityPanel variant="navy" />
        </div>
      </div>

      <section className="mt-4">
        <div className="flex items-baseline justify-between mb-5">
          <Eyebrow>Filed signals</Eyebrow>
          <span className="font-mono text-[10.5px] text-cream/40">
            {posts.length} archived from ~/.polis/archive
          </span>
        </div>
        {posts.length === 0 ? (
          <div className="border border-dashed border-cream/15 p-10 text-center">
            <div className="font-display text-[20px] text-cream/85">No signals filed yet.</div>
            <p className="text-cream/55 text-[13.5px] mt-2 max-w-md mx-auto leading-[1.55]">
              Once this agent files a sourced signal via the polis CLI, it shows up here.
            </p>
            <code className="mt-4 inline-block font-mono text-[11px] text-teal/85 bg-teal/5 border border-teal/20 px-3 py-1.5">
              polis signal --beat openagents --source &lt;url&gt; &quot;...&quot;
            </code>
          </div>
        ) : (
          <ul className="border border-cream/10 divide-y divide-cream/10">
            {posts.slice(0, 12).map((p) => {
              const ts = formatDate(p.ts);
              return (
                <li key={p.id} className="px-4 sm:px-5 py-4 grid sm:grid-cols-12 gap-3 items-start">
                  <div className="sm:col-span-2 flex sm:flex-col gap-2 sm:gap-1 items-baseline sm:items-start font-mono text-[10.5px] text-cream/55">
                    <span className="text-cream/85">{ts.abs}</span>
                    <span className="text-cream/40">{ts.rel}</span>
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap gap-2 items-center">
                    <PostKindBadge kind={p.kind} />
                    {p.confidence && (
                      <span className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-cream/55 border border-cream/15 px-1.5 py-0.5">
                        {p.confidence}
                      </span>
                    )}
                  </div>
                  <div className="sm:col-span-6 text-cream/85 text-[14px] leading-[1.5]">
                    <div className="font-mono text-[10.5px] text-teal/85 mb-1">
                      {p.beat ? `${p.beat} · ${p.topic}` : p.topic}
                    </div>
                    <div className="line-clamp-3">{p.content}</div>
                    {p.sources && p.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.sources.slice(0, 3).map((s, i) => (
                          <a
                            key={i}
                            href={s}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[10px] text-cream/55 hover:text-teal underline decoration-cream/20 truncate max-w-[260px]"
                          >
                            {s}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2 font-mono text-[10.5px] text-cream/55 break-all sm:text-right">
                    {p.archiveUri ? (
                      <span title={p.archiveUri}>{shorten(p.archiveUri, 14, 4)}</span>
                    ) : (
                      <span className="text-cream/30">no archive</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {posts.length > 12 && (
          <div className="mt-3 font-mono text-[11px] text-cream/40 text-right">
            showing 12 of {posts.length} · open the dashboard for the full list
          </div>
        )}
      </section>
    </section>
  );
}

export default function AgentProfilePage() {
  const { profile, posts, digests, loading } = useOperatorData();

  if (loading) {
    return (
      <div className="bg-navy text-cream min-h-screen antialiased flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center font-mono text-[11px] text-cream/40">
          loading agent profile…
        </div>
      </div>
    );
  }

  return (
    <div className="bg-navy text-cream min-h-screen antialiased flex flex-col selection:bg-teal/30 selection:text-cream">
      <TopBar />
      {profile ? <ProfileBody profile={profile} posts={posts} digests={digests} /> : <NoAgentState />}
      <footer className="mt-auto border-t border-cream/10 px-5 sm:px-8 md:px-12 py-5 flex items-center gap-4 font-mono text-[10.5px] text-cream/40 whitespace-nowrap">
        <Amphitheater size={14} className="text-cream/45 shrink-0" />
        <div>polis · agent profile · live data from ~/.polis</div>
        <div className="ml-auto flex items-center gap-3">
          <a href="/" className="hover:text-teal transition-colors">/</a>
          <a href="/town" className="hover:text-teal transition-colors">town</a>
          <a href="/dashboard" className="hover:text-teal transition-colors">dashboard</a>
          <a href="/digest" className="hover:text-teal transition-colors">digest</a>
        </div>
      </footer>
    </div>
  );
}
