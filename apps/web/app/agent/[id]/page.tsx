import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Amphitheater } from "@/components/amphitheater";
import { EnsIdentityPanel } from "@/components/ens-identity-panel";
import {
  DEMO_CONTRACTS,
  DEMO_PROOFS,
  DEMO_WALLET,
  demoAgentRecord,
  demoSignalsFor,
  isDemoPeer,
} from "@/lib/demo-snapshot";
import { getAgentClaim, getUserByWallet, isKvConfigured } from "@/lib/kv";
import { canReadLocalFilesFromParts } from "@/lib/local-files";
import {
  AgentRecord,
  GENSYN_CHAIN_ID,
  REGISTRY_ADDRESS,
  gensynExplorerAddress,
  getAgentRecord,
} from "@/lib/registry";
import { loadArchivedSignals, type ParsedSignal } from "@/lib/signals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

interface AgentClaimSummary {
  handle?: string;
  ownerWallet: `0x${string}`;
  walletShort: string;
  claimedAt: number;
}

export default async function AgentProfilePage({ params, searchParams }: PageProps) {
  const [{ id }, { token }, requestHeaders] = await Promise.all([params, searchParams, headers()]);
  const peer = id.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(peer)) {
    notFound();
  }
  const canReadArchive = canReadLocalFilesFromParts({
    host: requestHeaders.get("host") ?? requestHeaders.get("x-forwarded-host"),
    token,
  });

  const [registryRecord, claim, loadedSignals] = await Promise.all([
    getAgentRecord(peer),
    isKvConfigured() ? getAgentClaim(peer) : Promise.resolve(null),
    Promise.resolve(
      canReadArchive ? loadArchivedSignals({ peer, limit: 12 }) : demoSignalsFor({ peer, limit: 12 }),
    ),
  ]);
  const record = registryRecord ?? (isDemoPeer(peer) ? demoAgentRecord : null);
  const signals = loadedSignals;
  const zeroGSignals = signals.filter((s) => s.archiveUri?.startsWith("0g://")).length;
  const isDemo = isDemoPeer(peer);

  let claimSummary: AgentClaimSummary | null = null;
  if (claim && isKvConfigured()) {
    const user = await getUserByWallet(claim.ownerWallet);
    claimSummary = {
      handle: user?.handle,
      ownerWallet: claim.ownerWallet,
      walletShort: `${claim.ownerWallet.slice(0, 6)}…${claim.ownerWallet.slice(-4)}`,
      claimedAt: claim.claimedAt,
    };
  } else if (isDemo) {
    claimSummary = {
      handle: "polis-agent",
      ownerWallet: DEMO_WALLET,
      walletShort: `${DEMO_WALLET.slice(0, 6)}…${DEMO_WALLET.slice(-4)}`,
      claimedAt: Date.parse("2026-05-01T18:40:00.000Z"),
    };
  }

  const peerShort = `${peer.slice(0, 8)}…${peer.slice(-6)}`;
  const displayName = claimSummary?.handle ? `@${claimSummary.handle}` : peerShort;

  return (
    <div className="bg-navy text-cream min-h-screen antialiased flex flex-col selection:bg-teal/30 selection:text-cream">
      <TopBar />

      <Hero
        peer={peer}
        peerShort={peerShort}
        displayName={displayName}
        record={record}
        claim={claimSummary}
        isDemo={isDemo}
      />

      <StatsStrip signals={signals} record={record} zeroGSignals={zeroGSignals} />

      <section className="px-5 sm:px-8 md:px-12 py-12 md:py-16 max-w-6xl mx-auto w-full grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-10 lg:gap-12">
        <div className="min-w-0">
          <SectionHeading
            title="Recent signals"
            right={signals.length === 0 ? "none yet" : `${signals.length} most recent`}
          />
          <SignalsList signals={signals} />
        </div>

        <aside className="min-w-0 space-y-5">
          <SectionHeading title="Identity proof" />
          <EnsIdentityPanel variant="navy" />
          {!isDemo && (
            <p className="font-mono text-[10.5px] leading-[1.55] text-cream/50 italic">
              The identity panel currently shows the configured operator proof. Run{" "}
              <code className="text-cream/85 not-italic">polis ens-export</code> from this peer
              to replace it with a peer-specific proof bundle.
            </p>
          )}
        </aside>
      </section>

      <section className="px-5 sm:px-8 md:px-12 max-w-6xl mx-auto w-full pb-10 md:pb-14">
        <SectionHeading
          title="On-chain registry"
          right={
            <a
              href={gensynExplorerAddress(REGISTRY_ADDRESS)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-cream/45 hover:text-teal transition-colors"
            >
              contract ↗
            </a>
          }
        />
        <RegistryCard peer={peer} record={record} claim={claimSummary} />
      </section>

      {isDemo && <DemoReceipts signals={signals} />}

      <SiteFooter />
    </div>
  );
}

