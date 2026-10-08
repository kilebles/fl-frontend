"use client"

import { ArrowRight, Check, Zap } from "lucide-react"
import { motion } from "motion/react"

import type { ModeMeta } from "@/lib/modes"
import { cn } from "@/lib/utils"

/** A mode as a card: its pipeline drawn as connected step tiles over a glowing backdrop. */
export function ModeCard({ mode, selected, onSelect }: { mode: ModeMeta; selected: boolean; onSelect: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-surface-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-electric",
        selected ? "border-electric/70" : "border-line hover:border-line-strong"
      )}
    >
      <div className="relative h-32 overflow-hidden">
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-500",
            selected ? "opacity-100" : "opacity-50 group-hover:opacity-80"
          )}
          style={{
            background:
              "radial-gradient(120% 90% at 50% 120%, color-mix(in oklab, var(--electric) 45%, transparent), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(var(--line-strong) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
            maskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />
        <div className="relative flex h-full items-center justify-center gap-2">
          {mode.steps.map((Icon, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <ArrowRight
                  className={cn(
                    "size-3.5 transition-all duration-300",
                    selected ? "text-electric" : "text-faint group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                  )}
                />
              )}
              <span
                className={cn(
                  "grid size-11 place-items-center rounded-xl border backdrop-blur-sm transition-all duration-300",
                  i === mode.steps.length - 1
                    ? selected
                      ? "glow-electric border-transparent bg-electric text-white"
                      : "border-electric/30 bg-electric/15 text-electric"
                    : "border-line-strong bg-background/60 text-muted-foreground"
                )}
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                <Icon className="size-5" />
              </span>
            </div>
          ))}
        </div>
        {mode.flash && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-semibold text-warn">
            <Zap className="size-3 fill-current" /> Flash
          </span>
        )}
        <span
          className={cn(
            "absolute top-3 right-3 grid size-6 place-items-center rounded-full border transition-all",
            selected ? "scale-100 border-transparent bg-electric text-white" : "scale-90 border-line-strong text-transparent"
          )}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-line p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold tracking-tight">{mode.title}</h3>
          <span className="font-mono text-[11px] text-faint">{mode.short}</span>
        </div>
        <p className="text-[13px] leading-snug text-muted-foreground">{mode.description}</p>
      </div>
    </motion.button>
  )
}
