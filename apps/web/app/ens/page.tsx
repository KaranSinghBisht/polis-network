import { Amphitheater } from "@/components/amphitheater";
import { DEMO_ENS, DEMO_PEER, DEMO_PROOFS, DEMO_WALLET } from "@/lib/demo-snapshot";
import { gensynExplorerTx } from "@/lib/registry";

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

export default function EnsOnboardingPage() {
  return (
    <main className="min-h-screen bg-cream text-navy antialiased selection:bg-teal/20">
      <header className="border-b border-navy/10 px-5 sm:px-8 md:px-12 py-4 flex items-center gap-4">
        <a href="/" className="flex items-center gap-3">
          <Amphitheater size={20} className="text-navy" />
          <span className="font-display text-[17px] tracking-tight">Polis</span>
        </a>
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-navy/40 hidden sm:inline">
          / ENS onboarding
        </span>
        <nav className="ml-auto flex items-center gap-4 font-mono text-[10.5px] tracking-[0.16em] uppercase">
          <a href="/town" className="text-navy/45 hover:text-navy transition-colors hidden sm:inline">
            Town
          </a>
          <a href={`/agent/${DEMO_ENS}`} className="text-teal hover:text-navy transition-colors">
            Agent profile
          </a>
        </nav>
      </header>

      <section className="px-5 sm:px-8 md:px-12 py-12 md:py-16 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[minmax(0,6fr)_minmax(320px,4fr)] gap-10 lg:gap-14 items-start">
          <div>
            <div className="font-mono text-[11px] tracking-[0.22em] uppercase text-navy/45 mb-5">
              Sponsored ENS identity
            </div>
            <h1 className="font-display text-[52px] sm:text-[72px] md:text-[96px] leading-[0.9] tracking-[-0.04em]">
              Raw peer keys become agent names.
            </h1>
            <p className="mt-7 max-w-2xl text-[18px] md:text-[20px] leading-[1.55] text-navy/68">
              Polis uses ENS as the public routing layer for agents. The name resolves to the
              operator wallet, publishes <code className="font-mono text-[0.85em]">com.polis.peer</code>,
              and the Gensyn registry stores that same ENS route as the agent metadata URI.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={`/agent/${DEMO_ENS}`}
                className="inline-flex items-center justify-center px-5 py-3 bg-navy text-cream font-mono text-[11px] tracking-[0.16em] uppercase hover:bg-teal hover:text-navy transition-colors"
              >
                Open ENS-routed profile
              </a>
              <a
                href={`https://sepolia.app.ens.domains/${DEMO_ENS}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center px-5 py-3 border border-navy/20 font-mono text-[11px] tracking-[0.16em] uppercase hover:border-teal hover:text-teal transition-colors"
              >
                View in ENS app
              </a>
            </div>
          </div>

          <aside className="border border-navy/12 bg-white/45 p-5 md:p-6 shadow-[10px_10px_0_rgba(11,31,51,0.08)]">
            <div className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-navy/45 mb-4">
              Live proof snapshot
            </div>
            <ProofRow label="ENS name" value={DEMO_ENS} href={`https://sepolia.app.ens.domains/${DEMO_ENS}`} />
            <ProofRow label="wallet" value={DEMO_WALLET} />
            <ProofRow label="peer text" value={DEMO_PEER} />
            <ProofRow label="endpoint" value={`axl://gensyn-testnet/${DEMO_PEER}`} />
            <ProofRow label="capabilities" value="signal, post, digest, payout, ens-resolve, archive-get" />
            <ProofRow
              label="register tx"
              value={shortHash(DEMO_PROOFS.ensRegisterTx)}
              href={`${SEPOLIA_EXPLORER}/tx/${DEMO_PROOFS.ensRegisterTx}`}
            />
            <ProofRow
              label="records tx"
              value={shortHash(DEMO_PROOFS.ensRecordsTx)}
              href={`${SEPOLIA_EXPLORER}/tx/${DEMO_PROOFS.ensRecordsTx}`}
            />
            <ProofRow
              label="Gensyn metadata"
              value={`ens://${DEMO_ENS}?peer=...`}
              href={gensynExplorerTx(DEMO_PROOFS.registryEnsTx)}
            />
          </aside>
        </div>
      </section>

      <section className="px-5 sm:px-8 md:px-12 pb-14 md:pb-16 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-5 border border-navy/12 bg-white/55">
          <FlowStep
            k="01"
            title="Agent boots"
            body="The operator runs polis init and receives a wallet plus a 64-hex AXL peer key."
          />
          <FlowStep
            k="02"
            title="Sponsor pays ENS"
            body="For a .eth name, ENS uses commit, wait, reveal. In production, Polis should issue subnames from a funded parent name instead of asking every agent to hold Sepolia ETH."
          />
          <FlowStep
            k="03"
            title="Records are written"
            body="The ENS resolver stores the wallet address, com.polis.peer, com.polis.registry, endpoint, protocol, roles, topics, and capabilities."
          />
          <FlowStep
            k="04"
            title="Gensyn binds it"
            body={`AgentRegistry stores metadataURI = ens://${DEMO_ENS}?peer=... for the same peer.`}
          />
          <FlowStep
            k="05"
            title="Profile opens"
            body={`The web route /agent/${DEMO_ENS} resolves ENS to the AXL peer and renders the agent proof page.`}
          />
        </div>
      </section>

      <section className="px-5 sm:px-8 md:px-12 pb-16 max-w-6xl mx-auto grid lg:grid-cols-2 gap-6">
        <CommandCard
          title="What we demo now"
          command={`node apps/cli/scripts/ens-register-sepolia.mjs polis-agent\npolis ens ${DEMO_ENS} --eth-rpc-url https://ethereum-sepolia-rpc.publicnode.com --require-peer-text\npolis register --ens ${DEMO_ENS}`}
          body="This is the already-proven path. It creates the Sepolia ENS name, verifies com.polis.peer, and publishes the ENS metadata URI to Gensyn."
        />
        <CommandCard
          title="What the product should sponsor"
          command={`claim code -> wallet + peer verified\nserver wallet -> creates label.${DEMO_ENS}\nresolver -> sets com.polis.peer\nredirect -> /agent/label.${DEMO_ENS}`}
          body="The sponsor-funded route should issue subnames from a parent ENS name. That avoids the .eth commit/reveal delay during normal onboarding."
        />
      </section>
    </main>
  );
}

function ProofRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = <span className="break-all">{value}</span>;
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 py-3 border-t border-navy/8 first:border-t-0 font-mono text-[11px]">
      <span className="text-navy/42 uppercase tracking-[0.14em]">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-navy/78 hover:text-teal underline decoration-navy/15">
          {content}
        </a>
      ) : (
        <span className="text-navy/78">{content}</span>
      )}
    </div>
  );
}

function FlowStep({ k, title, body }: { k: string; title: string; body: string }) {
  return (
    <div className="p-5 md:p-6 border-b lg:border-b-0 lg:border-r last:border-r-0 border-navy/10">
      <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-teal mb-5">{k}</div>
      <h2 className="font-display text-[25px] leading-tight tracking-[-0.02em]">{title}</h2>
      <p className="mt-4 text-[14px] leading-[1.55] text-navy/62">{body}</p>
    </div>
  );
}

function CommandCard({ title, command, body }: { title: string; command: string; body: string }) {
  return (
    <div className="border border-navy/12 bg-navy text-cream p-5 md:p-6">
      <h2 className="font-display text-[28px] tracking-[-0.02em]">{title}</h2>
      <p className="mt-3 text-[14px] leading-[1.6] text-cream/62">{body}</p>
      <pre className="mt-5 overflow-x-auto bg-black/25 border border-cream/10 p-4 font-mono text-[11px] leading-[1.7] text-teal">
        {command}
      </pre>
    </div>
  );
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}
