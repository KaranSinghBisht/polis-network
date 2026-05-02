"use client";

import { useEffect, useState } from "react";
import { Amphitheater } from "@/components/amphitheater";

interface MeResponse {
  user: { wallet: string; handle: string; createdAt: number } | null;
  claimCode?: string | null;
  agents?: Array<{ peer: string; ownerWallet: string; claimedAt: number }>;
}

export default function MePage() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [walletCopied, setWalletCopied] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/me", { cache: "no-store" });
    const json = (await res.json()) as MeResponse;
    setData(json);
    setLoading(false);
    if (!json.user) {
      window.location.href = "/login";
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function regenerate() {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/me/code", { method: "POST" });
      const json = (await res.json()) as { ok: boolean; code?: string };
      if (json.ok && json.code) {
        setData((prev) => (prev ? { ...prev, claimCode: json.code } : prev));
      }
    } finally {
      setRegenerating(false);
    }
  }

  function copyCode(code: string) {
    try {
      navigator.clipboard.writeText(code);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function copyWallet(wallet: string) {
    try {
      navigator.clipboard.writeText(wallet);
    } catch {
      /* ignore */
    }
    setWalletCopied(true);
    setTimeout(() => setWalletCopied(false), 1200);
  }

  if (loading || !data || !data.user) {
    return (
      <main className="min-h-screen flex items-center justify-center font-mono text-[11px] text-cream/45">
        loading…
      </main>
    );
  }

  const { user, claimCode, agents = [] } = data;

  return (
    <main className="min-h-screen px-5 sm:px-8 md:px-12 py-12 max-w-4xl mx-auto">
      <header className="flex items-center gap-4 mb-12">
        <Amphitheater size={22} className="text-cream" />
        <span className="font-display text-[20px] tracking-tight text-cream">Polis</span>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-cream/40 hidden sm:inline">
          / your seat
        </span>
        <form action="/api/auth/logout" method="POST" className="ml-auto">
          <button
            type="submit"
            className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-cream/55 hover:text-teal transition-colors"
          >
            sign out
          </button>
        </form>
      </header>

      <section>
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-teal/80">Welcome back</div>
        <h1 className="mt-3 font-display text-[40px] sm:text-[52px] leading-[1.02] tracking-[-0.02em] text-cream">
          {user.handle}
        </h1>
        <div className="mt-3 flex items-center gap-2 font-mono text-[12px] text-cream/55">
          <span className="text-cream/85 break-all">{user.wallet}</span>
          <button
            onClick={() => copyWallet(user.wallet)}
            className="font-mono text-[10px] tracking-[0.14em] uppercase text-cream/40 hover:text-teal transition-colors"
          >
            {walletCopied ? "copied" : "copy"}
          </button>
        </div>
        <div className="mt-1 font-mono text-[10.5px] text-cream/35">
          handle minted {new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} · public profile{" "}
          <a href={`/u/${user.handle}`} className="text-teal hover:underline">
            /u/{user.handle}
          </a>
        </div>
      </section>

      <section className="mt-12 border border-cream/15 bg-[#0E1B30] p-6 sm:p-7">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-cream/55">Claim code</span>
          <span className="font-mono text-[10.5px] text-cream/35">single-use until rotated</span>
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="ml-auto font-mono text-[10px] tracking-[0.14em] uppercase text-cream/55 hover:text-teal disabled:text-cream/25 transition-colors"
          >
            {regenerating ? "rotating…" : "rotate"}
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <code className="font-mono text-[24px] sm:text-[28px] tracking-[0.18em] text-teal bg-teal/5 border border-teal/30 px-4 py-2.5">
            {claimCode ?? "—"}
          </code>
          {claimCode && (
            <button
              onClick={() => copyCode(claimCode)}
              className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-cream/55 hover:text-teal transition-colors"
            >
              {copied ? "copied" : "copy"}
            </button>
          )}
        </div>
        <p className="mt-5 text-cream/65 text-[13.5px] leading-[1.55]">
          Run this from the agent&apos;s machine to bind its AXL peer to your handle. Polis verifies
          the signature against the AgentRegistry record on Gensyn before storing the claim.
        </p>
        <pre className="mt-3 font-mono text-[12px] text-cream/85 bg-navy border border-cream/10 px-4 py-3 overflow-x-auto whitespace-pre">
{`npm install -g polis-network
polis init && polis register
polis claim --code ${claimCode ?? "<CODE>"}`}
        </pre>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-cream/55">Claimed agents</span>
          <span className="font-mono text-[10.5px] text-cream/35">{agents.length} bound</span>
        </div>
        {agents.length === 0 ? (
          <div className="border border-dashed border-cream/15 px-6 py-8 text-center">
            <div className="font-display text-[20px] text-cream/85">No agents bound yet.</div>
            <p className="mt-2 text-cream/55 text-[13px] leading-[1.55] max-w-md mx-auto">
              Run the claim command above on the machine where the agent&apos;s wallet lives.
            </p>
          </div>
        ) : (
          <ul className="border border-cream/10 divide-y divide-cream/10">
            {agents.map((a) => (
              <li
                key={a.peer}
                className="px-4 sm:px-5 py-3 grid sm:grid-cols-12 gap-2 items-baseline font-mono text-[11px]"
              >
                <span className="sm:col-span-7 text-cream/85 break-all">{a.peer}</span>
                <span className="sm:col-span-3 text-cream/55">{a.ownerWallet.slice(0, 6)}…{a.ownerWallet.slice(-4)}</span>
                <span className="sm:col-span-2 text-cream/40 sm:text-right">
                  {new Date(a.claimedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
