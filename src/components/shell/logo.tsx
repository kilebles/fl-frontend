import Link from "next/link"

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="glow-electric relative grid size-8 place-items-center overflow-hidden rounded-[10px] bg-electric">
        <svg viewBox="0 0 24 24" className="size-4.5 text-white" fill="none" aria-hidden>
          <path d="M4 8v8M8 5v14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M12 6.5v11a.6.6 0 0 0 .9.5l8-5.5a.6.6 0 0 0 0-1l-8-5.5a.6.6 0 0 0-.9.5Z" fill="currentColor" />
        </svg>
        <span className="absolute inset-0 bg-linear-to-b from-white/25 to-transparent" />
      </span>
      <span className="text-[17px] font-semibold tracking-tight">
        flow<span className="text-electric">gen</span>
      </span>
    </Link>
  )
}
