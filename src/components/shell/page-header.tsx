import { cn } from "@/lib/utils"

/** Screen title in the prototype's style, with an optional "в разработке" badge and actions. */
export function PageHeader({
  title,
  subtitle,
  dev,
  actions,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  dev?: boolean
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-start gap-4", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
          {dev && <DevBadge />}
        </div>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function DevBadge() {
  return <span className="rounded-[2px] border border-dev/40 bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">В разработке</span>
}

export function DevStub({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="px-4 pt-8 pb-20 sm:px-7">
      <PageHeader title={title} subtitle={subtitle} dev />
      <div className="rounded-[4px] border border-dashed border-line-strong p-10 text-center text-sm text-muted-foreground">
        {children ?? "Раздел появится в следующих версиях."}
      </div>
    </div>
  )
}
