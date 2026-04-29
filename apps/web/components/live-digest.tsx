"use client";

import { useEffect, useState } from "react";

interface DigestSummary {
  id: string;
  title: string;
  markdown: string;
  generatedAt: string;
  signalCount: number;
  signals: Array<{
    id: string;
    from: string;
    topic: string;
    archiveUri?: string;
  }>;
}

interface DigestResponse {
  digest: DigestSummary | null;
  sourceDir: string;
}

export function LiveDigest() {
  const [data, setData] = useState<DigestResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/digest/latest", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((json: DigestResponse) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({ digest: null, sourceDir: "" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data?.digest) return null;

  const digest = data.digest;
  const lines = digest.markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("# "));

  return (
    <section className="border-b border-navy/15 bg-teal/[0.08]">
      <div className="max-w-[900px] mx-auto px-5 sm:px-8 md:px-12 py-10 md:py-12">
        <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-teal mb-4">
          Live paid intelligence brief
        </div>
        <h2 className="font-display text-[30px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-navy font-medium">
          {digest.title}
        </h2>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] tracking-[0.12em] uppercase text-navy/55">
          <span>{new Date(digest.generatedAt).toUTCString()}</span>
          <span>{digest.signalCount} archived signals</span>
          <span>{digest.id}</span>
        </div>
        <div className="mt-7 space-y-3">
          {lines.slice(0, 8).map((line, index) => (
            <p key={index} className="font-serif text-[17px] md:text-[19px] leading-[1.55] text-navy/80">
              {line.replace(/^-\s*/, "")}
            </p>
          ))}
        </div>
        <div className="mt-7 pt-5 border-t border-navy/15 font-mono text-[10.5px] tracking-[0.08em] text-navy/55">
          {digest.signals.slice(0, 4).map((signal) => (
            <div key={`${signal.id}-${signal.from}`} className="truncate">
              {signal.topic} · {shortPeer(signal.from)} · {signal.archiveUri ?? signal.id}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function shortPeer(peer: string): string {
  return peer.length > 12 ? `${peer.slice(0, 10)}...${peer.slice(-4)}` : peer;
}
