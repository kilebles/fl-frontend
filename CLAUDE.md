@AGENTS.md

# fl-frontend

Russian-language web UI over the fl-api web API (`../fl-api`, FastAPI on :8000). No auth/users yet.

## Stack

Next.js 16 (App Router, `cacheComponents` + `partialPrefetching` on), React 19, Tailwind 4, shadcn/ui **base-nova** (Base UI primitives — `render` prop, not `asChild`), TanStack Query, Motion, lucide, sonner. Fonts: Onest (Cyrillic) + JetBrains Mono.

## Layout

Design = `../fl-api/motion-pr-prototype v2.html` (Motion Pr): Golos Text + JetBrains Mono, 3–4px radii, two themes —
dark (default) and light "Claude" (`<html data-theme="claude">`, toggle in the sidebar, script in `lib/theme-script.ts`).
Tokens in `globals.css` (`--electric` is the accent of either theme, `--dev` the "в разработке" marker).

```
src/app/            / (Генерации: вручную — feed + composer), batch/ (Генерации: пакетом — form + batches),
                    jobs/[id]/ (batch results), avatars/, prompts/ (+ runs/[id]), graphics/ (+ runs/[id], motion-aign cards),
                    videos, script, voice, footage, music, edit, library, history — DevStub pages
src/components/     shell/ (nav sidebar, theme, project-picker, page-header + DevStub), create/ (composer, feed,
                    generations-bar, form-parts, dropzone), batch/ (batch-form, batches-panel), avatars/, prompts/,
                    infographics/, jobs/ (job page, result card, lightbox, state, menu)
src/lib/            api.ts (types + fetchers), queries.ts (React Query + SSE), project.ts (current project, withStyle),
                    draft.ts (composer text shared with the feed), modes.ts, format.ts
```

- Projects (ролики): the current project lives in localStorage; screens filter by it and new jobs/runs carry `project_id`.
  The project's style line is appended to every prompt (composer, batch, «В производство», avatar scene).
- Credits/balance are a UI stub (`— кр.`) — no billing yet.
- Data is client-side: React Query against `NEXT_PUBLIC_API_URL`; `/api/events` SSE updates the cache live.
- Cache Components rules: no `Date.now()` during render (use effects), `usePathname`/params under `<Suspense>`.
- Design tokens in `globals.css` (`--electric` #3d6bff accent, layered dark surfaces, faint grid backdrop `.panel-backdrop`, `.glow-electric`, `.shimmer`, `.bar-running`). References: whitenetwork.cloud (tokens) + rythm.fm (shell).
- Check visually with Playwright (MCP) after UI changes; `npx next build` catches prerender errors.

- Client-facing: no accounts/strategy in the UI (internal), minimal copy — no slogans or explanatory subtitles. No logo/brand yet.
- Single vs batch is not stored in the API: `isSingle(job)` = 1 row and not f2v (feed on Создать); everything else is a batch.
