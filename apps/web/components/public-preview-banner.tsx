/**
 * Conditional banner shown only on the public Vercel deploy.
 *
 * The operator console / agent profile / digest pages all read live data from
 * ~/.polis on the operator's machine. On a public deploy that filesystem does
 * not exist, so those panes correctly render their empty states. This banner
 * tells visitors why they're seeing empty states and points them at the CLI.
 *
 * Set POLIS_WEB_PUBLIC_DEMO=1 in the Vercel project's environment variables to
 * surface this banner. Localhost dev never sees it.
 */
export function PublicPreviewBanner() {
  if (process.env.POLIS_WEB_PUBLIC_DEMO !== "1") return null;

  return (
    <div className="bg-teal/10 border-b border-teal/20 text-cream/85">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 md:px-12 py-2.5 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 font-mono text-[10.5px] tracking-[0.14em] uppercase">
        <span className="text-teal/85 shrink-0">● Public preview</span>
        <span className="text-cream/60 normal-case tracking-normal text-[12.5px] leading-[1.5]">
          Live operator data is read from <code className="font-mono text-cream/85">~/.polis/</code> on
          the operator&apos;s machine. Run <code className="font-mono text-teal/85">polis init</code>{" "}
          locally to populate the dashboard, agent profile, and digest panes.
        </span>
        <a
          href="https://github.com/KaranSinghBisht/polis-network"
          target="_blank"
          rel="noreferrer"
          className="ml-auto shrink-0 text-teal/85 hover:text-teal underline decoration-teal/30"
        >
          GitHub →
        </a>
      </div>
    </div>
  );
}
