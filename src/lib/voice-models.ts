import type { TranslationModelInfo } from "@/lib/api"

/** Levels of an agy model: the id is <family>-<level>, e.g. gemini-4-argon-high. */
export const LEVEL_LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High" }

const base = (id: string) => id.replace(/-(low|medium|high)$/, "")

/** The listed model a translation model id belongs to (the id itself or the same family with another level). */
export function familyOf(id: string, models: TranslationModelInfo[]): TranslationModelInfo | undefined {
  return models.find((m) => m.id === id) ?? models.find((m) => m.levels?.length && base(m.id) === base(id) && m.levels.includes(id.slice(base(id).length + 1)))
}

/** «high» for gemini-4-argon-high; "" for a model without levels. */
export function levelOf(id: string, models: TranslationModelInfo[]): string {
  const f = familyOf(id, models)
  if (!f?.levels?.length) return ""
  const lvl = id.slice(base(id).length + 1)
  return f.levels.includes(lvl) ? lvl : (f.id.slice(base(f.id).length + 1) ?? "")
}

/** The model id for a family and a level (the level is dropped when the family has none or another set). */
export function withLevel(familyId: string, level: string, models: TranslationModelInfo[]): string {
  const f = models.find((m) => m.id === familyId)
  return f?.levels?.includes(level) ? `${base(f.id)}-${level}` : familyId
}

const LEVEL_ORDER = ["high", "medium", "low"]

/** One list for a picker: every family × level («Gemini 4 Argon · High», …), models without levels as they are. */
export function flatModels(models: TranslationModelInfo[]): { value: string; label: string; hint: string; minutes: number }[] {
  return models.flatMap((m) => {
    const levels = [...(m.levels ?? [])].sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))
    const engine = m.engine === "claude" ? "Claude Code" : "Antigravity"
    if (!levels.length) return [{ value: m.id, label: m.label, hint: engine, minutes: m.est_minutes_per_lang }]
    return levels.map((l) => ({
      value: `${base(m.id)}-${l}`,
      label: `${m.label} · ${LEVEL_LABEL[l] ?? l}`,
      hint: engine,
      minutes: Math.max(1, Math.round(m.est_minutes_per_lang * ({ low: 0.7, medium: 1, high: 1.5 }[l] ?? 1) / ({ low: 0.7, medium: 1, high: 1.5 }[m.id.slice(base(m.id).length + 1)] ?? 1))),
    }))
  })
}

/** A short name for lists: «Argon · High», «Claude Opus · Low». */
export function modelLabel(id: string, models: TranslationModelInfo[]): string {
  const f = familyOf(id, models)
  if (!f) return id
  const lvl = levelOf(id, models)
  const name = f.label.replace(/^Gemini [\d.]+ /, "")
  return lvl ? `${name} · ${LEVEL_LABEL[lvl] ?? lvl}` : name
}
