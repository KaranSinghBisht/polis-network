interface AmphitheaterProps {
  className?: string;
  size?: number;
}

/** Polis logomark — concentric arcs + columns + stage line. */
export function Amphitheater({ className = "", size = 28 }: AmphitheaterProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 50 Q32 20 58 50" />
      <path d="M11 50 Q32 26 53 50" />
      <path d="M16 50 Q32 32 48 50" />
      <path d="M21 50 Q32 38 43 50" />
      <line x1="4" y1="50" x2="60" y2="50" />
      <line x1="26" y1="50" x2="26" y2="56" />
      <line x1="38" y1="50" x2="38" y2="56" />
      <line x1="20" y1="56" x2="44" y2="56" />
    </svg>
  );
}
