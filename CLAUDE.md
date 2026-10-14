@AGENTS.md

# fl-frontend

Russian-language web UI over the fl-api web API (`../fl-api`, FastAPI on :8000). No auth/users yet.

## Stack

Next.js 16 (App Router, `cacheComponents` + `partialPrefetching` on), React 19, Tailwind 4, shadcn/ui **base-nova** (Base UI primitives — `render` prop, not `asChild`), TanStack Query, Motion, lucide, sonner. Fonts: Onest (Cyrillic) + JetBrains Mono.

## Layout

```
src/app/            layout.tsx (shell), page.tsx (Создать: composer + feed of single generations), batch/ (list), batch/new/ (form),
                    jobs/[id]/ (job page, Suspense over params), prompts/ (placeholder — prompt generation comes later)
src/components/     shell/ (topbar with job search, sidebar: nav + batch list), create/ (composer, mode-picker, feed, form-parts, dropzone),
                    batch/ (batch-list, batch-form), jobs/ (job page, result card, lightbox, state badge, menu)
src/lib/            api.ts (types + fetchers, mirrors fl-api schemas), queries.ts (React Query + SSE → cache),
                    modes.ts (Russian mode metadata), format.ts
```

- Data is client-side: React Query against `NEXT_PUBLIC_API_URL`; `/api/events` SSE updates the cache live.
- Cache Components rules: no `Date.now()` during render (use effects), `usePathname`/params under `<Suspense>`.
- Design tokens in `globals.css` (`--electric` #3d6bff accent, layered dark surfaces, faint grid backdrop `.panel-backdrop`, `.glow-electric`, `.shimmer`, `.bar-running`). References: whitenetwork.cloud (tokens) + rythm.fm (shell).
- Check visually with Playwright (MCP) after UI changes; `npx next build` catches prerender errors.

- Client-facing: no accounts/strategy in the UI (internal), minimal copy — no slogans or explanatory subtitles. No logo/brand yet.
- Single vs batch is not stored in the API: `isSingle(job)` = 1 row and not f2v (feed on Создать); everything else is a batch.
