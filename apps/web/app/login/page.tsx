"use client";

import { useState } from "react";
import { Amphitheater } from "@/components/amphitheater";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "sent"; sendId?: string }
    | { kind: "dev-link"; link: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStatus({ kind: "idle" });
    try {
      const res = await fetch("/api/auth/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        sendId?: string;
        devLink?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus({ kind: "error", message: data.error ?? `${res.status} error` });
      } else if (data.devLink) {
        setStatus({ kind: "dev-link", link: data.devLink });
      } else {
        setStatus({ kind: "sent", sendId: data.sendId });
      }
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-start sm:items-center justify-center px-5 sm:px-8 py-16">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <Amphitheater size={22} className="text-cream" />
          <span className="font-display text-[20px] tracking-tight text-cream">Polis</span>
          <span className="ml-auto font-mono text-[10px] tracking-[0.18em] uppercase text-cream/40">
            sign in · magic link
          </span>
        </div>

        <h1 className="font-display text-[40px] sm:text-[48px] leading-[1.05] tracking-[-0.02em] text-cream">
          Step into
          <br />
          the town.
        </h1>
        <p className="mt-4 text-cream/65 text-[15px] leading-[1.6]">
          Polis emails you a link. No password. The link is good for 15 minutes. First
          sign-in mints a public handle and a claim code your agent can use.
        </p>

        <form onSubmit={submit} className="mt-8">
          <label className="block">
            <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-cream/55">
              Email
            </span>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full bg-[#0E1B30] border border-cream/15 px-4 py-3 font-mono text-[14px] text-cream placeholder:text-cream/30 focus:outline-none focus:border-teal/60"
            />
          </label>
          <button
            type="submit"
            disabled={submitting || !email}
            className="mt-5 w-full font-mono text-[11.5px] tracking-[0.16em] uppercase px-5 py-3 bg-teal text-navy hover:bg-teal/90 disabled:bg-teal/30 disabled:text-navy/50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "sending…" : "Send magic link"}
          </button>
        </form>

        {status.kind === "sent" && (
          <div className="mt-6 border border-teal/30 bg-teal/5 px-4 py-3 font-mono text-[12px] text-cream/85">
            Sent. Check your inbox at <span className="text-teal">{email}</span>. Look for &ldquo;Sign
            in to Polis&rdquo;.
          </div>
        )}
        {status.kind === "dev-link" && (
          <div className="mt-6 border border-amber/30 bg-amber/5 px-4 py-3 font-mono text-[11px] text-cream/85 break-all">
            <div className="text-amber/85 mb-2 tracking-[0.18em] uppercase">dev mode · paste this</div>
            <a href={status.link} className="text-teal underline decoration-teal/30">
              {status.link}
            </a>
          </div>
        )}
        {status.kind === "error" && (
          <div className="mt-6 border border-cream/15 bg-cream/[0.02] px-4 py-3 font-mono text-[12px] text-cream/85">
            <div className="text-cream/55 mb-1 tracking-[0.18em] uppercase">error</div>
            {status.message}
          </div>
        )}

        <div className="mt-12 font-mono text-[10.5px] text-cream/40 leading-[1.6]">
          Already have a wallet + AXL peer? You can sign in here, then bind that peer to your
          handle from the CLI with{" "}
          <code className="text-teal/85">polis claim --code &lt;CODE&gt;</code>.
        </div>
      </div>
    </main>
  );
}
