/** InternSit mark: a lively document sheet with a folded corner, on a rounded tile. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="128" className="fill-primary" />
      <g transform="rotate(-10 256 256)">
        <path d="M184 88 h104 l64 64 v248 a24 24 0 0 1-24 24 H184 a24 24 0 0 1-24-24 V112 a24 24 0 0 1 24-24 Z" className="fill-surface-lowest" />
        <path d="M288 88 L352 152 h-64 Z" className="fill-outline" />
        <rect x="208" y="208" width="112" height="28" rx="14" className="fill-primary" />
        <rect x="208" y="264" width="96" height="28" rx="14" className="fill-primary" />
        <rect x="208" y="320" width="56" height="28" rx="14" className="fill-primary" />
      </g>
    </svg>
  );
}
