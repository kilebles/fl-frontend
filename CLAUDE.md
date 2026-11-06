@AGENTS.md

# fl-frontend

Russian-language web UI over the fl-api web API (`../fl-api`, FastAPI on :8000). Cookie-based user auth (`/login`, `/register`, `/account`, `src/proxy.ts`).

## Stack

Next.js 16 (App Router, `cacheComponents` + `partialPrefetching` on), React 19, Tailwind 4, shadcn/ui **base-nova** (Base UI primitives — `render` prop, not `asChild`), TanStack Query, Motion, lucide, sonner. Fonts: Onest (Cyrillic) + JetBrains Mono.

## Layout

Design = `../fl-api/motion-pr-prototype v2.html` (Motion Pr): Golos Text + JetBrains Mono, 3–4px radii, two themes —
dark (default) and light "Claude" (`<html data-theme="claude">`, toggle in the sidebar, script in `lib/theme-script.ts`).
Tokens in `globals.css` (`--electric` is the accent of either theme, `--dev` the "в разработке" marker).

```
src/app/            / (Генерации: вручную — feed + composer), batch/ (Генерации: пакетом — form + batches),
                    jobs/[id]/ (batch results), avatars/, prompts/ (projects ?p=, niche templates ?tab=templates), graphics/ (+ runs/[id], motion-aign cards),
                    script/ (Сценарий: projects ?p=, niches ?tab=niches), analytics/ (topic picks ?a=), voice/,
                    footage/ (Поиск видео: projects ?p=, sources ?tab=sources), videos/ (Ролики: reels ?p=),
                    music, edit, library, history — DevStub pages
src/components/     shell/ (nav sidebar, logo, theme, project-picker, page-header + DevStub), create/ (composer, feed,
                    generations-bar, form-parts, dropzone), batch/ (batch-form, batches-panel), avatars/, prompts/,
                    infographics/, jobs/ (job page, result card, lightbox, state, menu),
                    script/ (fl-scenario: launch panel, project list/view, niches, analytics, queries + SSE, send)
                    footage/ (fl-footage: launch panel, project list/view, sources, queries + SSE)
                    reels/ (fl-reel: «Новый ролик» wizard + draft, reel list/view, storyboard + brief, materials + result, YouTube tracks, queries + SSE)
src/lib/            api.ts (types + fetchers), queries.ts (React Query + SSE), project.ts (current project, withStyle),
                    draft.ts (composer text shared with the feed), modes.ts, format.ts,
                    handoff.ts (finished script → «Промпты» / «Озвучка»)
```

- «Сценарий» и «Аналитика» talk to fl-scenario at `/api/scenario/*` (Caddy → Windows :8020); its SSE `/api/scenario/events`
  invalidates the `["scenario", …]` queries. Selection is the logo blue in both themes (`--pick*` tokens), languages green.
- «Поиск видео» talks to fl-footage at `/api/footage/*` (Caddy → Windows :8030); SSE `/api/footage/events` invalidates
  `["footage", …]`. The script comes from a «Озвучка» project (fl-footage reads it from the voice API) or a file;
  results are downloaded as zips — shots are not previewed on the page.
- «Промпты» talk to fl-prompts at `/api/prompts/*` (Caddy → Windows :8040): niche master prompts (обычный / аватар),
  projects brief → prompts → check → done, result rows; SSE `/api/prompts/events` invalidates `["prompts", …]`.
  «Генерации пакетом» take finished prompts from there too (`/batch?prompts=<id>&mode=i2i2v`).
- «Ролики» talk to fl-reel (the brain of the full cycle) at `/api/reels/*` (Caddy → Windows :8050); SSE `/api/reels/events`
  invalidates `["reels", …]`. «Новый ролик» (`?new=1`) is a six-step wizard: niche (fl-scenario niches; picking one
  loads the niche preset from fl-reel) → script (by topic — the brain orders it from «Сценарий», then «Озвучка»; or ready
  from «Озвучка» / a file) → voice profile + translation languages with a voice each → host (fl-api avatar + Veo voice) → storyboard (shares, picture style, details) → montage
  style + music; the draft lives in localStorage. A reel's storyboard gives every shot a category (ИИ / видео /
  исторические / графика / ведущий — the host takes whole paragraphs; colours in `reels/parts.tsx`); new shares
  re-allocate a finished storyboard on the server at once. «Дорожки для YouTube» on the reel screen: fl-reel builds one
  mp3 per language mixed in «Озвучка», each exactly as long as the reel (`/api/reels/{id}/tracks`). After the
  storyboard the brain orders materials from the modules (`reels/result.tsx` → «Материалы» by category) and assembles
  the reel: «Готовый ролик» — player, mp4 and the DaVinci montage project (`/api/reels/{id}/result/mp4|montage`).
  Step 3: the translation model on top — one list of family × level (`flatModels` in `lib/voice-models.ts`, same list in
  «Озвучка»), voice profiles created and edited in place (`reels/voice-profile-dialog.tsx`). Step 5: the storyboard model —
  one list «engine:model» from fl-reel (`options.models`); «Паузы» under the shares — several variants at once (chapter ends /
  ~every N s at a fitting place / auto), each with an optional «Затухание», hints on hover; pause length; «Первые N минуты отдельно» (intro: own shares, shorter shots and a category score floor) and «Видео и исторические кадры» (threshold, sources, engine and model of picking per category —
  `reels/wizard-advanced.tsx`). Work time: `reel.timing` (reel and each stage, queue/idle not counted), ticked live by
  `useSpent` from the query's `dataUpdatedAt`. Step 6 «Шрифт титров» (`reels/fonts.tsx`): Constantia (default), Constantine, oSerif, SatyrSP or
  the style's font; previews of «Your vision. Our production.» load the file from `/api/reels/fonts/{value}` (else a local font).

- «Ролики» list header: brain queue (`QueueControl`) — running / waiting, «одновременно» 1/2/3/5 (`PUT /api/reels/queue/limits`);
  waiting reels show their place (`queue.queued`).
- Projects (ролики): the current project lives in localStorage; screens filter by it and new jobs/runs carry `project_id`.
  The project's style line is appended to every prompt (composer, batch, «В производство», avatar scene).
- Credits/balance are a UI stub (`— кр.`) — no billing yet.
- Data is client-side: React Query against `NEXT_PUBLIC_API_URL`; `/api/events` SSE updates the cache live.
- Cache Components rules: no `Date.now()` during render (use effects), `usePathname`/params under `<Suspense>`.
- Design tokens in `globals.css` (`--electric` #3d6bff accent, layered dark surfaces, faint grid backdrop `.panel-backdrop`, `.glow-electric`, `.shimmer`, `.bar-running`). References: whitenetwork.cloud (tokens) + rythm.fm (shell).
- Check visually with Playwright (MCP) after UI changes; `npx next build` catches prerender errors.

- Client-facing: no accounts/strategy in the UI (internal), minimal copy — no slogans or explanatory subtitles. No logo/brand yet.
- Single vs batch is not stored in the API: `isSingle(job)` = 1 row and not f2v (feed on Создать); everything else is a batch.
