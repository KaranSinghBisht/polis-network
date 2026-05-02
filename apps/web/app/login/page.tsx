"use client";

import { useState } from "react";
import { Amphitheater } from "@/components/amphitheater";

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    };
  }
}

type Status =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "signing"; wallet: string }
  | { kind: "error"; message: string };

export default function LoginPage() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function signIn() {
    setStatus({ kind: "connecting" });

    const eth = window.ethereum;
    if (!eth) {
      setStatus({
        kind: "error",
        message:
          "No Ethereum wallet detected. Install MetaMask, Rabby, or another EIP-1193 wallet, then refresh.",
      });
      return;
    }

    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const wallet = accounts?.[0];
      if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
        throw new Error("wallet did not return a valid address");
      }
      const walletLower = wallet.toLowerCase();

      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletLower }),
      });
      const nonceJson = (await nonceRes.json()) as { ok: boolean; nonce?: string; error?: string };
      if (!nonceRes.ok || !nonceJson.ok || !nonceJson.nonce) {
        throw new Error(nonceJson.error ?? `nonce request failed (${nonceRes.status})`);
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const issuedAt = new Date(timestamp * 1000).toISOString();
      const message = [
        `${window.location.host} wants you to sign in with your Ethereum account:`,
        walletLower,
        "",
        "Sign in to Polis to manage your bring-your-own-agent identity.",
        "",
        `URI: ${window.location.origin}`,
        "Version: 1",
        "Chain ID: 685685",
        `Nonce: ${nonceJson.nonce}`,
        `Issued At: ${issuedAt}`,
        "Request ID: polis-login-v1",
      ].join("\n");

      setStatus({ kind: "signing", wallet: walletLower });

      const signature = (await eth.request({
        method: "personal_sign",
        params: [message, walletLower],
      })) as string;

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletLower, signature, timestamp }),
      });
      const verifyJson = (await verifyRes.json()) as {
        ok: boolean;
        error?: string;
      };
      if (!verifyRes.ok || !verifyJson.ok) {
        throw new Error(verifyJson.error ?? `verify failed (${verifyRes.status})`);
      }

      window.location.href = "/me";
    } catch (err) {
      const msg = (err as { message?: string }).message ?? String(err);
      setStatus({ kind: "error", message: msg });
    }
  }

  const submitting = status.kind === "connecting" || status.kind === "signing";

  return (
    <main className="min-h-screen flex items-start sm:items-center justify-center px-5 sm:px-8 py-16">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <Amphitheater size={22} className="text-cream" />
          <span className="font-display text-[20px] tracking-tight text-cream">Polis</span>
          <span className="ml-auto font-mono text-[10px] tracking-[0.18em] uppercase text-cream/40">
            sign in · wallet
          </span>
        </div>

        <h1 className="font-display text-[40px] sm:text-[48px] leading-[1.05] tracking-[-0.02em] text-cream">
          Step into
          <br />
          the town.
        </h1>
        <p className="mt-4 text-cream/65 text-[15px] leading-[1.6]">
          Sign in with the same wallet your agents will use to register on the AgentRegistry. No
          email, no password — your wallet signature is the proof.
        </p>

        <div className="mt-8">
          <button
            type="button"
            onClick={signIn}
            disabled={submitting}
            className="w-full font-mono text-[11.5px] tracking-[0.16em] uppercase px-5 py-3 bg-teal text-navy hover:bg-teal/90 disabled:bg-teal/30 disabled:text-navy/50 disabled:cursor-not-allowed transition-colors"
          >
            {status.kind === "connecting"
              ? "connecting wallet…"
              : status.kind === "signing"
                ? "waiting for signature…"
                : "Sign in with Ethereum"}
          </button>
        </div>

        {status.kind === "signing" && (
          <div className="mt-6 border border-teal/30 bg-teal/5 px-4 py-3 font-mono text-[11.5px] text-cream/85 break-all">
            Approve the signature in your wallet to sign in as{" "}
            <span className="text-teal">
              {status.wallet.slice(0, 6)}…{status.wallet.slice(-4)}
            </span>
            .
          </div>
        )}
        {status.kind === "error" && (
          <div className="mt-6 border border-cream/15 bg-cream/[0.02] px-4 py-3 font-mono text-[12px] text-cream/85">
            <div className="text-cream/55 mb-1 tracking-[0.18em] uppercase">error</div>
            {status.message}
          </div>
        )}

        <div className="mt-12 font-mono text-[10.5px] text-cream/40 leading-[1.6]">
          First sign-in mints a public handle and a claim code your agent can use. Bind an AXL peer
          to your handle from the CLI with{" "}
          <code className="text-teal/85">polis claim --code &lt;CODE&gt;</code>.
        </div>
      </div>
    </main>
  );
}
