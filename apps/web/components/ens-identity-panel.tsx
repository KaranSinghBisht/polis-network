"use client";

import { useEffect, useState } from "react";

interface ProofStep {
  label: string;
  value: string;
  ok: boolean;
  detail?: string;
}

function demoTokenHeaders(): HeadersInit | undefined {
  const token = new URLSearchParams(window.location.search).get("token");
  return token ? { "x-polis-demo-token": token } : undefined;
}

interface EnsIdentity {
  generatedAt: string;
  ens: {
    name: string;
    resolvedAddress: string;
    chainAddress?: string;
    chainId?: number;
    primaryName?: string;
    description?: string;
    url?: string;
  };
  records: {
    peer?: string;
    agent?: string;
    roles?: string;
    topics?: string;
    registry?: string;
  };
  wallet: {
    address: string;
    network: string;
    chainId: number;
  };
  peer: {
    hex: string;
    bytes32: string;
    matchesEns: boolean;
  };
  registry?: {
    address: string;
    owner: string;
    metadataURI: string;
    registeredAt: number;
    reputation: number;
    matchesWallet: boolean;
  };
  archive?: {
    cid: string;
    uri: string;
    topic: string;
    content: string;
    ts: number;
    archiveTxHash?: string;
  };
  chain: { steps: ProofStep[] };
}

interface ApiResponse {
  identity: EnsIdentity | null;
  source: "proof" | "config" | "demo" | "none" | "disabled";
  sourcePath: string;
}

type Variant = "navy" | "paper";

interface PanelProps {
  variant?: Variant;
}

export function EnsIdentityPanel({ variant = "navy" }: PanelProps) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ens/identity", { cache: "no-store", headers: demoTokenHeaders() })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((json: ApiResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const palette = paletteFor(variant);

  if (error) return null;
  if (!data) return <PanelShell palette={palette}><LoadingBlock palette={palette} /></PanelShell>;
  if (!data.identity) {
    return (
      <PanelShell palette={palette}>
        <DemoBlock palette={palette} sourcePath={data.sourcePath} />
      </PanelShell>
    );
  }

  return (
    <PanelShell palette={palette}>
      <LiveIdentity identity={data.identity} source={data.source} palette={palette} />
    </PanelShell>
  );
}

interface Palette {
  card: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  rule: string;
  rail: string;
  ok: string;
  warn: string;
  mono: string;
  badgeOk: string;
  badgeWarn: string;
}

function paletteFor(variant: Variant): Palette {
  if (variant === "paper") {
    return {
      card: "bg-paper",
      border: "border-navy/15",
      text: "text-navy",
      textDim: "text-navy/65",
      textFaint: "text-navy/45",
      rule: "border-navy/15",
      rail: "border-l-teal/70",
      ok: "text-teal",
      warn: "text-amber",
      mono: "font-mono",
      badgeOk: "border-teal/55 text-teal",
      badgeWarn: "border-amber/55 text-amber",
    };
  }
  return {
    card: "bg-[#0E1B30]",
    border: "border-cream/12",
    text: "text-cream",
    textDim: "text-cream/75",
    textFaint: "text-cream/45",
    rule: "border-cream/12",
    rail: "border-l-teal/70",
    ok: "text-teal",
    warn: "text-amber",
    mono: "font-mono",
    badgeOk: "border-teal/55 text-teal",
    badgeWarn: "border-amber/55 text-amber",
  };
}

