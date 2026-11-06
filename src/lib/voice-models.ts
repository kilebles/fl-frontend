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
