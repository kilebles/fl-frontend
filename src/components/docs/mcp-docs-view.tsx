"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowUpRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Loader2,
  Plus,
  Search,
  Shield,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  CATEGORY_LABELS,
  CLIENT_TABS,
  MCP_PROMPT_TEMPLATES,
  MCP_RESOURCES,
  MCP_TOOLS,
  PIPELINE_STAGES,
  PRESET_TOKEN_NAMES,
  READY_PROMPTS,
  buildClientSnippet,
  type AuthTransport,
  type ClientId,
  type ToolCategory,
  type ToolMode,
} from "@/components/docs/mcp-catalog"
import { PageHeader } from "@/components/shell/page-header"
import { apiBase, auth, type ApiToken, type CreatedApiToken } from "@/lib/api"
import { authKeys, useAuth } from "@/lib/auth"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
})

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : dateTimeFmt.format(d)
}

function CopyButton({
  value,
  label = "Копировать",
  copiedLabel = "Скопировано",
  className,
  toastMessage,
}: {
  value: string
  label?: string
  copiedLabel?: string
  className?: string
  toastMessage?: string
}) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      if (toastMessage) toast.success(toastMessage)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Не удалось скопировать в буфер обмена")
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-[3px] border border-line-strong bg-background px-2.5 text-xs font-medium text-foreground-2 transition-colors hover:border-faint hover:text-foreground",
        copied && "border-ok/40 text-ok",
        className
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5 text-muted-foreground" />}
      {copied ? copiedLabel : label}
    </button>
  )
}

function ModeBadge({ mode }: { mode: ToolMode }) {
  if (mode === "read") {
    return (
      <span className="rounded-[2px] border border-line-strong bg-surface-2 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
        read
      </span>
    )
  }
  if (mode === "destructive") {
    return (
      <span className="rounded-[2px] bg-danger/12 px-1.5 py-px font-mono text-[10px] font-medium text-danger">
        delete
      </span>
    )
  }
  return (
    <span className="rounded-[2px] bg-electric-soft px-1.5 py-px font-mono text-[10px] font-medium text-electric-text">
      action
    </span>
  )
}

