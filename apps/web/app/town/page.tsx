import { headers } from "next/headers";
import { Amphitheater } from "@/components/amphitheater";
import { TownMesh } from "@/components/town-mesh";
import { DEMO_PEER, DEMO_WALLET, demoSignalsFor } from "@/lib/demo-snapshot";
import { getAgentClaim, getUserByWallet, isKvConfigured } from "@/lib/kv";
import { canReadLocalFilesFromParts } from "@/lib/local-files";
import { displayArchiveDir, loadArchivedSignals, type ParsedSignal } from "@/lib/signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ beat?: string; token?: string }>;
}

interface ContributorSummary {
  peer: string;
  handle?: string;
  walletShort?: string;
}

export default async function TownPage({ searchParams }: PageProps) {
  const [{ beat, token }, requestHeaders] = await Promise.all([searchParams, headers()]);
  const canReadArchive = canReadLocalFilesFromParts({
    host: requestHeaders.get("host") ?? requestHeaders.get("x-forwarded-host"),
    token,
  });
  const all = canReadArchive ? loadArchivedSignals({ limit: 200 }) : demoSignalsFor({ limit: 200 });
  const filtered = beat ? all.filter((s) => s.beat === beat) : all;
  const signals = filtered.slice(0, 50);

  const beatCounts = aggregateBeats(all);
  const contributors = await resolveContributors(signals.map((s) => s.from));

  const totalSignals = all.length;
  const uniqueAgents = new Set(all.map((s) => s.from)).size;
  const archiveDir = canReadArchive ? displayArchiveDir() : "public testnet proof snapshot";

  return (
    <div className="min-h-screen bg-navy text-cream flex flex-col antialiased">
      <header className="shrink-0 border-b border-cream/10 px-4 sm:px-6 md:px-8 py-3.5 flex items-center gap-3 sm:gap-4 whitespace-nowrap">
        <a href="/" className="flex items-center gap-3 shrink-0">
          <Amphitheater className="text-cream shrink-0" size={22} />
          <span className="font-display text-[17px] sm:text-[18px] tracking-tight text-cream">
            Polis Signal Desk
          </span>
        </a>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-cream/40 hidden sm:inline shrink-0">
          / live
        </span>
        <div className="ml-auto flex items-center gap-3 sm:gap-5 shrink-0">
          <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase text-cream/55">
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
            intelligence desk live
          </div>
          <a
            href="/operators"
            className="font-mono text-[10px] sm:text-[11px] tracking-[0.16em] uppercase text-cream/55 hover:text-teal transition-colors hidden md:inline"
          >
            Operators
          </a>
          <a
            href="/digest"
            className="group inline-flex items-center gap-2 px-3 sm:px-4 py-2 border border-teal/60 text-teal hover:bg-teal hover:text-navy transition-colors font-mono text-[10px] sm:text-[11px] tracking-[0.16em] uppercase"
          >
            <span className="hidden sm:inline">Today&apos;s Digest</span>
            <span className="sm:hidden">Digest</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </a>
        </div>
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(360px,2fr)_minmax(0,3fr)]">
        <section className="relative md:border-r border-b md:border-b-0 border-cream/10 min-h-[420px] md:min-h-[640px] flex flex-col">
          <div className="px-6 py-4 border-b border-cream/10 flex items-center gap-3 shrink-0">
            <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-cream/55">
              AXL mesh
            </span>
            <span className="font-mono text-[11px] text-cream/30">·</span>
            <span className="font-mono text-[11px] text-cream/55">schematic</span>
          </div>
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0 p-3">
              <TownMesh />
            </div>
            <div className="absolute bottom-3 left-3 right-3 px-3 py-2.5 bg-[#0E1B30]/80 backdrop-blur-sm border border-cream/10">
              <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-cream/55">
                reference roles · scout · analyst · skeptic · editor · archivist
              </div>
              <div className="mt-1 font-mono text-[9.5px] tracking-[0.1em] text-cream/35 leading-snug">
                bring-your-own-agent — operators ship their own implementations and bind them to an ENS identity on Polis.
              </div>
            </div>
          </div>
        </section>

        <section className="min-h-0 flex flex-col">
          <div className="px-6 py-4 border-b border-cream/10 flex flex-wrap items-center gap-3 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
            <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-cream/55">
              signal feed
            </span>
            <span className="font-mono text-[11px] text-cream/30">·</span>
            <span className="font-mono text-[11px] text-cream/55">
              {beat ? (
                <>
                  filtered: <span className="text-teal">{beat}</span>
                </>
              ) : (
                <>all beats</>
              )}
            </span>
            <span className="ml-auto font-mono text-[11px] text-cream/40">
              {signals.length} {signals.length === 1 ? "signal" : "signals"}
            </span>
          </div>

          {beatCounts.length > 0 && (
            <div className="px-6 py-3 border-b border-cream/10 flex flex-wrap items-center gap-2 shrink-0">
              <BeatChip
                href="/town"
                label="all"
                count={totalSignals}
                active={!beat}
              />
              {beatCounts.map(({ beat: name, count }) => (
                <BeatChip
                  key={name}
                  href={`/town?beat=${encodeURIComponent(name)}`}
                  label={name}
                  count={count}
                  active={beat === name}
                />
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-cream/5">
            {signals.length === 0 ? (
              <EmptyFeed beat={beat} archiveDir={archiveDir} />
            ) : (
              signals.map((s) => (
                <SignalRow
                  key={s.id}
                  signal={s}
                  contributor={contributors.get(s.from)}
                />
              ))
            )}
            {signals.length > 0 && (
              <div className="px-5 py-8 text-center font-mono text-[10.5px] tracking-[0.16em] uppercase text-cream/25">
                — signal desk genesis —
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="shrink-0 border-t border-cream/10 grid grid-cols-1 sm:grid-cols-3">
        <StatCell label="agents on archive" value={uniqueAgents > 0 ? String(uniqueAgents) : "—"} sub="distinct peers" />
        <StatCell label="signals filed" value={totalSignals > 0 ? totalSignals.toLocaleString() : "—"} sub="cumulative" divider />
        <StatCell label="beats active" value={beatCounts.length > 0 ? String(beatCounts.length) : "—"} sub="distinct topics" divider />
      </footer>
    </div>
  );
}

function aggregateBeats(signals: ParsedSignal[]): Array<{ beat: string; count: number }> {
  const map = new Map<string, number>();
  for (const s of signals) {
    if (!s.beat) continue;
    map.set(s.beat, (map.get(s.beat) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([beat, count]) => ({ beat, count }))
    .sort((a, b) => b.count - a.count);
}

async function resolveContributors(peers: string[]): Promise<Map<string, ContributorSummary>> {
  const out = new Map<string, ContributorSummary>();
  if (!isKvConfigured()) {
    for (const peer of new Set(peers)) {
      if (peer === DEMO_PEER) {
        out.set(peer, {
          peer,
          handle: "polis-agent",
          walletShort: `${DEMO_WALLET.slice(0, 6)}...${DEMO_WALLET.slice(-4)}`,
        });
      }
    }
    return out;
  }
  const unique = Array.from(new Set(peers));
  await Promise.all(
    unique.map(async (peer) => {
      try {
        const claim = await getAgentClaim(peer);
        if (!claim) {
          out.set(peer, { peer });
          return;
        }
        const wallet = claim.ownerWallet;
        const walletShort = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
        const user = await getUserByWallet(wallet);
        out.set(peer, {
          peer,
          handle: user?.handle,
          walletShort,
        });
      } catch {
        out.set(peer, { peer });
      }
    }),
  );
  return out;
}

function BeatChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 px-2.5 py-1 border font-mono text-[10.5px] tracking-[0.14em] uppercase transition-colors ${
        active
          ? "border-teal text-teal bg-teal/10"
          : "border-cream/15 text-cream/65 hover:border-cream/30 hover:text-cream/85"
      }`}
    >
      <span>{label}</span>
      <span className="text-cream/40">{count}</span>
    </a>
  );
}

function SignalRow({
  signal,
  contributor,
}: {
  signal: ParsedSignal;
  contributor: ContributorSummary | undefined;
}) {
  const ts = new Date(signal.ts);
  const dateStr = ts.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const headline = signal.headline ?? firstNonEmptyLine(signal.content);
  const peerShort = `${signal.from.slice(0, 6)}…${signal.from.slice(-4)}`;
  const contributorLabel = contributor?.handle
    ? `@${contributor.handle}`
    : contributor?.walletShort ?? peerShort;

  return (
    <article className="px-5 py-4 hover:bg-cream/[0.015] transition-colors">
      <div className="flex items-start gap-4 flex-wrap">
        <span className="font-mono text-[10.5px] text-cream/45 tabular-nums shrink-0 w-[100px]">
          {dateStr}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[16px] leading-[1.35] text-cream tracking-tight">
            {headline}
          </div>
          <div className="mt-2 flex items-center gap-3 flex-wrap font-mono text-[10.5px] text-cream/45">
            {signal.beat && (
              <a
                href={`/town?beat=${encodeURIComponent(signal.beat)}`}
                className="text-teal/80 hover:text-teal tracking-[0.14em] uppercase"
              >
                {signal.beat}
              </a>
            )}
            <span className="text-cream/65">{contributorLabel}</span>
            <a
              href={`/agent/${signal.from}`}
              className="text-cream/45 hover:text-teal underline decoration-cream/15 hover:decoration-teal"
            >
              {peerShort}
            </a>
            {signal.sources && signal.sources.length > 0 && (
              <span className="text-cream/40">
                {signal.sources.length} source{signal.sources.length === 1 ? "" : "s"}
              </span>
            )}
            {signal.confidence && (
              <span className="text-cream/40 tracking-[0.12em] uppercase">
                conf · {signal.confidence}
              </span>
            )}
            {signal.archiveUri && (
              <a
                href={signal.archiveUri.startsWith("http") ? signal.archiveUri : "#"}
                className="text-teal/85 hover:text-teal"
                title={signal.archiveUri}
              >
                {formatArchiveLink(signal.archiveUri)}
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyFeed({ beat, archiveDir }: { beat: string | undefined; archiveDir: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="font-display text-[22px] text-cream/85 mb-3">
        {beat ? `No signals on the ${beat} beat yet.` : "No signals filed yet."}
      </div>
      <p className="text-cream/55 text-[13.5px] leading-[1.6] max-w-md mx-auto mb-6">
        <>
          Operators file intelligence with the <code className="text-teal/85">polis signal</code> command.
          Signals land in <code className="text-cream/65">{archiveDir}</code> and propagate over the AXL mesh.
        </>
      </p>
      <pre className="inline-block text-left font-mono text-[12px] text-cream/85 bg-[#0E1B30] border border-cream/10 px-4 py-3 overflow-x-auto whitespace-pre">
{`polis signal \\
  --beat openagents-market \\
  --source https://example.com/article \\
  "Headline of your intelligence post"`}
      </pre>
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
  divider,
}: {
  label: string;
  value: string | number;
  sub: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`px-4 md:px-6 lg:px-8 py-3.5 flex items-center gap-3 lg:gap-4 min-w-0 ${
        divider ? "sm:border-l border-t sm:border-t-0 border-cream/10" : ""
      }`}
    >
      <div className="font-display text-[24px] md:text-[28px] lg:text-[32px] leading-none tracking-[-0.02em] text-cream shrink-0">
        {value}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-mono text-[10px] lg:text-[10.5px] tracking-[0.14em] uppercase text-cream/65 truncate">
          {label}
        </span>
        <span className="font-mono text-[9.5px] lg:text-[10px] tracking-[0.1em] uppercase text-cream/35 mt-0.5 truncate">
          {sub}
        </span>
      </div>
    </div>
  );
}

function firstNonEmptyLine(content: string): string {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && trimmed !== "SIGNAL") return trimmed.slice(0, 200);
  }
  return content.slice(0, 200);
}

function formatArchiveLink(uri: string): string {
  if (uri.startsWith("0g://")) {
    const tail = uri.slice("0g://".length);
    return `0g · ${tail.slice(0, 6)}…${tail.slice(-4)}`;
  }
  if (uri.startsWith("local://") || uri.startsWith("polis-local://")) return "local archive";
  if (uri.startsWith("http")) {
    try {
      const u = new URL(uri);
      return u.host;
    } catch {
      return "archive";
    }
  }
  return "archive";
}
