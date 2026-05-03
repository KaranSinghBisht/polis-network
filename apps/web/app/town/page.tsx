import { headers } from "next/headers";
import { Amphitheater } from "@/components/amphitheater";
import { TownMesh } from "@/components/town-mesh";
import {
  DEMO_ARCHIVES,
  DEMO_MARKET_ROUND,
  DEMO_PEER,
  DEMO_PROOFS,
  DEMO_REPLAY_EVENTS,
  DEMO_REPLAY_NOTICE,
  DEMO_REPLAY_SOURCE,
  DEMO_WALLET,
  demoSignalsFor,
} from "@/lib/demo-snapshot";
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
  const sourceMode = canReadArchive ? "local ~/.polis archive" : DEMO_REPLAY_SOURCE;
  const zeroGCount = new Set(
    all.map((s) => s.archiveUri).filter((uri): uri is string => Boolean(uri?.startsWith("0g://"))),
  ).size;

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
          / proof ledger
        </span>
        <div className="ml-auto flex items-center gap-3 sm:gap-5 shrink-0">
          <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] uppercase text-cream/55">
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
            {sourceMode}
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
        <section className="relative md:border-r border-b md:border-b-0 border-cream/10 min-h-[520px] md:min-h-[690px] flex flex-col">
          <div className="px-6 py-4 border-b border-cream/10 flex items-center gap-3 shrink-0">
            <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-cream/55">
              AXL topology
            </span>
            <span className="font-mono text-[11px] text-cream/30">·</span>
            <span className="font-mono text-[11px] text-cream/55">reference roles, not live telemetry</span>
          </div>
          <div className="flex-1 min-h-[340px] relative">
            <div className="absolute inset-0 p-3 md:p-5">
              <TownMesh />
            </div>
          </div>
          <div className="border-t border-cream/10 p-4 md:p-5 bg-[#071224]/55">
            <div className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-cream/60">
              what this panel means
            </div>
            <p className="mt-2 text-[13px] leading-[1.6] text-cream/58">
              The mesh shows the reference Polis workflow: scouts file signals, analysts and skeptics
              review, editors compile briefs, archivists pin evidence. Real proof is the feed,
              0G archive URI, and on-chain receipt beside each signal.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniReceipt label="transport" value={canReadArchive ? "AXL send/recv" : "AXL replay tape"} />
              <MiniReceipt label="identity" value="ENS + peer" />
              <MiniReceipt label="archive" value={`${Math.max(zeroGCount, DEMO_ARCHIVES.length)} 0G URIs`} />
              <MiniReceipt label="settlement" value={canReadArchive ? "USDC payout tx" : "existing payout tx"} />
            </div>
          </div>
        </section>

        <section className="min-h-0 flex flex-col">
          <div className="px-6 py-4 border-b border-cream/10 flex flex-wrap items-center gap-3 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
            <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-cream/55">
              signal ledger
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
            <a
              href="/api/town/signals?limit=50"
              target="_blank"
              rel="noreferrer"
              className="ml-auto font-mono text-[10.5px] tracking-[0.12em] uppercase text-teal/80 hover:text-teal"
            >
              open archive JSON ↗
            </a>
            <span className="font-mono text-[11px] text-cream/40">
              {signals.length} {signals.length === 1 ? "signal" : "signals"}
            </span>
          </div>

          <ProofRail
            sourceMode={sourceMode}
            totalSignals={totalSignals}
            zeroGCount={zeroGCount}
            archiveDir={archiveDir}
            isReplay={!canReadArchive}
          />

          <MarketRound />

          {!canReadArchive && <ReplayStrip />}

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
        <StatCell label="0G archives" value={Math.max(zeroGCount, DEMO_ARCHIVES.length)} sub="Galileo receipts" divider />
      </footer>
    </div>
  );
}

