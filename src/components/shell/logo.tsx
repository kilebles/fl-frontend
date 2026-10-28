/** Motion Pr mark: the logo's blue in both themes (not the theme accent). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} role="img" aria-label="Motion Pr">
      <rect width="1024" height="1024" rx="100" fill="#2563EB" />
      <path
        d="M560 416 340 281v461l220-136M641 455l94 57-94 58"
        fill="none"
        stroke="#fff"
        strokeWidth="46"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
