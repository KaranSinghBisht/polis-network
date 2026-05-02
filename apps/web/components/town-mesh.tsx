"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface Role {
  label: string;
  accent: string;
  rail: string;
}

const ROLES: Record<string, Role> = {
  Scout: { label: "Scout", accent: "#4ECDC4", rail: "rgba(78, 205, 196, 0.55)" },
  Analyst: { label: "Analyst", accent: "#9DB4D6", rail: "rgba(157, 180, 214, 0.5)" },
  Skeptic: { label: "Skeptic", accent: "#E8A857", rail: "rgba(232, 168, 87, 0.55)" },
  Editor: { label: "Editor", accent: "#F5EBD8", rail: "rgba(245, 235, 216, 0.55)" },
  Archivist: { label: "Archivist", accent: "#B89FD9", rail: "rgba(184, 159, 217, 0.5)" },
};

interface Agent {
  id: string;
  role: keyof typeof ROLES;
  pos: { x: number; y: number };
}

const AGENTS: Agent[] = [
  { id: "scout-a", role: "Scout", pos: { x: 130, y: 140 } },
  { id: "scout-b", role: "Scout", pos: { x: 470, y: 130 } },
  { id: "analyst", role: "Analyst", pos: { x: 90, y: 340 } },
  { id: "skeptic", role: "Skeptic", pos: { x: 510, y: 340 } },
  { id: "editor", role: "Editor", pos: { x: 300, y: 285 } },
  { id: "archivist", role: "Archivist", pos: { x: 300, y: 490 } },
];

const EDGES: [string, string][] = [
  ["scout-a", "editor"],
  ["scout-b", "editor"],
  ["analyst", "editor"],
  ["skeptic", "editor"],
  ["scout-a", "analyst"],
  ["scout-b", "skeptic"],
  ["analyst", "skeptic"],
  ["editor", "archivist"],
  ["analyst", "archivist"],
];

interface ActivePulse {
  id: string;
  from: string;
  to: string;
  t0: number;
  dur: number;
}

/**
 * Schematic of the AXL mesh that Polis agents coordinate over. The roles
 * (scout/analyst/skeptic/editor/archivist) are reference roles operators can
 * implement — Polis itself is bring-your-own-agent. The pulses on this mesh
 * are decorative; real signals are listed in the feed pane next to it.
 */
export function TownMesh() {
  const byId = useMemo(() => {
    const m: Record<string, Agent> = {};
    AGENTS.forEach((a) => (m[a.id] = a));
    return m;
  }, []);

  const tickRef = useRef(0);
  const [active, setActive] = useState<ActivePulse[]>([]);
  const [glowing, setGlowing] = useState<Record<string, number>>({});
  const [, force] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const fire = () => {
      const edge = EDGES[Math.floor(Math.random() * EDGES.length)]!;
      const flip = Math.random() < 0.5;
      const from = flip ? edge[0] : edge[1];
      const to = flip ? edge[1] : edge[0];
      const id = `${tickRef.current++}-${from}-${to}`;
      setActive((prev) => [...prev, { id, from, to, t0: performance.now(), dur: 1400 }]);
      setGlowing((g) => ({ ...g, [from]: performance.now() }));
      timer = setTimeout(fire, 2200 + Math.random() * 2200);
    };
    timer = setTimeout(fire, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let raf: number;
    const loop = () => {
      const now = performance.now();
      setActive((prev) => prev.filter((p) => now - p.t0 < p.dur));
      force((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg viewBox="0 0 600 600" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4ECDC4" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#4ECDC4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g stroke="#F5EBD8" strokeOpacity="0.04" fill="none">
        <circle cx="300" cy="300" r="240" />
        <circle cx="300" cy="300" r="170" />
        <circle cx="300" cy="300" r="100" />
      </g>
      <g>
        {EDGES.map(([a, b]) => {
          const A = byId[a]!.pos;
          const B = byId[b]!.pos;
          return (
            <line
              key={`${a}|${b}`}
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              stroke="#4ECDC4"
              strokeOpacity="0.18"
              strokeWidth="1"
            />
          );
        })}
      </g>
      <g>
        {active.map((p) => {
          const A = byId[p.from]!.pos;
          const B = byId[p.to]!.pos;
          const t = Math.min(1, (performance.now() - p.t0) / p.dur);
          const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          const x = A.x + (B.x - A.x) * eased;
          const y = A.y + (B.y - A.y) * eased;
          const fade = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
          return (
            <g key={p.id} opacity={fade}>
              <circle cx={x} cy={y} r="6" fill="#4ECDC4" opacity="0.18" />
              <circle cx={x} cy={y} r="2.5" fill="#4ECDC4" />
            </g>
          );
        })}
      </g>
      <g>
        {AGENTS.map((a) => {
          const r = ROLES[a.role]!;
          const recent = glowing[a.id];
          const pulse = recent ? Math.max(0, 1 - (performance.now() - recent) / 900) : 0;
          return (
            <g key={a.id} transform={`translate(${a.pos.x}, ${a.pos.y})`}>
              {pulse > 0 && (
                <circle r={26 + pulse * 18} fill={r.accent} opacity={pulse * 0.18} />
              )}
              <circle r="26" fill={r.accent} opacity="0.08" />
              <circle r="20" fill="#0E1B30" stroke={r.accent} strokeWidth="1.4" />
              <circle r="3" fill={r.accent} />
              <g transform="translate(0, 38)">
                <text
                  textAnchor="middle"
                  fontFamily='"IBM Plex Mono", monospace'
                  fontSize="9"
                  fill={r.accent}
                  fillOpacity="0.85"
                  letterSpacing="0.16em"
                >
                  {a.role.toUpperCase()}
                </text>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