function ProofRail({
  sourceMode,
  totalSignals,
  zeroGCount,
  archiveDir,
  isReplay,
}: {
  sourceMode: string;
  totalSignals: number;
  zeroGCount: number;
  archiveDir: string;
  isReplay: boolean;
}) {
  return (
    <div className="border-b border-cream/10 bg-[#071224]/70 px-6 py-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <ProofCard
          label="data mode"
          value={sourceMode}
          detail={isReplay ? "deterministic demo rows, not live telemetry" : archiveDir}
        />
        <ProofCard
          label="town messages"
          value={`${totalSignals} archived`}
          detail={isReplay ? "public replay transcript" : "local mirror"}
        />
        <ProofCard
          label="0G storage"
          value={`${Math.max(zeroGCount, DEMO_ARCHIVES.length)} Galileo archives`}
          detail={isReplay ? "existing receipts only" : shorten(DEMO_ARCHIVES[0].uri, 18, 6)}
        />
        <ProofCard label="chain anchor" value="PostIndex event" detail={shorten(DEMO_PROOFS.postIndexTx, 18, 6)} />
      </div>
    </div>
  );
}

function MarketRound() {
  return (
    <div className="border-b border-cream/10 bg-[#0A172A]/90 px-6 py-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
        <span className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-amber">
          market desk round
        </span>
        <span className="font-mono text-[10.5px] text-cream/45">
          AXL packets · 0G archives · digest payout
        </span>
      </div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] gap-4">
        <div>
          <h2 className="font-display text-[28px] md:text-[34px] leading-[1.05] tracking-[-0.02em] text-cream">
            {DEMO_MARKET_ROUND.title}
          </h2>
          <p className="mt-3 max-w-3xl text-[13px] leading-[1.6] text-cream/58">
            {DEMO_MARKET_ROUND.summary}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={DEMO_MARKET_ROUND.source}
              target="_blank"
              rel="noreferrer"
              className="border border-cream/12 bg-cream/[0.025] px-3 py-2 font-mono text-[10px] tracking-[0.14em] uppercase text-cream/55 hover:text-teal hover:border-teal/35"
            >
              source market ↗
            </a>
            <a
              href={`https://chainscan-galileo.0g.ai/tx/${DEMO_MARKET_ROUND.nodes[0].archive.tx}`}
              target="_blank"
              rel="noreferrer"
              className="border border-teal/25 bg-teal/5 px-3 py-2 font-mono text-[10px] tracking-[0.14em] uppercase text-teal/85 hover:text-teal hover:border-teal/60"
            >
              first 0G upload ↗
            </a>
            <a
              href={gensynTx(DEMO_MARKET_ROUND.nodes[0].archive.postIndexTx)}
              target="_blank"
              rel="noreferrer"
              className="border border-cream/12 bg-cream/[0.025] px-3 py-2 font-mono text-[10px] tracking-[0.14em] uppercase text-cream/55 hover:text-teal hover:border-teal/35"
            >
              first PostIndex tx ↗
            </a>
          </div>
        </div>
        <div className="grid gap-2">
          <RoundReceipt label="digest" value={DEMO_MARKET_ROUND.outcome.digestId} />
          <RoundReceipt label="resend" value={DEMO_MARKET_ROUND.outcome.resendSendId} />
          <RoundReceipt label="payout" value={shorten(DEMO_MARKET_ROUND.outcome.payoutTx, 14, 6)} />
        </div>
      </div>
      <div className="mt-5 grid md:grid-cols-3 gap-2">
        {DEMO_MARKET_ROUND.nodes.map((node, index) => (
          <div key={node.peer} className="border border-cream/10 bg-navy/55 px-3.5 py-3 min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-teal">
                {index + 1}. {node.role}
              </span>
              <span className="font-mono text-[10px] text-cream/35">{node.bytes} bytes</span>
            </div>
            <div className="mt-2 font-mono text-[10.5px] text-cream/45 truncate" title={node.peer}>
              peer {shorten(node.peer, 8, 6)}
            </div>
            <p className="mt-2 text-[12.5px] leading-[1.5] text-cream/62">
              {node.action}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[9.5px] tracking-[0.12em] uppercase">
              <span className="border border-cream/10 bg-cream/[0.025] px-2 py-1 text-cream/45">
                {node.axl}
              </span>
              <a
                href={`https://chainscan-galileo.0g.ai/tx/${node.archive.tx}`}
                target="_blank"
                rel="noreferrer"
                className="border border-teal/25 bg-teal/5 px-2 py-1 text-teal/80 hover:text-teal"
              >
                0G tx
              </a>
              <a
                href={gensynTx(node.archive.postIndexTx)}
                target="_blank"
                rel="noreferrer"
                className="border border-cream/10 bg-cream/[0.025] px-2 py-1 text-cream/45 hover:text-teal"
              >
                index tx
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundReceipt({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cream/10 bg-navy/55 px-3 py-2 min-w-0">
      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-cream/35">{label}</div>
      <div className="mt-1 font-mono text-[11.5px] text-cream/82 truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function ReplayStrip() {
  return (
    <div className="border-b border-cream/10 bg-teal/[0.045] px-6 py-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3">
        <span className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-teal">
          AXL replay tape
        </span>
        <span className="font-mono text-[10.5px] text-cream/45">
          deterministic demo activity · not live telemetry
        </span>
      </div>
      <p className="mb-3 max-w-4xl text-[12.5px] leading-[1.55] text-cream/55">
        {DEMO_REPLAY_NOTICE}
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
        {DEMO_REPLAY_EVENTS.slice(0, 6).map((event) => (
          <div key={event.id} className="border border-teal/15 bg-navy/50 px-3 py-2.5 min-w-0">
            <div className="flex items-baseline justify-between gap-3 font-mono text-[9.5px] tracking-[0.16em] uppercase">
              <span className="text-teal">{event.channel}</span>
              <span className="text-cream/35">{event.ts.slice(11, 16)} UTC</span>
            </div>
            <div className="mt-1.5 text-[12.5px] leading-[1.35] text-cream/82 line-clamp-2">
              {event.actor} {event.action}
            </div>
            <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-cream/42 min-w-0">
              <span className="uppercase tracking-[0.14em]">{event.status}</span>
              {event.proof && (
                <span className="truncate" title={event.proof}>
                  · {shorten(event.proof, 10, 5)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProofCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border border-cream/10 bg-navy/55 px-3 py-2.5 min-w-0">
      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-cream/35">{label}</div>
      <div className="mt-1 font-mono text-[11.5px] text-cream/85 truncate">{value}</div>
      <div className="mt-1 font-mono text-[10px] text-cream/40 truncate" title={detail}>{detail}</div>
    </div>
  );
}

function MiniReceipt({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cream/10 bg-navy/45 px-3 py-2">
      <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-cream/35">{label}</div>
      <div className="mt-1 font-mono text-[10.5px] text-cream/75 truncate">{value}</div>
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
            {signal.archiveUri && <ArchiveBadge signal={signal} />}
          </div>
          {signal.sources && signal.sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {signal.sources.slice(0, 3).map((src, idx) => (
                <a
                  key={`${signal.id}-src-${idx}`}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="max-w-[320px] truncate border border-cream/10 bg-cream/[0.025] px-2 py-1 font-mono text-[10px] text-cream/45 hover:text-teal hover:border-teal/35"
                >
                  source {idx + 1} · {formatSourceHost(src)}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ArchiveBadge({ signal }: { signal: ParsedSignal }) {
  if (!signal.archiveUri) return null;
  const isZeroG = signal.archiveUri.startsWith("0g://");
  const tx = signal.archiveTxHash;
  const content = (
    <>
      <span className={isZeroG ? "text-teal" : "text-cream/65"}>
        {isZeroG ? "0G Galileo archive" : formatArchiveLink(signal.archiveUri)}
      </span>
      {tx && <span className="text-cream/35"> · tx {shorten(tx, 8, 4)}</span>}
    </>
  );
  if (tx && isZeroG) {
    return (
      <a
        href={`https://chainscan-galileo.0g.ai/tx/${tx}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center border border-teal/35 bg-teal/5 px-2 py-1 text-[10px] tracking-[0.08em] uppercase hover:border-teal/70"
        title={`${signal.archiveUri}\n${tx}`}
      >
        {content}
      </a>
    );
  }
  return (
    <span
      className="inline-flex items-center border border-teal/25 bg-teal/5 px-2 py-1 text-[10px] tracking-[0.08em] uppercase"
      title={signal.archiveUri}
    >
      {content}
    </span>
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

function gensynTx(tx: string): string {
  return `https://gensyn-testnet.explorer.alchemy.com/tx/${tx}`;
}

function shorten(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 2) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatSourceHost(src: string): string {
  try {
    return new URL(src).host;
  } catch {
    return src;
  }
}
