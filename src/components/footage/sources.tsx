"use client"

import { useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Loader2, RefreshCw } from "lucide-react"
import { useState } from "react"

import { GROUPS, GROUP_COLOR, GROUP_LABEL, TYPE_LABEL } from "@/components/footage/parts"
import { fkeys, useFootageOptions, useFootageSources } from "@/components/footage/queries"
import { Card } from "@/components/script/ui"
import { footage } from "@/lib/api"
import { cn } from "@/lib/utils"

const PROVIDER: Record<string, string> = {
  commons: "Wikimedia Commons",
  internet_archive: "Internet Archive",
  met: "The Met",
  youtube: "YouTube",
  pexels: "Pexels",
  pixabay: "Pixabay",
  loc: "Библиотека Конгресса",
  nasa: "NASA",
  nara: "NARA",
  dvids: "DVIDS",
}
const ROUTE_ORDER = ["location", "archive", "reenactment", "atmosphere", "artifact", "artwork", "portrait"]

export function SourcesScreen() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useFootageSources()
  const { data: options } = useFootageOptions()
  const [busy, setBusy] = useState(false)
  const recheck = async () => {
    setBusy(true)
    try {
      qc.setQueryData(fkeys.sources, await footage.sources(true))
    } finally {
      setBusy(false)
    }
  }
  if (isLoading)
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-xs text-faint">
        <Loader2 className="size-4 animate-spin" />
        проверяю источники и движки
      </div>
    )
  if (error || !data) return <div className="py-16 text-center text-sm text-danger">{error?.message ?? "Нет данных"}</div>

  const routing = data.routing ?? options?.routing ?? {}
  const def = options?.defaults
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {GROUPS.map((g) => {
          const st = data.groups.find((x) => x.group === g)
          const skipped = Object.entries(st?.skipped ?? {})
          return (
            <Card
              key={g}
              title={
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", GROUP_COLOR[g])} />
                  {GROUP_LABEL[g]}
                </span>
              }
              aside={
                <span className="font-mono text-[11px] text-faint">{st ? `${st.providers.length}/${st.providers.length + skipped.length}` : "выкл."}</span>
              }
              bodyClass="p-0"
            >
              {!st ? (
                <p className="px-4 py-3 text-xs text-faint">Выключено в settings.yaml</p>
              ) : (
                <ul>
                  {st.providers.map((p) => (
                    <li key={p} className="flex items-center gap-2.5 border-b border-line px-4 py-2.5 last:border-b-0">
                      <span className="size-1.5 shrink-0 rounded-full bg-ok" />
                      <span className="min-w-0 flex-1 text-sm">{PROVIDER[p] ?? p}</span>
                      <span className="text-[11px] text-faint">работает</span>
                    </li>
                  ))}
                  {skipped.map(([p, why]) => (
                    <li key={p} className="flex items-start gap-2.5 border-b border-line px-4 py-2.5 last:border-b-0">
                      <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", why.startsWith("ошибка") ? "bg-danger" : "bg-line-strong")} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-muted-foreground">{PROVIDER[p] ?? p}</span>
                        <span className="mt-0.5 block font-mono text-[11px] leading-snug text-faint">{why}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="Порядок поиска по типу кадра" bodyClass="p-0">
          <ul>
            {ROUTE_ORDER.filter((t) => routing[t]).map((type) => (
              <li key={type} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                <span className="text-sm text-foreground-2">{TYPE_LABEL[type] ?? type}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {routing[type].map((g, i) => (
                    <span key={g} className="flex items-center gap-1.5">
                      {i > 0 && <ArrowRight className="size-3 text-faint" />}
                      <span className="flex items-center gap-1.5 rounded-[3px] border border-line bg-background px-2 py-1 text-xs">
                        <span className={cn("size-1.5 rounded-full", GROUP_COLOR[g])} />
                        {GROUP_LABEL[g] ?? g}
                      </span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Сервер"
          aside={
            <button
              type="button"
              disabled={busy}
              onClick={recheck}
              className="flex items-center gap-1 text-xs text-faint hover:text-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              проверить
            </button>
          }
          bodyClass="p-0"
        >
          <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3.5 text-sm">
            {Object.entries(data.engines).map(([stage, val]) => (
              <div key={stage} className="contents">
                <dt className="text-muted-foreground">{stage === "planner" ? "Шот-лист" : "Отбор кадров"}</dt>
                <dd className={cn("font-mono text-xs leading-5", val.includes("НЕ ГОТОВ") ? "text-danger" : "text-foreground-2")}>{val}</dd>
              </div>
            ))}
            {def && (
              <>
                <dt className="text-muted-foreground">Порог · хватит</dt>
                <dd className="font-mono text-xs leading-5 text-foreground-2">
                  {def.min_score ?? "—"} · {def.accept_score ?? "—"}
                </dd>
                <dt className="text-muted-foreground">Пачка</dt>
                <dd className="font-mono text-xs leading-5 text-foreground-2">{def.batch ?? "—"} кадров за вызов</dd>
              </>
            )}
            <dt className="text-muted-foreground">Проверено</dt>
            <dd className="font-mono text-xs leading-5 text-faint">{data.checked?.replace("T", " ").slice(0, 16)}</dd>
          </dl>
        </Card>
      </div>
    </div>
  )
}