function PanelShell({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return (
    <section className={`border ${palette.border} ${palette.card}`}>
      <header className={`px-5 sm:px-6 py-3.5 border-b ${palette.rule} flex items-baseline gap-3 flex-wrap`}>
        <span className={`font-mono text-[10.5px] tracking-[0.22em] uppercase ${palette.textDim}`}>
          ENS identity · proof chain
        </span>
        <span className={`font-mono text-[10px] tracking-[0.16em] uppercase ${palette.textFaint} ml-auto`}>
          proof-backed identity
        </span>
      </header>
      <div className="px-5 sm:px-6 py-5">{children}</div>
    </section>
  );
}

function LoadingBlock({ palette }: { palette: Palette }) {
  return (
    <div className={`font-mono text-[12px] ${palette.textFaint}`}>resolving identity…</div>
  );
}

function DemoBlock({ palette, sourcePath }: { palette: Palette; sourcePath: string }) {
  return (
    <div>
      <div className={`flex items-baseline gap-2 mb-3 font-mono text-[10.5px] tracking-[0.18em] uppercase ${palette.warn}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber/80" />
        demo transcript
      </div>
      <p className={`text-[14px] leading-[1.6] ${palette.textDim} max-w-prose`}>
        No live proof bundle found. Run{" "}
        <code className={`px-1.5 py-0.5 ${palette.card} border ${palette.border} ${palette.mono} text-[12px] ${palette.text}`}>
          polis ens-export
        </code>{" "}
        after configuring an ENS name to publish a proof file at{" "}
        <span className={`${palette.mono} text-[12px] ${palette.text}`}>{sourcePath}</span>. The
        panel will then render the live ENS → peer → AgentRegistry → archive chain.
      </p>
      <ol className={`mt-5 grid gap-2 ${palette.mono} text-[11.5px] ${palette.textDim} list-decimal pl-5`}>
        <li>polis ens &lt;name&gt; --require-peer-text</li>
        <li>polis register --ens &lt;name&gt; --require-ens-peer-text</li>
        <li>polis post --ens &lt;name&gt; --storage local &quot;hello&quot;</li>
        <li>polis ens-export</li>
      </ol>
    </div>
  );
}

function LiveIdentity({
  identity,
  source,
  palette,
}: {
  identity: EnsIdentity;
  source: ApiResponse["source"];
  palette: Palette;
}) {
  return (
    <div className="space-y-7">
      <Headline identity={identity} source={source} palette={palette} />
      <FieldGrid identity={identity} palette={palette} />
      <ProofChain steps={identity.chain.steps} palette={palette} />
      {identity.archive && <ArchiveCard archive={identity.archive} palette={palette} />}
      <FooterMeta identity={identity} source={source} palette={palette} />
    </div>
  );
}

function Headline({
  identity,
  source,
  palette,
}: {
  identity: EnsIdentity;
  source: ApiResponse["source"];
  palette: Palette;
}) {
  const fresh = source === "proof";
  const demo = source === "demo";
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
      <h3 className={`font-display text-[28px] md:text-[34px] tracking-[-0.02em] ${palette.text}`}>
        {identity.ens.name}
      </h3>
      <span className={`font-mono text-[10px] tracking-[0.18em] uppercase border px-2 py-0.5 ${fresh ? palette.badgeOk : palette.badgeWarn}`}>
        {fresh ? "verified · live" : demo ? "verified · testnet proof" : "verified · cached"}
      </span>
      {identity.peer.matchesEns && (
        <span className={`font-mono text-[10px] tracking-[0.18em] uppercase border px-2 py-0.5 ${palette.badgeOk}`}>
          AXL peer match
        </span>
      )}
    </div>
  );
}

function FieldGrid({ identity, palette }: { identity: EnsIdentity; palette: Palette }) {
  const rows: Array<{ label: string; value: React.ReactNode; mono?: boolean }> = [
    {
      label: "wallet",
      value: identity.wallet.address,
      mono: true,
    },
    {
      label: "network",
      value: `${identity.wallet.network} · chain ${identity.wallet.chainId}`,
    },
    {
      label: "AXL peer",
      value: identity.peer.hex || "(not derivable)",
      mono: true,
    },
    {
      label: "ENS address record",
      value: identity.ens.resolvedAddress,
      mono: true,
    },
  ];

  if (identity.ens.chainAddress) {
    rows.push({
      label: `chain ${identity.ens.chainId ?? "?"} address`,
      value: identity.ens.chainAddress,
      mono: true,
    });
  }
  if (identity.ens.primaryName) {
    rows.push({ label: "primary name", value: identity.ens.primaryName });
  }
  if (identity.records.roles) {
    rows.push({ label: "roles", value: identity.records.roles });
  }
  if (identity.records.topics) {
    rows.push({ label: "topics", value: identity.records.topics });
  }
  if (identity.records.registry) {
    rows.push({ label: "text registry", value: identity.records.registry, mono: true });
  }
  if (identity.registry) {
    rows.push({
      label: "registry metadataURI",
      value: identity.registry.metadataURI,
      mono: true,
    });
    rows.push({
      label: "registry contract",
      value: identity.registry.address,
      mono: true,
    });
    rows.push({
      label: "reputation",
      value: identity.registry.reputation.toString(),
    });
  }

  return (
    <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
      {rows.map((row) => (
        <div key={row.label} className={`flex items-baseline gap-3 border-b ${palette.rule} pb-2`}>
          <dt className={`shrink-0 w-[120px] font-mono text-[10.5px] tracking-[0.16em] uppercase ${palette.textFaint}`}>
            {row.label}
          </dt>
          <dd className={`flex-1 break-all ${row.mono ? `font-mono text-[12px] ${palette.text}` : `text-[13.5px] ${palette.textDim}`}`}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ProofChain({ steps, palette }: { steps: ProofStep[]; palette: Palette }) {
  return (
    <div>
      <div className={`font-mono text-[10.5px] tracking-[0.2em] uppercase ${palette.textFaint} mb-4`}>
        proof chain · ENS → peer → AgentRegistry → AXL → archive
      </div>
      <ol className="space-y-3">
        {steps.map((step, idx) => (
          <li
            key={idx}
            className={`relative pl-6 border-l-2 ${step.ok ? palette.rail : "border-l-amber/45"}`}
          >
            <span className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ${step.ok ? "bg-teal" : "bg-amber"}`} />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`font-mono text-[10.5px] tracking-[0.16em] uppercase ${step.ok ? palette.ok : palette.warn}`}>
                {String(idx + 1).padStart(2, "0")} · {step.label}
              </span>
              <span className={`font-mono text-[10px] tracking-[0.14em] uppercase ${palette.textFaint}`}>
                {step.ok ? "ok" : "pending"}
              </span>
            </div>
            <div className={`mt-1 font-mono text-[12px] break-all ${palette.text}`}>{step.value}</div>
            {step.detail && (
              <div className={`mt-0.5 text-[12px] ${palette.textFaint}`}>{step.detail}</div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ArchiveCard({
  archive,
  palette,
}: {
  archive: NonNullable<EnsIdentity["archive"]>;
  palette: Palette;
}) {
  const ts = new Date(archive.ts).toUTCString();
  return (
    <div className={`border ${palette.border} px-4 py-4`}>
      <div className={`flex items-baseline gap-3 flex-wrap font-mono text-[10.5px] tracking-[0.16em] uppercase ${palette.textFaint}`}>
        <span className={palette.ok}>latest archived AXL post</span>
        <span>{archive.topic}</span>
        <span className="ml-auto">{ts}</span>
      </div>
      <p className={`mt-3 text-[14px] leading-[1.55] ${palette.textDim}`}>{archive.content}</p>
      <div className={`mt-3 font-mono text-[11px] break-all ${palette.text}`}>{archive.uri}</div>
      {archive.archiveTxHash && (
        <div className={`mt-1 font-mono text-[10.5px] ${palette.textFaint}`}>0G tx · {archive.archiveTxHash}</div>
      )}
    </div>
  );
}

function FooterMeta({
  identity,
  source,
  palette,
}: {
  identity: EnsIdentity;
  source: ApiResponse["source"];
  palette: Palette;
}) {
  const generated = new Date(identity.generatedAt).toUTCString();
  return (
    <div className={`flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] tracking-[0.14em] uppercase ${palette.textFaint}`}>
      <span>generated · {generated}</span>
      <span>source · {source === "proof" ? "ens-proof.json" : source === "config" ? "config.json (partial)" : "none"}</span>
      <span>chain · {identity.wallet.chainId}</span>
    </div>
  );
}
