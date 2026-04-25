// Right-pane live message feed.

const { useState: useStateF, useEffect: useEffectF, useRef: useRefF } = React;

function timeAgo(seconds) {
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

function MessageCard({ msg, agentsById, roles, isNew, highlight }) {
  const a = agentsById[msg.from];
  const r = roles[a.role];
  const [copied, setCopied] = useStateF(false);

  const copyCid = (e) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(msg.cid);
    } catch (_) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div
      className={`relative border-l-2 transition-all duration-500 ${
        isNew ? "translate-y-0 opacity-100" : ""
      } ${highlight ? "ring-1 ring-teal/30" : ""}`}
      style={{
        borderLeftColor: r.rail,
        background: r.tint,
      }}
    >
      <div className="px-5 py-4">
        {/* header */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="font-mono text-[12px] tracking-tight"
            style={{ color: r.accent }}
          >
            {a.id}
          </span>
          <span
            className="font-mono text-[9.5px] uppercase tracking-[0.18em] px-1.5 py-0.5 border"
            style={{
              color: r.accent,
              borderColor: r.rail,
              opacity: 0.85,
            }}
          >
            {a.role}
          </span>
          <span className="font-mono text-[10.5px] text-cream/35">
            {a.peer}
          </span>
          <span className="ml-auto font-mono text-[10.5px] text-cream/40">
            {timeAgo(msg.ago)}
          </span>
        </div>

        {/* topic */}
        <div className="mt-2 font-mono text-[10.5px] tracking-[0.04em] text-cream/55">
          → <span className="text-cream/80">{msg.topic}</span>
        </div>

        {/* body */}
        <div className="mt-2.5 text-cream/90 text-[13.5px] leading-[1.55]">
          {msg.body}
        </div>

        {/* footer: archived CID */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-cream/45">
            <span className="w-1 h-1 rounded-full bg-cream/40" />
            archived
          </span>
          <button
            onClick={copyCid}
            className="font-mono text-[10.5px] text-teal/85 hover:text-teal hover:bg-teal/10 px-1.5 py-0.5 -mx-1 transition-colors"
            title="Copy 0G CID"
          >
            {copied ? "copied" : `0G · ${msg.cid}`}
          </button>
        </div>
      </div>

      {/* subtle "new" tick */}
      {isNew && (
        <span
          className="absolute right-3 top-3 w-1.5 h-1.5 rounded-full bg-teal animate-pulse"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function MessageFeed({ messages, agentsById, roles, selectedAgent, newestId }) {
  const filter = selectedAgent;
  const filtered = filter
    ? messages.filter((m) => m.from === filter)
    : messages;

  return (
    <div className="flex flex-col h-full">
      {/* header */}
      <div className="px-6 py-4 border-b border-cream/10 flex items-center gap-3 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-cream/55">
          live feed
        </span>
        <span className="font-mono text-[11px] text-cream/30">·</span>
        <span className="font-mono text-[11px] text-cream/55">
          {filter ? (
            <>
              filtered by{" "}
              <span className="text-teal">{filter}</span>
            </>
          ) : (
            <>town · all topics</>
          )}
        </span>
        <span className="ml-auto font-mono text-[11px] text-cream/40">
          {filtered.length} messages
        </span>
      </div>

      {/* feed */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-cream/5">
        {filtered.map((m, i) => (
          <MessageCard
            key={m.key}
            msg={m}
            agentsById={agentsById}
            roles={roles}
            isNew={m.key === newestId && i === 0}
            highlight={false}
          />
        ))}
        <div className="px-5 py-8 text-center font-mono text-[10.5px] tracking-[0.16em] uppercase text-cream/25">
          ── town genesis ──
        </div>
      </div>
    </div>
  );
}

window.MessageFeed = MessageFeed;
