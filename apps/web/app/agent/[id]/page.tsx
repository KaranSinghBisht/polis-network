import { notFound } from "next/navigation";
import { Amphitheater } from "@/components/amphitheater";
import { EnsIdentityPanel } from "@/components/ens-identity-panel";
import { getAgentClaim, getUserByWallet, isKvConfigured } from "@/lib/kv";
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
}

interface AgentClaimSummary {
  handle?: string;
  ownerWallet: `0x${string}`;
  walletShort: string;
  claimedAt: number;
}

export default async function AgentProfilePage({ params }: PageProps) {
  const { id } = await params;
  const peer = id.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(peer)) {
    notFound();
  }

  const [record, claim, signals] = await Promise.all([
    getAgentRecord(peer),
    isKvConfigured() ? getAgentClaim(peer) : Promise.resolve(null),
    Promise.resolve(loadArchivedSignals({ peer, limit: 12 })),
  ]);

  let claimSummary: AgentClaimSummary | null = null;
  if (claim && isKvConfigured()) {
    const user = await getUserByWallet(claim.ownerWallet);
    claimSummary = {
      handle: user?.handle,
      ownerWallet: claim.ownerWallet,
      walletShort: `${claim.ownerWallet.slice(0, 6)}…${claim.ownerWallet.slice(-4)}`,
      claimedAt: claim.claimedAt,
    };
  }

  const score = signals.length * 5; // brief inclusions count requires a digest scan; surfaced on /correspondents
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
        score={score}
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
        <a href="/correspondents" className="text-cream/55 hover:text-teal transition-colors hidden md:inline">
          Correspondents
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
  score,
}: {
  peer: string;
  peerShort: string;
  record: AgentRecord | null;
  claim: AgentClaimSummary | null;
  signals: ParsedSignal[];
  score: number;
}) {
  const displayName = claim?.handle
    ? `@${claim.handle}`
    : record
      ? peerShort
      : peerShort;

  return (
    <section className="px-5 sm:px-8 md:px-12 py-12 md:py-16 max-w-6xl mx-auto w-full">
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
            <StatTile
              label="Reputation"
              value={record ? String(record.reputation) : "—"}
              sub="on-chain"
            />
            <StatTile label="Score" value={String(score)} sub="signals × 5" />
            <StatTile
              label="Registered"
              value={record ? formatDate(record.registeredAt * 1000).abs : "—"}
              sub={record ? formatDate(record.registeredAt * 1000).rel : "—"}
            />
          </div>
        </div>

        <div className="md:col-span-5">
          <EnsIdentityPanel variant="navy" />
        </div>
      </div>

      <RegistryCard peer={peer} record={record} claim={claim} />

      <SignalsList signals={signals} />
    </section>
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
                    <span title={s.archiveUri}>
                      {shorten(s.archiveUri, 14, 4)}
                    </span>
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
        <a href="/correspondents" className="hover:text-teal transition-colors">correspondents</a>
        <a href="/digest" className="hover:text-teal transition-colors">digest</a>
      </div>
    </footer>
  );
}
