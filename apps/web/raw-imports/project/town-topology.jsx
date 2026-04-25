// Topology graph: SVG with nodes + edges + animated message pulses.

const { useState, useEffect, useRef, useMemo } = React;

function Topology({ agents, edges, roles, pulses, onSelect, selected }) {
  const svgRef = useRef(null);

  const byId = useMemo(() => {
    const m = {};
    agents.forEach((a) => (m[a.id] = a));
    return m;
  }, [agents]);

  // Refs to each edge path for sampling along it
  const edgePathRefs = useRef({});

  // Active pulse instances: { id, edgeKey, from, to, t0, dur, reverse }
  const [active, setActive] = useState([]);
  const tickRef = useRef(0);

  // Whenever a new pulse arrives, push it into active
  useEffect(() => {
    if (!pulses || pulses.length === 0) return;
    const last = pulses[pulses.length - 1];
    const edgeKey = edgeKeyFor(last.from, last.to);
    const reverse = !edges.find(
      ([a, b]) => a === last.from && b === last.to,
    );
    const id = `${tickRef.current++}-${last.from}-${last.to}`;
    setActive((prev) => [
      ...prev,
      {
        id,
        edgeKey,
        from: last.from,
        to: last.to,
        t0: performance.now(),
        dur: 1400,
        reverse,
      },
    ]);
    // also nudge the node-glow
    setGlowing((g) => ({ ...g, [last.from]: performance.now() }));
  }, [pulses]);

  const [glowing, setGlowing] = useState({});

  // Animation loop: position pulses along their edge paths
  const [, force] = useState(0);
  useEffect(() => {
    let raf;
    const loop = () => {
      const now = performance.now();
      // drop expired
      setActive((prev) => prev.filter((p) => now - p.t0 < p.dur));
      force((n) => (n + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function edgeKeyFor(a, b) {
    return [a, b].sort().join("|");
  }

  // Build edge list with stable keys
  const renderedEdges = edges.map(([a, b]) => ({
    a,
    b,
    key: edgeKeyFor(a, b),
  }));

  // Determine connected nodes if one is selected
  const neighborSet = useMemo(() => {
    if (!selected) return null;
    const s = new Set([selected]);
    edges.forEach(([a, b]) => {
      if (a === selected) s.add(b);
      if (b === selected) s.add(a);
    });
    return s;
  }, [selected, edges]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 600 600"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4ECDC4" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#4ECDC4" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* concentric guide rings — subtle classical flourish */}
      <g stroke="#F5EBD8" strokeOpacity="0.04" fill="none">
        <circle cx="300" cy="300" r="240" />
        <circle cx="300" cy="300" r="170" />
        <circle cx="300" cy="300" r="100" />
      </g>

      {/* edges */}
      <g>
        {renderedEdges.map(({ a, b, key }) => {
          const A = byId[a].pos;
          const B = byId[b].pos;
          const dim =
            neighborSet && !(neighborSet.has(a) && neighborSet.has(b));
          return (
            <line
              key={key}
              ref={(el) => (edgePathRefs.current[key] = el)}
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              stroke="#4ECDC4"
              strokeOpacity={dim ? 0.06 : 0.18}
              strokeWidth="1"
            />
          );
        })}
      </g>

      {/* moving pulses */}
      <g>
        {active.map((p) => {
          const A = byId[p.from].pos;
          const B = byId[p.to].pos;
          const t = Math.min(1, (performance.now() - p.t0) / p.dur);
          // ease out-in
          const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const x = A.x + (B.x - A.x) * eased;
          const y = A.y + (B.y - A.y) * eased;
          const fade =
            t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
          return (
            <g key={p.id} opacity={fade}>
              <circle cx={x} cy={y} r="6" fill="#4ECDC4" opacity="0.18" />
              <circle cx={x} cy={y} r="2.5" fill="#4ECDC4" />
            </g>
          );
        })}
      </g>

      {/* nodes */}
      <g>
        {agents.map((a) => {
          const r = roles[a.role];
          const isSel = selected === a.id;
          const dim = neighborSet && !neighborSet.has(a.id);
          const recent = glowing[a.id];
          const pulse = recent ? Math.max(0, 1 - (performance.now() - recent) / 900) : 0;
          return (
            <g
              key={a.id}
              transform={`translate(${a.pos.x}, ${a.pos.y})`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(isSel ? null : a.id)}
              opacity={dim ? 0.4 : 1}
            >
              {/* outer glow on activity */}
              {pulse > 0 && (
                <circle
                  r={26 + pulse * 18}
                  fill={r.accent}
                  opacity={pulse * 0.18}
                />
              )}
              {/* halo */}
              <circle r="26" fill={r.accent} opacity="0.08" />
              {/* core */}
              <circle
                r="20"
                fill="#0E1B30"
                stroke={r.accent}
                strokeWidth={isSel ? 2 : 1.4}
              />
              {/* role glyph dot */}
              <circle r="3" fill={r.accent} />

              {/* label */}
              <g transform="translate(0, 38)">
                <text
                  textAnchor="middle"
                  fontFamily='"IBM Plex Mono", monospace'
                  fontSize="10.5"
                  fill="#F5EBD8"
                  fillOpacity="0.92"
                  letterSpacing="0.04em"
                >
                  {a.id}
                </text>
                <text
                  y="14"
                  textAnchor="middle"
                  fontFamily='"IBM Plex Mono", monospace'
                  fontSize="9"
                  fill={r.accent}
                  fillOpacity="0.85"
                  letterSpacing="0.16em"
                >
                  {a.role.toUpperCase()}
                </text>
                <text
                  y="30"
                  textAnchor="middle"
                  fontFamily='"IBM Plex Mono", monospace'
                  fontSize="9"
                  fill="#F5EBD8"
                  fillOpacity="0.45"
                  letterSpacing="0.08em"
                >
                  rep · {a.rep}
                </text>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

window.Topology = Topology;
