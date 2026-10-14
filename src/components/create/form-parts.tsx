"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

export const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

export interface Picture {
  key: string | null
  name: string
  preview: string
  busy: boolean
}

/** An input picture uploaded to the API as soon as it is picked. */
export function usePicture() {
  const [picture, setPicture] = useState<Picture | null>(null)
  const upload = async (file: File) => {
    const preview = URL.createObjectURL(file)
    setPicture({ key: null, name: file.name, preview, busy: true })
    try {
      const { key } = await api.upload(file)
      setPicture({ key, name: file.name, preview, busy: false })
    } catch (e) {
      setPicture(null)
      toast.error((e as Error).message)
    }
  }
  return { picture, upload, clear: () => setPicture(null) }
}

export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex min-h-8 items-center gap-2.5">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <div className="ml-auto">{aside}</div>
      </div>
      {children}
    </section>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon?: React.ElementType }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-background/50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn("relative flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors", value === o.value ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 rounded-lg bg-elev ring-1 ring-line-strong" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          {o.icon && <o.icon className="relative size-3.5" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function PromptArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="flex items-center justify-between text-[13px] text-muted-foreground">
        {label}
        <span className="font-mono text-xs text-faint tabular-nums">{lines(value).length}</span>
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="min-h-72 w-full resize-y rounded-xl border border-line-strong bg-background/60 p-3.5 font-mono text-[13px] leading-relaxed outline-none placeholder:text-faint focus:border-electric/60 focus:ring-3 focus:ring-electric/15"
      />
    </label>
  )
}
