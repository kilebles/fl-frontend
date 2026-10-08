"use client"

import { useRef, useState } from "react"
import { Loader2, Upload, X } from "lucide-react"

import { cn } from "@/lib/utils"

interface DropzoneProps {
  accept: string
  title: string
  hint: string
  busy?: boolean
  preview?: string | null
  fileName?: string | null
  onFile: (file: File) => void
  onClear?: () => void
  className?: string
}

export function Dropzone({ accept, title, hint, busy, preview, fileName, onFile, onClear, className }: DropzoneProps) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  if (fileName) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-line-strong bg-surface-2 p-2.5", className)}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-14 rounded-lg object-cover ring-1 ring-line" />
        ) : (
          <span className="grid size-14 place-items-center rounded-lg bg-electric/15 text-electric">
            <Upload className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{fileName}</p>
          <p className="text-xs text-muted-foreground">{busy ? "Загрузка…" : "Загружено"}</p>
        </div>
        {busy ? (
          <Loader2 className="mr-2 size-4 animate-spin text-electric" />
        ) : (
          onClear && (
            <button type="button" onClick={onClear} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-elev hover:text-foreground">
              <X className="size-4" />
            </button>
          )
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files)
      }}
      className={cn(
        "group flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors",
        over ? "border-electric bg-electric/10" : "border-line-strong bg-surface-2/60 hover:border-electric/50 hover:bg-surface-2",
        className
      )}
    >
      <span className={cn("grid size-10 place-items-center rounded-full transition-colors", over ? "bg-electric text-white" : "bg-elev text-muted-foreground group-hover:text-electric")}>
        {busy ? <Loader2 className="size-4.5 animate-spin" /> : <Upload className="size-4.5" />}
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          take(e.target.files)
          e.target.value = ""
        }}
      />
    </button>
  )
}
