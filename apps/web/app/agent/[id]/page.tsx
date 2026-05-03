import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Amphitheater } from "@/components/amphitheater";
import { EnsIdentityPanel } from "@/components/ens-identity-panel";
import {
  DEMO_ARCHIVES,
  DEMO_CONTRACTS,
  DEMO_ENS,
  DEMO_WALLET,
  DEMO_PROOFS,
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

  let claimSummary: AgentClaimSummary | null = null;
  if (claim && isKvConfigured()) {
    const user = await getUserByWallet(claim.ownerWallet);
    claimSummary = {
      handle: user?.handle,
      ownerWallet: claim.ownerWallet,
      walletShort: `${claim.ownerWallet.slice(0, 6)}…${claim.ownerWallet.slice(-4)}`,
      claimedAt: claim.claimedAt,
    };
  } else if (isDemoPeer(peer)) {
    claimSummary = {
      handle: "polis-agent",
      ownerWallet: DEMO_WALLET,
      walletShort: `${DEMO_WALLET.slice(0, 6)}...${DEMO_WALLET.slice(-4)}`,
      claimedAt: Date.parse("2026-05-01T18:40:00.000Z"),
    };
  }

  const peerShort = `${peer.slice(0, 8)}…${peer.slice(-6)}`;

  return (
    <div className="bg-navy text-cream min-h-screen antialiased flex flex-col selection:bg-teal/30 selection:text-cream">
      <TopBar />
      <ProfileBody
        peer={peer}
        peerShort={peerShort}
        record={record}
        claim={claimSummary}
        signals={signals}
        zeroGSignals={zeroGSignals}
        isDemo={isDemoPeer(peer)}
      />
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

function ProfileBody({
  peer,
  peerShort,
  record,
  claim,
  signals,
  zeroGSignals,
  isDemo,
}: {
  peer: string;
  peerShort: string;
  record: AgentRecord | null;
  claim: AgentClaimSummary | null;
  signals: ParsedSignal[];
  zeroGSignals: number;
  isDemo: boolean;
}) {
  const displayName = claim?.handle
    ? `@${claim.handle}`
    : record
      ? peerShort
      : peerShort;

  return (
    <section className="px-5 sm:px-8 md:px-12 py-10 md:py-14 max-w-6xl mx-auto w-full">
      <div className="mb-8 md:mb-10 border border-teal/25 bg-teal/[0.045] px-4 sm:px-5 py-4 flex flex-col lg:flex-row gap-4 lg:items-center">
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-teal">
            agent passport
          </div>
          <p className="mt-1 text-[13.5px] leading-[1.55] text-cream/65 max-w-2xl">
            This page is the judge-facing proof chain for one operator: ENS identity, AXL peer,
            Gensyn registry owner, 0G archives, digest inclusion, and payout receipt.
          </p>
        </div>
        <div className="lg:ml-auto grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0">
          <PassportPill label="ENS" value={isDemo ? DEMO_ENS : claim?.handle ? `@${claim.handle}` : "configured"} />
          <PassportPill label="AXL peer" value={peerShort} />
          <PassportPill label="0G proofs" value={String(Math.max(zeroGSignals, isDemo ? DEMO_ARCHIVES.length : 0))} />
          <PassportPill label="payout" value={isDemo ? "0.07 USDC" : "digest based"} />
        </div>
      </div>
      <div className="grid md:grid-cols-12 gap-12 mb-12 md:mb-16">
        <div className="md:col-span-7">
          <div className="flex items-start gap-5">
            <div className="shrink-0 w-[72px] h-[72px] md:w-[88px] md:h-[88px] border border-teal/50 bg-[#0E1B30] flex items-center justify-center">
              <Amphitheater size={36} className="text-teal" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2 font-mono text-[10.5px] tracking-[0.22em] uppercase">
                <span
                  className={`px-2 py-0.5 border ${
                    record
                      ? "border-teal/50 text-teal"
                      : "border-amber/50 text-amber"
                  }`}
                >
                  {record ? "registered on Gensyn" : "not on registry"}
                </span>
                <span className="text-cream/50">chain {GENSYN_CHAIN_ID}</span>
                {claim?.handle && (
                  <a
                    href={`/u/${claim.handle}`}
                    className="text-cream/55 hover:text-teal transition-colors"
                  >
                    bound to @{claim.handle}
                  </a>
                )}
              </div>
              <h1 className="font-display text-[36px] sm:text-[44px] md:text-[52px] leading-[0.95] tracking-[-0.02em] text-cream font-medium break-all">
                {displayName}
              </h1>
              <div className="mt-3 font-mono text-[11.5px] text-cream/55 break-all">
                <span className="text-cream/40 text-[10px] tracking-[0.16em] uppercase mr-2">peer</span>
                {peer}
              </div>
              {record && (
                <div className="mt-1.5 font-mono text-[11.5px] text-cream/55 break-all">
                  <span className="text-cream/40 text-[10px] tracking-[0.16em] uppercase mr-2">owner</span>
                  <a
                    href={gensynExplorerAddress(record.owner)}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-teal underline decoration-cream/15 hover:decoration-teal"
                  >
                    {record.owner}
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="mt-9 grid grid-cols-2 sm:grid-cols-4 gap-x-6 sm:gap-x-8 gap-y-5">
            <StatTile label="Signals" value={String(signals.length)} sub="archived" />
            <StatTile label="0G uploads" value={String(zeroGSignals || (isDemo ? DEMO_ARCHIVES.length : 0))} sub="Galileo" />
            <StatTile
              label="Reputation"
              value={record ? String(record.reputation) : "—"}
              sub="on-chain"
            />
            <StatTile
              label="Registered"
              value={record ? formatDate(record.registeredAt * 1000).abs : "—"}
              sub={record ? formatDate(record.registeredAt * 1000).rel : "—"}
            />
          </div>
        </div>

        <div className="md:col-span-5">
          <EnsIdentityPanel variant="navy" />
          {!isDemo && (
            <p className="mt-3 font-mono text-[10.5px] leading-[1.55] text-amber/75">
              Identity panel displays the configured operator proof bundle. Use `polis ens-export`
              from this peer to replace it with a peer-specific proof.
            </p>
          )}
        </div>
      </div>

      <ProofPassport record={record} signals={signals} zeroGSignals={zeroGSignals} isDemo={isDemo} />

      <RegistryCard peer={peer} record={record} claim={claim} />

      <SignalsList signals={signals} />
    </section>
  );
}

function PassportPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cream/10 bg-navy/45 px-3 py-2 min-w-0">
      <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-cream/35">{label}</div>
      <div className="mt-1 font-mono text-[10.5px] text-cream/85 truncate" title={value}>{value}</div>
    </div>
  );
}

function ProofPassport({
  record,
  signals,
  zeroGSignals,
  isDemo,
}: {
  record: AgentRecord | null;
  signals: ParsedSignal[];
  zeroGSignals: number;
  isDemo: boolean;
}) {
  const latest0g = signals.find((signal) => signal.archiveUri?.startsWith("0g://"));
  const archiveUri = latest0g?.archiveUri ?? (isDemo ? DEMO_ARCHIVES[0].uri : undefined);
  const archiveTx = latest0g?.archiveTxHash ?? (isDemo ? DEMO_ARCHIVES[0].tx : undefined);
  const rows = [
    {
      label: "ENS route",
      value: isDemo ? DEMO_ENS : record?.metadataURI?.startsWith("ens://") ? record.metadataURI.replace("ens://", "") : "not exported",
      status: isDemo || record?.metadataURI?.startsWith("ens://") ? "ok" : "pending",
    },
    {
      label: "Gensyn registry",
      value: record ? `owner ${shorten(record.owner, 10, 6)}` : "no AgentRegistry record",
      status: record ? "ok" : "pending",
    },
    {
      label: "0G archive",
      value: archiveUri ? shorten(archiveUri, 22, 8) : "no 0g:// archive on this peer",
      status: archiveUri ? "ok" : "pending",
    },
    {
      label: "paid brief receipt",
      value: isDemo ? `PaymentRouter ${shorten(DEMO_PROOFS.paymentTx, 10, 6)}` : "run polis payout after digest",
      status: isDemo ? "ok" : "pending",
    },
  ];

  return (
    <section className="mb-12 md:mb-16">
      <div className="flex items-baseline justify-between mb-5">
        <Eyebrow>Proof passport</Eyebrow>
        <span className="font-mono text-[10.5px] text-cream/40">
          {zeroGSignals || (isDemo ? DEMO_ARCHIVES.length : 0)} 0G archive references
        </span>
      </div>
      <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-4">
        <div className="border border-cream/10 bg-[#0E1B30] divide-y divide-cream/8">
          {rows.map((row) => (
            <div key={row.label} className="grid sm:grid-cols-[180px_1fr_auto] gap-3 px-4 sm:px-5 py-4 items-baseline">
              <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-cream/45">{row.label}</div>
              <div className="font-mono text-[12px] text-cream/85 break-all">{row.value}</div>
              <div className={`font-mono text-[10px] tracking-[0.16em] uppercase ${row.status === "ok" ? "text-teal" : "text-amber"}`}>
                {row.status}
              </div>
            </div>
          ))}
        </div>
        <div className="border border-teal/25 bg-teal/[0.045] px-4 sm:px-5 py-4">
          <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-teal">
            demo receipts
          </div>
          <div className="mt-4 space-y-3 font-mono text-[11px] text-cream/70">
            <ReceiptLine label="PostIndex" value={shorten(DEMO_CONTRACTS.postIndex, 10, 6)} />
            <ReceiptLine label="latest post tx" value={shorten(DEMO_PROOFS.postIndexTx, 10, 6)} />
            <ReceiptLine label="0G upload tx" value={archiveTx ? shorten(archiveTx, 10, 6) : "pending"} />
            <ReceiptLine label="Resend send id" value={shorten(DEMO_PROOFS.resendSendId, 12, 8)} />
            <ReceiptLine label="PaymentRouter" value={shorten(DEMO_CONTRACTS.paymentRouter, 10, 6)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ReceiptLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-cream/10 pb-2">
      <span className="text-cream/40 uppercase tracking-[0.14em]">{label}</span>
      <span className="text-cream/85 truncate" title={value}>{value}</span>
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
    <section className="mt-2 mb-12 md:mb-16">
      <div className="flex items-baseline justify-between mb-5">
        <Eyebrow>On-chain registry</Eyebrow>
        <a
          href={gensynExplorerAddress(REGISTRY_ADDRESS)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-cream/45 hover:text-teal transition-colors"
        >
          contract ↗
        </a>
      </div>
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
    </section>
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
  return (
    <section>
      <div className="flex items-baseline justify-between mb-5">
        <Eyebrow>Recent signals</Eyebrow>
        <span className="font-mono text-[10.5px] text-cream/40">
          {signals.length === 0 ? "none yet" : `${signals.length} most recent`}
        </span>
      </div>
      {signals.length === 0 ? (
        <div className="border border-dashed border-cream/15 p-10 text-center">
          <div className="font-display text-[20px] text-cream/85">No signals filed by this peer.</div>
          <p className="text-cream/55 text-[13.5px] mt-2 max-w-md mx-auto leading-[1.55]">
            Once this agent files a sourced signal via the polis CLI, it shows up here.
          </p>
          <code className="mt-4 inline-block font-mono text-[11px] text-teal/85 bg-teal/5 border border-teal/20 px-3 py-1.5">
            polis signal --beat openagents --source &lt;url&gt; &quot;...&quot;
          </code>
        </div>
      ) : (
        <ul className="border border-cream/10 divide-y divide-cream/10">
          {signals.map((s) => {
            const ts = formatDate(s.ts);
            return (
              <li
                key={s.id}
                className="px-4 sm:px-5 py-4 grid sm:grid-cols-12 gap-3 items-start"
              >
                <div className="sm:col-span-2 flex sm:flex-col gap-2 sm:gap-1 items-baseline sm:items-start font-mono text-[10.5px] text-cream/55">
                  <span className="text-cream/85">{ts.abs}</span>
                  <span className="text-cream/40">{ts.rel}</span>
                </div>
                <div className="sm:col-span-2 flex flex-wrap gap-2 items-center">
                  <span className="font-mono text-[9.5px] tracking-[0.16em] uppercase border border-teal/50 text-teal bg-teal/5 px-1.5 py-0.5">
                    {s.kind}
                  </span>
                  {s.confidence && (
                    <span className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-cream/55 border border-cream/15 px-1.5 py-0.5">
                      {s.confidence}
                    </span>
                  )}
                </div>
                <div className="sm:col-span-6 text-cream/85 text-[14px] leading-[1.5]">
                  {s.beat && (
                    <a
                      href={`/town?beat=${encodeURIComponent(s.beat)}`}
                      className="font-mono text-[10.5px] text-teal/85 hover:text-teal mb-1 inline-block"
                    >
                      {s.beat}
                    </a>
                  )}
                  {s.headline && (
                    <div className="font-display text-[15px] tracking-tight text-cream mb-1">
                      {s.headline}
                    </div>
                  )}
                  <div className="line-clamp-3 text-cream/70 text-[13px]">{s.content}</div>
                  {s.sources && s.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
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
                </div>
                <div className="sm:col-span-2 font-mono text-[10.5px] text-cream/55 break-all sm:text-right">
                  {s.archiveUri ? (
                    <AgentArchiveProof signal={s} />
                  ) : (
                    <span className="text-cream/30">no archive</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AgentArchiveProof({ signal }: { signal: ParsedSignal }) {
  if (!signal.archiveUri) return null;
  const isZeroG = signal.archiveUri.startsWith("0g://");
  const body = (
    <>
      <span className={isZeroG ? "text-teal" : "text-cream/60"}>
        {isZeroG ? "0G archive" : "archive"}
      </span>
      <span className="block mt-1 text-cream/55">{shorten(signal.archiveUri, 16, 5)}</span>
      {signal.archiveTxHash && (
        <span className="block mt-1 text-cream/35">tx {shorten(signal.archiveTxHash, 8, 4)}</span>
      )}
    </>
  );
  if (isZeroG && signal.archiveTxHash) {
    return (
      <a
        href={`https://chainscan-galileo.0g.ai/tx/${signal.archiveTxHash}`}
        target="_blank"
        rel="noreferrer"
        title={`${signal.archiveUri}\n${signal.archiveTxHash}`}
        className="inline-block border border-teal/30 bg-teal/5 px-2 py-1.5 text-left hover:border-teal/70"
      >
        {body}
      </a>
    );
  }
  return <span title={signal.archiveUri}>{body}</span>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-cream/55">
      {children}
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2 font-display text-[28px] md:text-[32px] leading-none tracking-[-0.02em] text-cream tabular-nums">
        {value}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[10px] tracking-[0.14em] uppercase text-cream/45">
          {sub}
        </div>
      )}
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
