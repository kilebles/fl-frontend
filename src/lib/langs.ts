/** Language codes as the team writes them. The modules keep their own codes (DE, JA, AR…) — only the site shows these. */
const LABELS: Record<string, string> = {
  DE: "GER",
  ES: "ESP",
  PT: "POR",
  PT_BR: "POR",
  JA: "JP",
  AR: "ARB",
  KO: "KOR",
  NL: "DUT",
  TR: "TUR",
  SV: "SWE",
  NO: "NOR",
  DA: "DAN",
  CS: "CZE",
}

/** «ja» / «JA» → «JP»; any other code upper-cased as it is («pt_br» → «PT_BR»). */
export function langCode(code: string | null | undefined): string {
  const c = (code ?? "").trim().toUpperCase().replace("-", "_")
  return LABELS[c] ?? c
}

/** Several codes in one line: «EN, JP, KOR». */
export const langList = (codes: readonly string[], sep = ", ") => codes.map(langCode).join(sep)