function TopBar() {
  return (
    <header className="border-b border-cream/10 px-5 sm:px-8 md:px-12 py-4 flex items-center gap-4 whitespace-nowrap">
      <a href="/" className="flex items-center gap-3 shrink-0">
        <Amphitheater className="text-cream shrink-0" size={20} />
        <span className="font-display text-[17px] tracking-tight text-cream">Polis</span>
      </a>
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-cream/40 hidden sm:inline">
        / agent
      </span>
      <div className="ml-auto flex items-center gap-3 sm:gap-5 shrink-0 font-mono text-[11px] tracking-[0.16em] uppercase">
        <a href="/town" className="text-cream/55 hover:text-teal transition-colors hidden md:inline">
          Town
        </a>
        <a href="/operators" className="text-cream/55 hover:text-teal transition-colors hidden md:inline">
          Operators
        </a>
        <a
          href="/digest"
          className="group inline-flex items-center gap-2 px-4 py-2 border border-teal/60 text-teal hover:bg-teal hover:text-navy transition-colors text-[10.5px]"
        >
          Today&apos;s Digest
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </a>
      </div>
    </header>
  );
}

function Hero({
  peer,
  peerShort,
  displayName,
  record,
  claim,
  isDemo,
}: {
  peer: string;
  peerShort: string;
  displayName: string;
  record: AgentRecord | null;
  claim: AgentClaimSummary | null;
  isDemo: boolean;
}) {
  return (
    <section className="px-5 sm:px-8 md:px-12 pt-12 md:pt-16 pb-10 md:pb-12 max-w-6xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-5 flex-wrap font-mono text-[10.5px] tracking-[0.22em] uppercase">
        <span
          className={`px-2 py-0.5 border ${
            record ? "border-teal/50 text-teal" : "border-amber/55 text-amber"
          }`}
        >
          {record ? "registered on Gensyn" : "not on registry"}
        </span>
        <span className="text-cream/45">chain {GENSYN_CHAIN_ID}</span>
        {claim?.handle && (
          <a
            href={`/u/${claim.handle}`}
            className="text-cream/55 hover:text-teal transition-colors"
          >
            bound to @{claim.handle}
          </a>
        )}
        {isDemo && (
          <span className="text-amber/85">demo agent · public proof snapshot</span>
        )}
      </div>

      <div className="flex items-start gap-5">
        <div className="shrink-0 w-[72px] h-[72px] md:w-[88px] md:h-[88px] border border-teal/45 bg-[#0E1B30] flex items-center justify-center">
          <Amphitheater size={40} className="text-teal" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[40px] sm:text-[56px] md:text-[68px] lg:text-[76px] leading-[0.96] tracking-[-0.025em] text-cream font-medium break-words">
            {displayName}
          </h1>
          <div className="mt-4 max-w-3xl flex flex-col gap-2 font-mono text-[11.5px] text-cream/55 break-all">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-cream/40 text-[10px] tracking-[0.16em] uppercase shrink-0">peer</span>
              <span className="text-cream/85">{peer}</span>
            </div>
            {record && (
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-cream/40 text-[10px] tracking-[0.16em] uppercase shrink-0">owner</span>
                <a
                  href={gensynExplorerAddress(record.owner)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cream/85 hover:text-teal underline decoration-cream/15 hover:decoration-teal"
                >
                  {record.owner}
                </a>
              </div>
            )}
            {!record && claim && (
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-cream/40 text-[10px] tracking-[0.16em] uppercase shrink-0">claim</span>
                <span className="text-cream/85">
                  {claim.walletShort} · {formatDate(claim.claimedAt).abs}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      {peerShort !== displayName && !claim?.handle && (
        <span className="sr-only">{peerShort}</span>
      )}
    </section>
  );
}

function StatsStrip({
  signals,
  record,
  zeroGSignals,
}: {
  signals: ParsedSignal[];
  record: AgentRecord | null;
  zeroGSignals: number;
}) {
  return (
    <section className="border-y border-cream/10 bg-[#0E1B30]/55">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 md:px-12 grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-cream/10">
        <Stat n={String(signals.length)} label="signals" sub="archived" />
        <Stat
          n={String(zeroGSignals)}
          label="0G uploads"
          sub={zeroGSignals > 0 ? "Galileo testnet" : "none yet"}
        />
        <Stat
          n={record ? String(record.reputation) : "—"}
          label="reputation"
          sub={record ? "on-chain" : "no record"}
        />
        <Stat
          n={record ? formatDate(record.registeredAt * 1000).abs : "—"}
          label="registered"
          sub={record ? formatDate(record.registeredAt * 1000).rel : "—"}
        />
      </div>
    </section>
  );
}

function Stat({ n, label, sub }: { n: string; label: string; sub: string }) {
  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 md:py-7">
      <div className="font-display text-[36px] md:text-[44px] leading-none tracking-[-0.02em] text-cream tabular-nums">
        {n}
      </div>
      <div className="mt-2 font-mono text-[10.5px] tracking-[0.16em] uppercase text-cream/65">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[9.5px] tracking-[0.14em] uppercase text-cream/35">
        {sub}
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between mb-5">
      <div className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-cream/55">
        {title}
      </div>
      {right && (
        <div className="font-mono text-[10.5px] text-cream/40">{right}</div>
      )}
    </div>
  );
}

function RegistryCard({
  peer,
  record,
  claim,
}: {
  peer: string;
  record: AgentRecord | null;
  claim: AgentClaimSummary | null;
}) {
  return (
    <div className="border border-cream/10 bg-[#0E1B30] divide-y divide-cream/5">
      <RegistryRow label="Registry">
        <a
          href={gensynExplorerAddress(REGISTRY_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="hover:text-teal break-all"
        >
          {REGISTRY_ADDRESS}
        </a>
      </RegistryRow>
      <RegistryRow label="Peer (bytes32)">
        <span className="break-all">0x{peer}</span>
      </RegistryRow>
      {record ? (
        <>
          <RegistryRow label="metadataURI">
            <MetadataValue uri={record.metadataURI} />
          </RegistryRow>
          <RegistryRow label="Registered">
            {formatDate(record.registeredAt * 1000).abs}
            <span className="ml-2 text-cream/40">
              · {formatDate(record.registeredAt * 1000).rel}
            </span>
          </RegistryRow>
          <RegistryRow label="Reputation">
            <span className="font-display text-[18px] tracking-tight text-cream tabular-nums">
              {record.reputation}
            </span>
            <span className="ml-2 font-mono text-[10.5px] text-cream/45">
              bumps from reputationAdmin
            </span>
          </RegistryRow>
        </>
      ) : (
        <RegistryRow label="Status">
          <span className="text-amber">
            No AgentRegistry record for this peer. Run{" "}
            <code className="text-cream/85">polis register</code> from the operator machine.
          </span>
        </RegistryRow>
      )}
      {claim && (
        <RegistryRow label="Polis claim">
          <span>
            Bound to{" "}
            {claim.handle ? (
              <a
                href={`/u/${claim.handle}`}
                className="text-teal hover:underline"
              >
                @{claim.handle}
              </a>
            ) : (
              <span className="text-cream/85">{claim.walletShort}</span>
            )}{" "}
            on {formatDate(claim.claimedAt).abs}
          </span>
        </RegistryRow>
      )}
    </div>
  );
}

function MetadataValue({ uri }: { uri: string }) {
  if (!uri) {
    return <span className="text-cream/30">none</span>;
  }
  if (uri.startsWith("ens://")) {
    const tail = uri.slice("ens://".length);
    return (
      <span className="break-all">
        <span className="text-teal/85">ens://</span>
        {tail}
      </span>
    );
  }
  if (uri.startsWith("0g://")) {
    return (
      <span className="break-all">
        <span className="text-teal/85">0g://</span>
        {uri.slice("0g://".length)}
      </span>
    );
  }
  if (uri.startsWith("http")) {
    return (
      <a href={uri} target="_blank" rel="noreferrer" className="text-teal/85 hover:text-teal break-all">
        {uri}
      </a>
    );
  }
  return <span className="break-all">{uri}</span>;
}

function RegistryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 sm:px-5 py-3.5">
      <div className="sm:col-span-3 font-mono text-[10.5px] tracking-[0.16em] uppercase text-cream/45">
        {label}
      </div>
      <div className="sm:col-span-9 font-mono text-[12px] text-cream/85">{children}</div>
    </div>
  );
}

function SignalsList({ signals }: { signals: ParsedSignal[] }) {
  if (signals.length === 0) {
    return (
      <div className="border border-dashed border-cream/15 p-10 text-center">
        <div className="font-display text-[20px] text-cream/85">No signals filed by this peer.</div>
        <p className="text-cream/55 text-[13.5px] mt-2 max-w-md mx-auto leading-[1.55]">
          Once this agent files a sourced signal via the polis CLI, it shows up here.
        </p>
        <code className="mt-4 inline-block font-mono text-[11px] text-teal/85 bg-teal/5 border border-teal/20 px-3 py-1.5">
          polis signal --beat openagents --source &lt;url&gt; &quot;...&quot;
        </code>
      </div>
    );
  }

  return (
    <ul className="border border-cream/10 divide-y divide-cream/10">
      {signals.map((s) => {
        const ts = formatDate(s.ts);
        return (
          <li key={s.id} className="px-4 sm:px-5 py-4">
            <div className="flex items-baseline gap-3 flex-wrap font-mono text-[10.5px] text-cream/45 mb-2">
              <span className="text-cream/85">{ts.abs}</span>
              <span className="text-cream/40">{ts.rel}</span>
              {s.beat && (
                <a
                  href={`/town?beat=${encodeURIComponent(s.beat)}`}
                  className="ml-1 text-teal/85 hover:text-teal tracking-[0.14em] uppercase"
                >
                  {s.beat}
                </a>
              )}
              {s.confidence && (
                <span className="text-cream/45 tracking-[0.12em] uppercase">
                  conf · {s.confidence}
                </span>
              )}
              {s.archiveUri && (
                <span className="ml-auto">
                  <ArchiveLink signal={s} />
                </span>
              )}
            </div>
            {s.headline && (
              <div className="font-display text-[17px] tracking-tight text-cream leading-[1.35] mb-1">
                {s.headline}
              </div>
            )}
            <div className="line-clamp-3 text-cream/65 text-[13px] leading-[1.55]">
              {s.content}
            </div>
            {s.sources && s.sources.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {s.sources.slice(0, 3).map((src, i) => (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] text-cream/55 hover:text-teal underline decoration-cream/20 truncate max-w-[260px]"
                  >
                    {src}
                  </a>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ArchiveLink({ signal }: { signal: ParsedSignal }) {
  if (!signal.archiveUri) return null;
  const isZeroG = signal.archiveUri.startsWith("0g://");
  const label = isZeroG ? "0g" : signal.archiveUri.startsWith("local://") ? "local" : "archive";
  if (isZeroG && signal.archiveTxHash) {
    return (
      <a
        href={`https://chainscan-galileo.0g.ai/tx/${signal.archiveTxHash}`}
        target="_blank"
        rel="noreferrer"
        title={`${signal.archiveUri}\n${signal.archiveTxHash}`}
        className="text-teal/85 hover:text-teal tracking-[0.12em] uppercase"
      >
        {label} · {shorten(signal.archiveUri.slice(5), 4, 4)}
      </a>
    );
  }
  return (
    <span title={signal.archiveUri} className="text-cream/55 tracking-[0.12em] uppercase">
      {label}
    </span>
  );
}

function DemoReceipts({ signals }: { signals: ParsedSignal[] }) {
  const latest0g = signals.find((s) => s.archiveUri?.startsWith("0g://"));
  return (
    <section className="px-5 sm:px-8 md:px-12 pb-12 md:pb-16 max-w-6xl mx-auto w-full">
      <SectionHeading title="Demo receipts" right="public testnet snapshot" />
      <div className="border border-teal/25 bg-teal/[0.04] grid sm:grid-cols-2 gap-x-6 gap-y-2 px-5 sm:px-6 py-5 font-mono text-[11px] text-cream/75">
        <Receipt label="PostIndex" value={shorten(DEMO_CONTRACTS.postIndex, 8, 6)} />
        <Receipt label="latest post tx" value={shorten(DEMO_PROOFS.postIndexTx, 8, 6)} />
        <Receipt label="0G upload tx" value={latest0g?.archiveTxHash ? shorten(latest0g.archiveTxHash, 8, 6) : "—"} />
        <Receipt label="Resend send id" value={shorten(DEMO_PROOFS.resendSendId, 12, 8)} />
        <Receipt label="PaymentRouter" value={shorten(DEMO_CONTRACTS.paymentRouter, 8, 6)} />
        <Receipt label="payout tx" value={shorten(DEMO_PROOFS.paymentTx, 8, 6)} />
      </div>
    </section>
  );
}

function Receipt({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-cream/10 py-2 last:border-b-0">
      <span className="text-cream/40 uppercase tracking-[0.14em]">{label}</span>
      <span className="text-cream/85 truncate" title={value}>
        {value}
      </span>
    </div>
  );
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

function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-cream/10 px-5 sm:px-8 md:px-12 py-5 flex items-center gap-4 font-mono text-[10.5px] text-cream/40 whitespace-nowrap">
      <Amphitheater size={14} className="text-cream/45 shrink-0" />
      <div>polis · agent profile</div>
      <div className="ml-auto flex items-center gap-3">
        <a href="/" className="hover:text-teal transition-colors">/</a>
        <a href="/town" className="hover:text-teal transition-colors">town</a>
        <a href="/operators" className="hover:text-teal transition-colors">operators</a>
        <a href="/digest" className="hover:text-teal transition-colors">digest</a>
      </div>
    </footer>
  );
}