export function McpDocsView() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const qc = useQueryClient()

  const [endpointUrl, setEndpointUrl] = useState<string>("/api/mcp")
  const [clientTab, setClientTab] = useState<ClientId>("antigravity")
  const [transport, setTransport] = useState<AuthTransport>("header")
  const [keyName, setKeyName] = useState<string>("Antigravity")
  const [newlyCreated, setNewlyCreated] = useState<CreatedApiToken | null>(null)
  const [revealInConfig, setRevealInConfig] = useState<boolean>(true)
  const [category, setCategory] = useState<ToolCategory>("all")
  const [search, setSearch] = useState<string>("")
  const [copiedTool, setCopiedTool] = useState<string | null>(null)

  useEffect(() => {
    const base = apiBase() || window.location.origin
    setEndpointUrl(`${base.replace(/\/$/, "")}/api/mcp`)
  }, [])

  const tokensQuery = useQuery({
    queryKey: authKeys.tokens,
    queryFn: auth.tokens,
    enabled: Boolean(user),
  })

  const createToken = useMutation({
    mutationFn: (name: string) => auth.createToken({ name }),
    onSuccess: (created) => {
      setNewlyCreated(created)
      setRevealInConfig(true)
      qc.setQueryData<ApiToken[]>(authKeys.tokens, (prev) => [
        {
          id: created.id,
          name: created.name,
          token_prefix: created.token_prefix,
          created_at: created.created_at,
          last_used_at: created.last_used_at,
          expires_at: created.expires_at,
        },
        ...(prev ?? []),
      ])
      toast.success("Ключ MCP выпущен")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const revokeToken = useMutation({
    mutationFn: (id: string) => auth.revokeToken(id),
    onSuccess: (_, id) => {
      qc.setQueryData<ApiToken[]>(authKeys.tokens, (prev) => prev?.filter((t) => t.id !== id))
      if (newlyCreated?.id === id) setNewlyCreated(null)
      toast.success("Ключ отозван")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const tokens = tokensQuery.data ?? []
  const displayToken =
    newlyCreated && revealInConfig ? newlyCreated.token : newlyCreated ? `${newlyCreated.token_prefix}••••••••` : "<ВАШ_КЛЮЧ_MCP>"
  const copyableToken = newlyCreated ? newlyCreated.token : "<ВАШ_КЛЮЧ_MCP>"

  const previewSnippet = useMemo(
    () => buildClientSnippet(clientTab, endpointUrl, displayToken, transport),
    [clientTab, endpointUrl, displayToken, transport]
  )
  const copySnippet = useMemo(
    () => buildClientSnippet(clientTab, endpointUrl, copyableToken, transport),
    [clientTab, endpointUrl, copyableToken, transport]
  )

  const visibleTools = useMemo(
    () => MCP_TOOLS.filter((t) => (isAdmin ? true : !t.adminOnly)),
    [isAdmin]
  )

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: visibleTools.length }
    for (const tool of visibleTools) {
      counts[tool.category] = (counts[tool.category] ?? 0) + 1
    }
    return counts
  }, [visibleTools])

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase()
    return visibleTools.filter((t) => {
      if (category !== "all" && t.category !== category) return false
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        (t.args && t.args.toLowerCase().includes(q))
      )
    })
  }, [visibleTools, category, search])

  const visibleCategories = useMemo(
    () => CATEGORY_LABELS.filter((c) => (isAdmin ? true : !c.adminOnly)),
    [isAdmin]
  )

  const visiblePrompts = useMemo(
    () => READY_PROMPTS.filter((p) => (isAdmin ? true : !p.adminOnly)),
    [isAdmin]
  )

  const visiblePromptTemplates = useMemo(
    () => MCP_PROMPT_TEMPLATES.filter((p) => (isAdmin ? true : !p.adminOnly)),
    [isAdmin]
  )

  function handleCreateKey(e: React.FormEvent) {
    e.preventDefault()
    const clean = keyName.trim()
    if (!clean) {
      toast.error("Укажите название ключа")
      return
    }
    createToken.mutate(clean)
  }

  async function copyToolName(name: string) {
    try {
      await navigator.clipboard.writeText(name)
      setCopiedTool(name)
      window.setTimeout(() => setCopiedTool((prev) => (prev === name ? null : prev)), 1400)
    } catch {
      // ignore clipboard restriction
    }
  }

  const activeClientMeta = CLIENT_TABS.find((t) => t.id === clientTab) ?? CLIENT_TABS[0]

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-20 sm:px-7">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2.5">
            <span>Документация MCP</span>
            <span className="rounded-[2px] border border-electric/35 bg-electric-soft px-2 py-0.5 font-mono text-xs font-medium text-electric-text">
              Streamable HTTP
            </span>
          </span>
        }
        subtitle="Управление очередями, этапами производства и генерациями из ИИ-ассистентов"
        actions={
          <div className="flex items-center gap-1.5 rounded-[4px] border border-line-strong bg-surface p-1 pl-2.5">
            <span className="size-1.5 rounded-full bg-ok" aria-hidden />
            <code className="max-w-[240px] truncate font-mono text-xs text-foreground-2 sm:max-w-[340px]">
              {endpointUrl}
            </code>
            <CopyButton
              value={endpointUrl}
              label="URL"
              copiedLabel="OK"
              toastMessage="Адрес MCP скопирован"
              className="h-6 border-transparent bg-elev px-2"
            />
          </div>
        }
      />

      {/* 1. Keys + Client Config */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: Personal MCP Keys */}
        <section className="flex flex-col rounded-[4px] border border-line bg-surface p-5 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-electric" />
              <h2 className="text-[15px] font-semibold">Ключи доступа</h2>
            </div>
            {tokens.length > 0 && (
              <span className="font-mono text-xs text-muted-foreground">
                {tokens.length} {plural(tokens.length, "активный", "активных", "активных")}
              </span>
            )}
          </div>

          <form onSubmit={handleCreateKey} className="mt-3.5 flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-1">
              {PRESET_TOKEN_NAMES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setKeyName(preset)}
                  className={cn(
                    "rounded-[3px] border px-2 py-0.5 font-mono text-[11px] transition-colors",
                    keyName === preset
                      ? "border-electric/50 bg-electric-soft text-electric-text"
                      : "border-line-strong bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                maxLength={64}
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="Название клиента"
                aria-label="Название ключа MCP"
                className="h-9 min-w-0 flex-1 rounded-[3px] border border-line-strong bg-background px-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-electric"
              />
              <button
                type="submit"
                disabled={createToken.isPending || !user}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[3px] bg-electric px-3.5 text-sm font-medium text-white transition-colors hover:bg-electric-hover disabled:opacity-50"
              >
                {createToken.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Выпустить
              </button>
            </div>
          </form>

          {newlyCreated && (
            <div className="mt-3.5 rounded-[3px] border border-electric/40 bg-electric-soft/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-electric-text">
                  Новый ключ · {newlyCreated.name}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">показывается один раз</span>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <code className="min-w-0 flex-1 truncate rounded-[3px] border border-line-strong bg-background px-2.5 py-1.5 font-mono text-xs text-foreground select-all">
                  {newlyCreated.token}
                </code>
                <CopyButton
                  value={newlyCreated.token}
                  label="Ключ"
                  toastMessage="Ключ MCP скопирован"
                  className="h-7 shrink-0"
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex-1 border-t border-line pt-3">
            {tokensQuery.isLoading ? (
              <div className="h-20 rounded-[3px] shimmer" />
            ) : tokens.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Выпустите персональный ключ <code className="font-mono">flk_…</code> — он сразу подставится в конфигурацию справа.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {tokens.map((tok) => (
                  <div key={tok.id} className="flex items-center justify-between gap-2.5 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{tok.name}</span>
                        <code className="rounded-[2px] bg-surface-2 px-1.5 py-px font-mono text-[11px] text-muted-foreground">
                          {tok.token_prefix}…
                        </code>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-faint">
                        {tok.last_used_at
                          ? `исп. ${formatShortDate(tok.last_used_at)}`
                          : `создан ${formatShortDate(tok.created_at)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={revokeToken.isPending}
                      onClick={() => revokeToken.mutate(tok.id)}
                      aria-label={`Отозвать ключ ${tok.name}`}
                      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[3px] px-2 text-xs text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                      Отзвать
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right: Client Snippets */}
        <section className="flex flex-col rounded-[4px] border border-line bg-surface p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-electric" />
              <h2 className="text-[15px] font-semibold">Подключение клиента</h2>
            </div>

            <div className="flex items-center gap-1.5">
              {newlyCreated && (
                <button
                  type="button"
                  onClick={() => setRevealInConfig((v) => !v)}
                  title={revealInConfig ? "Скрыть ключ на экране" : "Показать ключ на экране"}
                  className="inline-flex h-7 items-center gap-1 rounded-[3px] border border-line-strong bg-background px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {revealInConfig ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              )}
              <div className="flex rounded-[3px] border border-line-strong bg-background p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setTransport("header")}
                  className={cn(
                    "rounded-[2px] px-2 py-0.5 font-mono transition-colors",
                    transport === "header"
                      ? "bg-inverse text-inverse-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Bearer
                </button>
                <button
                  type="button"
                  onClick={() => setTransport("query")}
                  className={cn(
                    "rounded-[2px] px-2 py-0.5 font-mono transition-colors",
                    transport === "query"
                      ? "bg-inverse text-inverse-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  ?token=
                </button>
              </div>
            </div>
          </div>

          {/* Client selector tabs */}
          <div className="mt-3.5 flex flex-wrap gap-1 border-b border-line pb-3">
            {CLIENT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setClientTab(tab.id)}
                className={cn(
                  "h-8 rounded-[3px] px-3 text-xs font-medium transition-colors",
                  clientTab === tab.id
                    ? "bg-elev text-foreground ring-1 ring-line-strong"
                    : "text-muted-foreground hover:bg-elev/60 hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{activeClientMeta.configPath}</span>
            <CopyButton
              value={copySnippet}
              label="Копировать конфиг"
              toastMessage="Конфигурация скопирована"
            />
          </div>

          <pre className="mt-2 flex-1 overflow-x-auto rounded-[3px] border border-line-strong bg-background p-3.5 font-mono text-[12.5px] leading-relaxed text-foreground-2">
            <code>{previewSnippet}</code>
          </pre>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Протокол <code className="font-mono text-foreground-2">MCP 2025-03-26</code> ·{" "}
              {visibleTools.length} {plural(visibleTools.length, "инструмент", "инструмента", "инструментов")} ·{" "}
              3 ресурса
            </span>
            {transport === "query" && (
              <span className="font-mono text-[11px] text-faint">
                Для клиентов без поддержки кастомных HTTP-заголовков
              </span>
            )}
          </div>
        </section>
      </div>

      {/* 2. Pipeline Map */}
      <section className="mt-6 rounded-[4px] border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-electric" />
            <h2 className="text-[15px] font-semibold">Конвейер этапов</h2>
          </div>
          <code className="font-mono text-xs text-muted-foreground">fl://pipeline</code>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage.step}
              className="group flex flex-col justify-between rounded-[3px] border border-line-strong bg-background p-3.5 transition-colors hover:border-faint"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-[2px] bg-electric-soft px-1.5 py-0.5 font-mono text-[11px] font-medium text-electric-text">
                      {stage.step}
                    </span>
                    <Link
                      href={stage.href}
                      className="inline-flex items-center gap-1 text-sm font-semibold hover:text-electric"
                    >
                      {stage.title}
                      <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{stage.flow}</p>
              </div>
              <div className="mt-3 border-t border-line pt-2">
                <button
                  type="button"
                  onClick={() => copyToolName(stage.entryTool)}
                  className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-foreground-2 hover:text-electric"
                >
                  {copiedTool === stage.entryTool ? (
                    <Check className="size-3 text-ok" />
                  ) : (
                    <Copy className="size-3 text-faint" />
                  )}
                  {stage.entryTool}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Ready Prompts */}
      <section className="mt-6 rounded-[4px] border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-electric" />
            <h2 className="text-[15px] font-semibold">Примеры запросов в чат</h2>
          </div>
          <span className="text-xs text-muted-foreground">Нажмите для копирования</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {visiblePrompts.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between gap-3 rounded-[3px] border border-line-strong bg-background p-3.5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-[2px] px-1.5 py-px font-mono text-[10px] font-medium uppercase",
                      item.adminOnly
                        ? "bg-electric-soft text-electric-text"
                        : "bg-surface-2 text-muted-foreground"
                    )}
                  >
                    {item.tag}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.prompt}</p>
              </div>
              <div className="flex justify-end">
                <CopyButton
                  value={item.prompt}
                  label="Скопировать запрос"
                  toastMessage="Запрос скопирован"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Interactive Tool Catalog */}
      <section className="mt-6 rounded-[4px] border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold">Справочник инструментов</h2>
            <span className="rounded-[2px] bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {filteredTools.length}
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск инструмента…"
              aria-label="Поиск инструмента MCP"
              className="h-8 w-full rounded-[3px] border border-line-strong bg-background pr-3 pl-8 text-xs outline-none transition-colors placeholder:text-faint focus:border-electric"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="mt-3.5 flex flex-wrap gap-1 border-b border-line pb-3">
          {visibleCategories.map((cat) => {
            const count = categoryCounts[cat.id] ?? 0
            const active = category === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-[3px] px-2.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-elev text-foreground ring-1 ring-line-strong"
                    : "text-muted-foreground hover:bg-elev/60 hover:text-foreground"
                )}
              >
                {cat.adminOnly && <Shield className="size-3 text-electric" />}
                <span>{cat.label}</span>
                <span className="font-mono text-[10px] text-faint">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Tool Rows */}
        {filteredTools.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            По запросу «{search}» ничего не найдено
          </p>
        ) : (
          <div className="divide-y divide-line">
            {filteredTools.map((tool) => (
              <div
                key={tool.name}
                className="flex flex-col gap-1.5 py-3 first:pt-3 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 sm:w-[44%] sm:shrink-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyToolName(tool.name)}
                      title="Скопировать имя инструмента"
                      className="inline-flex items-center gap-1.5 font-mono text-[13px] font-medium text-foreground hover:text-electric"
                    >
                      {tool.name}
                      {copiedTool === tool.name && <Check className="size-3.5 text-ok" />}
                    </button>
                    <ModeBadge mode={tool.mode} />
                    {tool.adminOnly && (
                      <span className="rounded-[2px] bg-electric-soft px-1 py-px font-mono text-[10px] font-medium text-electric-text uppercase">
                        admin
                      </span>
                    )}
                  </div>
                  {tool.args && (
                    <p className="mt-0.5 truncate font-mono text-[11px] text-faint" title={tool.args}>
                      ({tool.args})
                    </p>
                  )}
                </div>
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
                  {tool.summary}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. MCP Resources & Server Prompts */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-[4px] border border-line bg-surface p-5">
          <h2 className="text-[15px] font-semibold">Ресурсы MCP</h2>
          <div className="mt-3 divide-y divide-line">
            {MCP_RESOURCES.map((res) => (
              <div key={res.uri} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-xs font-medium text-electric-text">{res.uri}</code>
                  <span className="text-xs text-foreground-2">{res.title}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{res.summary}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[4px] border border-line bg-surface p-5">
          <h2 className="text-[15px] font-semibold">Серверные промпт-шаблоны</h2>
          <div className="mt-3 divide-y divide-line">
            {visiblePromptTemplates.map((tpl) => (
              <div key={tpl.name} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-xs font-medium text-foreground">{tpl.name}</code>
                  {tpl.args && <span className="font-mono text-[11px] text-faint">({tpl.args})</span>}
                  {tpl.adminOnly && (
                    <span className="rounded-[2px] bg-electric-soft px-1 py-px font-mono text-[10px] font-medium text-electric-text uppercase">
                      admin
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tpl.summary}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
