"use client"

import { ArrowRight, KeyRound } from "lucide-react"

import { SOURCES } from "@/components/footage/mock"
import { GROUP_COLOR, GROUP_LABEL, TYPE_LABEL } from "@/components/footage/parts"
import type { FootageGroup, ShotType } from "@/components/footage/types"
import { Card, Label, Pick, Seg } from "@/components/script/ui"
import { cn } from "@/lib/utils"

/** Shot type → groups in priority order (settings.yaml → routing). */
const ROUTES: [ShotType, FootageGroup[]][] = [
  ["location", ["archive", "youtube", "films", "stock"]],
  ["archive", ["archive", "films", "youtube"]],
  ["reenactment", ["youtube", "films", "stock"]],
  ["atmosphere", ["youtube", "stock"]],
  ["artifact", ["archive", "youtube", "stock"]],
  ["artwork", ["archive"]],
  ["portrait", ["archive"]],
]

const STATE: Record<string, [string, string]> = {
  ok: ["bg-ok", "работает"],
  limit: ["bg-warn", "лимит"],
  key: ["bg-line-strong", "нужен ключ"],
  off: ["bg-line-strong", "выключен"],
}

export function SourcesScreen() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SOURCES.map((g) => (
          <Card
            key={g.group}
            title={
              <span className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", GROUP_COLOR[g.group])} />
                {GROUP_LABEL[g.group]}
              </span>
            }
            aside={
              <span className="font-mono text-[11px] text-faint">
                {g.providers.filter((p) => p.state === "ok" || p.state === "limit").length}/{g.providers.length}
              </span>
            }
            bodyClass="p-0"
          >
            <ul>
              {g.providers.map((p) => (
                <li key={p.id} className="flex items-start gap-2.5 border-b border-line px-4 py-2.5 last:border-b-0">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", STATE[p.state][0])} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", p.state === "key" && "text-muted-foreground")}>{p.name}</span>
                    {p.note && (
                      <span className={cn("mt-0.5 flex items-start gap-1 font-mono text-[11px] leading-snug", p.state === "limit" ? "text-warn" : "text-faint")}>
                        {p.state === "key" && <KeyRound className="size-3" />}
                        {p.note}
                      </span>
                    )}
                  </span>
                  <span className={cn("shrink-0 text-[11px]", p.state === "ok" ? "text-faint" : p.state === "limit" ? "text-warn" : "text-muted-foreground")}>
                    {STATE[p.state][1]}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="Порядок поиска по типу кадра" bodyClass="p-0">
          <ul>
            {ROUTES.map(([type, groups]) => (
              <li key={type} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                <span className="text-sm text-foreground-2">{TYPE_LABEL[type]}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {groups.map((g, i) => (
                    <span key={g} className="flex items-center gap-1.5">
                      {i > 0 && <ArrowRight className="size-3 text-faint" />}
                      <span className="flex items-center gap-1.5 rounded-[3px] border border-line bg-background px-2 py-1 text-xs">
                        <span className={cn("size-1.5 rounded-full", GROUP_COLOR[g])} />
                        {GROUP_LABEL[g]}
                      </span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
            <li className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 bg-surface-2/50 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">доп. круг</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 rounded-[3px] border border-line bg-background px-2 py-1">
                  <span className={cn("size-1.5 rounded-full", GROUP_COLOR.youtube)} />
                  YouTube
                </span>
                для всех ненайденных
              </span>
            </li>
          </ul>
        </Card>

        <Card title="По умолчанию">
          <div className="space-y-4">
            <div>
              <Label>Движок</Label>
              <Pick
                value="agy"
                onChange={() => {}}
                options={[
                  { value: "agy", label: "agy (Gemini)", hint: "подписка" },
                  { value: "claude", label: "Claude Code", hint: "подписка" },
                  {
                    value: "gemini_api",
                    label: "Gemini API",
                    hint: "по ключу",
                  },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label aside={<span className="font-mono text-[11px] text-faint">кадров за вызов</span>}>Пачка</Label>
                <Seg
                  value="6"
                  onChange={() => {}}
                  mono
                  options={[
                    ["3", "3"],
                    ["6", "6"],
                    ["10", "10"],
                  ]}
                />
              </div>
              <div>
                <Label aside={<span className="font-mono text-[11px] text-faint">ниже — на ИИ</span>}>Порог</Label>
                <Seg
                  value="7"
                  onChange={() => {}}
                  mono
                  options={[
                    ["6", "6"],
                    ["7", "7"],
                    ["8", "8"],
                  ]}
                />
              </div>
              <div>
                <Label aside={<span className="font-mono text-[11px] text-faint">дальше не ищем</span>}>Хватит</Label>
                <Seg
                  value="8"
                  onChange={() => {}}
                  mono
                  options={[
                    ["7", "7"],
                    ["8", "8"],
                    ["9", "9"],
                  ]}
                />
              </div>
              <div>
                <Label>Доп. круг</Label>
                <Seg
                  value="1"
                  onChange={() => {}}
                  options={[
                    ["0", "нет"],
                    ["1", "1 круг"],
                  ]}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
