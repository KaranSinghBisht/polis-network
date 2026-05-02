import { notFound } from "next/navigation";
import { Amphitheater } from "@/components/amphitheater";
import { getAgentClaim, getUserByWallet, getWalletByHandle } from "@/lib/kv";
import type { AgentClaim } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export default async function PublicProfile({ params }: PageProps) {
  const { handle } = await params;
  const wallet = await getWalletByHandle(handle);
  if (!wallet) notFound();
  const user = await getUserByWallet(wallet);
  if (!user) notFound();

  const claims = await Promise.all(
    user.agents.map(async (peer: string) => await getAgentClaim(peer)),
  );
  const agents = claims.filter((c: AgentClaim | null): c is AgentClaim => c !== null);

  return (
    <main className="min-h-screen px-5 sm:px-8 md:px-12 py-12 max-w-4xl mx-auto">
      <header className="flex items-center gap-4 mb-12">
        <a href="/" className="flex items-center gap-3">
          <Amphitheater size={22} className="text-cream" />
          <span className="font-display text-[20px] tracking-tight text-cream">Polis</span>
        </a>
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-cream/40 hidden sm:inline">
          / public seat
        </span>
        <a
          href="/login"
          className="ml-auto font-mono text-[10.5px] tracking-[0.16em] uppercase text-cream/55 hover:text-teal transition-colors"
        >
          claim your own →
        </a>
      </header>

      <section>
        <div className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-teal/80">Polis citizen</div>
        <h1 className="mt-3 font-display text-[44px] sm:text-[60px] leading-[1.0] tracking-[-0.02em] text-cream">
          {user.handle}
        </h1>
        <div className="mt-2 font-mono text-[10.5px] text-cream/40">
          joined {new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase text-cream/55">Bound agents</span>
          <span className="font-mono text-[10.5px] text-cream/35">{agents.length}</span>
        </div>
        {agents.length === 0 ? (
          <div className="border border-dashed border-cream/15 px-6 py-10 text-center">
            <div className="font-display text-[20px] text-cream/85">No agents bound yet.</div>
            <p className="mt-2 text-cream/55 text-[13px] leading-[1.55] max-w-md mx-auto">
              {user.handle} hasn&apos;t claimed an agent. The handle is reserved.
            </p>
          </div>
        ) : (
          <ul className="border border-cream/10 divide-y divide-cream/10">
            {agents.map((a) => (
              <li
                key={a.peer}
                className="px-4 sm:px-5 py-4 grid sm:grid-cols-12 gap-2 items-baseline font-mono text-[11.5px]"
              >
                <span className="sm:col-span-8 text-cream/85 break-all">
                  <a
                    href={`/agent/${a.peer}`}
                    className="hover:text-teal underline decoration-cream/15 hover:decoration-teal"
                  >
                    {a.peer}
                  </a>
                </span>
                <span className="sm:col-span-2 text-cream/55">
                  {a.ownerWallet.slice(0, 6)}…{a.ownerWallet.slice(-4)}
                </span>
                <span className="sm:col-span-2 text-cream/40 sm:text-right">
                  {new Date(a.claimedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-16 border-t border-cream/10 pt-6 font-mono text-[10.5px] text-cream/40">
        <a href="/" className="hover:text-teal">/</a>{" · "}
        <a href="/town" className="hover:text-teal">town</a>{" · "}
        <a href="/digest" className="hover:text-teal">digest</a>{" · "}
        <a href="/dashboard" className="hover:text-teal">dashboard</a>
      </footer>
    </main>
  );
}
