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
                    edit/ (Монтаж: «Монтаж» by description — montages ?e=, the default; «Инфографика» ?tab=infographics, jobs ?j=),
                    admin/ (Админ, только admin: «Лимиты» — default, «Пользователи» ?tab=users; /account?tab=admin ведёт сюда),
                    music, library, history — DevStub pages
src/components/     shell/ (nav sidebar, logo, theme, project-picker, page-header + DevStub), create/ (composer, feed,
                    generations-bar, form-parts, dropzone), batch/ (batch-form, batches-panel), avatars/, prompts/,
                    infographics/, jobs/ (job page, result card, lightbox, state, menu),
                    script/ (fl-scenario: launch panel, project list/view, niches, analytics, queries + SSE, send)
                    footage/ (fl-footage: launch panel, project list/view, sources, queries + SSE)
                    reels/ (fl-reel: «Новый ролик» wizard + draft, reel list/view, storyboard + brief, materials + review + result, YouTube tracks, queries + SSE)
                    admin/ (admin-view, limits-tab — квоты fl-limits, users-tab — пользователи fl-api)
                    montage/ (fl-montage: «Монтаж» edit-launch/-list/-view/-parts; «Инфографика» launch panel, job list/view with previews and «Перерисовать», queries + SSE)
src/lib/            api.ts (types + fetchers), queries.ts (React Query + SSE), project.ts (current project, withStyle),
                    draft.ts (composer text shared with the feed), modes.ts, format.ts,
                    handoff.ts (finished script → «Промпты» / «Озвучка»)
```

- «Сценарий» и «Аналитика» talk to fl-scenario at `/api/scenario/*` (Caddy → Windows :8020); its SSE `/api/scenario/events`
  invalidates the `["scenario", …]` queries. Selection is the logo blue in both themes (`--pick*` tokens), languages green.
- «Поиск видео» talks to fl-footage at `/api/footage/*` (Caddy → Windows :8030); SSE `/api/footage/events` invalidates
  `["footage", …]`. The script comes from a «Озвучка» project (fl-footage reads it from the voice API) or a file;
  results are downloaded as zips — shots are not previewed on the page. «Оживление картинок» in the launch panel
  (`options.image_motion`: zoom «Наезд» | parallax «Параллакс (2.5D)» | mixed «50/50») is drawn from `/options`
  `image_motions` (not hard-coded); parallax / 50/50 without the depth model (`parallax.ready` false) shows a muted note;
  older servers send no list — no control. Local fallback list: `footage/parts.tsx` `IMAGE_MOTIONS`.
  A reel's search while it runs: `reels/search-progress.tsx` reads fl-reel `materials.search` per category (video /
  history — module step, counter, found so far) and `materials.relaxed` (shots taken with the threshold lowered by 1) — local types, older brains send neither.
- «Промпты» talk to fl-prompts at `/api/prompts/*` (Caddy → Windows :8040): niche master prompts (обычный / аватар),
  projects brief → prompts → check → done, result rows; SSE `/api/prompts/events` invalidates `["prompts", …]`.
  «Генерации пакетом» take finished prompts from there too (`/batch?prompts=<id>&mode=i2i2v`).
- «Монтаж» talks to fl-montage at `/api/montage/*` (Caddy → Windows :8060); SSE `/api/montage/events` invalidates
  `["montage", …]`. «Инфографика»: text or a .docx/.txt/.md file → type (auto / timeline / tree / table / chart / map /
  facts / battle; «Инфографика 2»: journey / units / document — the picker is grouped by `/options` `groups` when sent), animated (mp4) or static (png), 16:9 / 9:16, 720p / 1080p / 4K, duration, visual style (parchment /
  cinematic / clean / chronicle) and «Цвета» — a palette over it (`/options` `palettes`: default / royal / crimson /
  emerald, `swatches[style]` = side A, side B, accent, mark → `PaletteSwatch`; `PalettePick` in `montage/launch.tsx`, sent
  as `palette`; older modules send none — no control), optional transparent layer; the job page previews every file
  (animated ones with the `poster` jpg), its header names style · palette, and «Перерисовать» re-renders with another
  style / palette / format / quality without the model (`changes.palette`). «Ролики» order infographics there too
  (category `infographics`, shot `info: {type, brief}` — any of the reel's allowed types; colour in `reels/parts.tsx`).
  «Монтаж» (by description, up to 60 s; `/api/montage/edits`): videos and images (up to 30, live previews), an optional
  voiceover (sets the length) and music (none / own file / Epidemic picked by the module), format, quality, duration,
  one of six montage styles (the same names as «Ролики»), model, and the description with «Кисть» (`edits.brush` — the
  model rewrites it into a detailed brief, «Вернуть» restores the text). Upload goes through XHR with progress
  (`upload()` in `lib/api.ts`). The montage page: player with the poster, mp4 and the DaVinci project, the plan
  (pieces with thumbnails, transitions, why), music and titles, uploaded files, «Пересобрать» (same plan without the model).
- «Ролики» talk to fl-reel (the brain of the full cycle) at `/api/reels/*` (Caddy → Windows :8050); SSE `/api/reels/events`
  invalidates `["reels", …]`. «Новый ролик» (`?new=1`) is a six-step wizard: niche (fl-scenario niches; picking one
  loads the niche preset from fl-reel) → script (by topic — the brain orders it from «Сценарий», then «Озвучка»; or ready
  from «Озвучка» / a file) → voice profile + translation languages with a voice each → host (fl-api avatar + Veo voice) → storyboard (shares, picture style, details) → montage
  style + music; the draft lives in localStorage. A reel's storyboard gives every shot a category (ИИ / видео /
  исторические / графика / инфографика / ведущий — the host takes whole paragraphs; order, labels and colours in
  `reels/parts.tsx`, `useCategories` takes the brain's list from `/options` `categories`, the local list is the
  fallback); new shares
  re-allocate a finished storyboard on the server at once. «Дорожки для YouTube» on the reel screen: fl-reel builds one
  mp3 per language mixed in «Озвучка», each exactly as long as the reel (`/api/reels/{id}/tracks`); translations mixed after
  assembly: `status.waiting` (the brain refreshes tracks itself), languages mixed later than the tracks — a hint to rebuild. After the
  storyboard the brain orders materials from the modules (`reels/result.tsx` → «Материалы» by category) and assembles
  the reel: «Готовый ролик» — player, mp4 and the DaVinci montage project (`/api/reels/{id}/result/mp4|montage`).
  Step 3: the translation model on top — one list of family × level (`flatModels` in `lib/voice-models.ts`, same list in
  «Озвучка»), voice profiles as cards (`reels/voice-profile-cards.tsx`): pick, the base voice's sample, «Изменить» / «Удалить» on
  the card (delete warns about reels not voiced yet with it — «Озвучка» would take its default profile), the dashed «Новый профиль» tile
  (a copy of the chosen one; `reels/voice-profile-dialog.tsx`); samples of the translation voices in their rows. One player for
  every sample (`reels/voice-sample.tsx`: `useVoiceSample`, `SampleButton`) — «Озвучка» serves the sample from the voice's Fish page, else a synthesized phrase. Step 5: the storyboard model —
  one list «engine:model» from fl-reel (`options.models`); «Паузы» under the shares — several variants at once (chapter ends /
  ~every N s at a fitting place / auto), each with an optional «Затухание», hints on hover; pause length; «Типы инфографики»
  (`reels/info-look.tsx` `InfoTypesPick`: chips grouped by `/options` `info.types`, «Инфографика 2» — journey / units /
  document; all on by default — the draft keeps the switched-off ones, `storyboard.infoOff`, and sends the allowed
  `storyboard.info_types`; muted at infographics share 0; share > 0 and none on — «Далее» is blocked with a line); «Первые N
  минуты отдельно» (intro: own shares, shorter shots and a category score floor) and «Видео и исторические кадры» (threshold,
  sources, engine and model of picking and «Оживление картинок» per category — `footage.<cat>.image_motion` from `/options`
  `image_motions` (zoom / parallax / mixed 50/50), default `image_motion_default` (history → parallax, video → zoom) —
  `reels/wizard-advanced.tsx`). Work time: `reel.timing` (reel and each stage, queue/idle not counted), ticked live by
  `useSpent` from the query's `dataUpdatedAt`. Step 6 «Шрифт титров» (`reels/fonts.tsx`): Constantia (default), Constantine, oSerif, SatyrSP or
  the style's font; previews of «Your vision. Our production.» load the file from `/api/reels/fonts/{value}` (else a local font).
  «Качество» there: 1080p as before / 1080p + sharpening / 4K + sharpening (`montage.quality`: "" | sharp | 4k).
  «Звуки» there too (`montage.sounds = {on, density: low|normal|high, veo: mute|keep}`, `SoundsPick`). «Инфографика» there
  (`InfoLookPick`): «Стиль» (Авто + 4) and «Цвета» (Авто + 4) from `/options` `info.styles` / `info.palettes` →
  `montage.info = {style, palette}`; previews `public/infographics/looks/<style>-<palette>.jpg` (480×270), a missing file —
  fl-montage `palettes[].swatches[style]`, then the names; with style «Авто» the colour previews use
  `info.by_montage[montage style]`. The summary step and the reel's settings line show the look and «N из 10 типов» when
  not all are allowed (`infoLine`); older brains without `info` — no controls, nothing sent. Music and sounds come
  from Epidemic Sound through fl-reel (stages `music` and `sounds` after materials). The reel screen shows «Музыка и звуки»
  (`reels/audio.tsx`): tracks by chapter, ambience by paragraphs, spot sounds by shot and the chapter transition, each with
  the Epidemic preview in one shared player.

- «Названия и описания» on the reel screen (`reels/youtube.tsx`, under the tracks): fl-reel makes a YouTube title and a short
  description in every voiced language (for uploading to the channels); the title is the reel's topic (step «Сценарий»,
  `settings.script.topic`) or one typed on the card (`settings.youtube.title`, wins over the topic), adapted per language;
  neither — written from the script. The reel carries only
  `youtube` state (`ReelYoutubeView`), the texts — `GET …/youtube`; «Сделать заново» posts a new title, «Скачать JSON»
  saves it; older brains send no `youtube` — no card.
- «Выкладка на YouTube» on the reel screen (`reels/youtube-upload.tsx`, under «Названия и описания»): talks to `auto-youtube`
  at `/api/youtube/*` (Octo Browser CDP upload + 16 secondary audio tracks & metadata, SSE `/api/youtube/events`), lets the
  user bind Octo profiles as channels, pick channel/date/time/monetization, and track per-language upload progress.

- «Админ → Лимиты» talks to fl-limits at `/api/limits/*` (Caddy → Windows :8070, admins only — fl-limits checks the
  role in `X-Fl-Gateway-Auth`): quotas of agy (per Windows login) and Claude Code — buckets week / 5 h with left %,
  reset, forecast («кончится раньше сброса»), who used each bucket by module and by reel (an estimate by the time of
  their model processes; «Не видно на сервере» — used from another computer), live calls, collectors, recent alerts
  (Telegram). Module colours — `MODULE_COLOR` in `admin/limits-tab.tsx`; the chart is plain SVG (no chart library).

- «Ролики», step 2: the format on top — «16:9 · длинный» / «9:16 · Shorts» (`d.format`). Shorts: length in seconds (15–180,
  default 60, `script.seconds`), no «Графика» row (`shortShares` moves its share to AI — fl-api cards are 16:9 only), no
  pauses / chapter titles / intro (hidden, not sent); step 6 shows the chosen format. Picking a niche or switching the
  format loads the niche preset of that format (`usePresetLoader`; a Short without its own — the 16:9 one); a ready voiceover
  over 3 min in 9:16 — a note that the brain fits it itself (rewrite through «Сценарий» or drop extra paragraphs).
  Step 6 in 9:16: the Shorts styles (`/options` montage `formats`, «Влог» in both; `stylesFor`), «Shorts» — «Крючок в
  начале», «Бесшовный повтор» and «Субтитры» (`montage.short = {hook, loop, subtitles}`, subtitles off by default), «Настроение музыки» (`music_short`, one track),
  «Шрифт надписей» (numbers and dates), no 4K; the reel screen's «Доли материала» has no «Графика» row in 9:16 either; `toShort` / `toLong` move a style or mood of the other format to the
  defaults (and more sounds when coming from 16:9). The reel list and the reel screen mark 9:16.
- «Ролики» list header: brain queue (`QueueControl`) — running / waiting, «одновременно» 1/2/3/5 (`PUT /api/reels/queue/limits`);
  waiting reels show their place (`queue.queued`).
- «Ролики», step 5 (`reels/wizard-text.tsx`): «Модель ИИ-кадров» (`ai.mode`: i2v | flash_i2v, `/options` `ai_modes`, the
  host keeps its own model), «Язык надписей» («Как у ролика» = the reel's base language, then the reel's languages, then
  «Сценарий» languages) with «Цифры и даты» → `text = {lang, numbers, chapters}`; under «Паузы» chapter pauses take their
  own length (`storyboard.pauses.modes[].sec`, «общая» — none) and «Надписи глав» (`text.chapters`, null — as the montage
  style's `titles`). The brain picks the numbers and dates and their look; the summary and the reel's settings line show `textLine`.
- Lists for the pages are light: `/api/scenario/projects?light=1` (no brief / materials), `/api/footage/projects?light=1`
  (stats without timing / usage / sources), `/api/montage/infographics?light=1` (items: key, type, status) — list rows
  must not read the dropped fields (the project / job query has them). Long lists are shown in parts (`LIST_STEP`,
  `ShowMore` in `script/parts.tsx`: «Поиск видео», «Промпты»). SSE refetches go through `throttler()` (`lib/throttle.ts`),
  «Промпты» included.
- Security headers for the pages — `next.config.ts` `headers()` (HSTS, X-Frame-Options SAMEORIGIN, nosniff,
  Referrer-Policy), `poweredByHeader: false`; the APIs answer through Caddy and are not covered.
- Projects (ролики): the current project lives in localStorage; screens filter by it and new jobs/runs carry `project_id`.
  The project's style line is appended to every prompt (composer, batch, «В производство», avatar scene).
- Credits/balance are a UI stub (`— кр.`) — no billing yet.
- Language codes on screen go through `langCode()` / `langList()` (`lib/langs.ts`): the team's labels — GER, ESP, POR, JP, ARB,
  KOR, DUT, TUR, SWE, NOR, DAN, CZE; the APIs keep the modules' codes (DE, ES, PT, JA, AR, KO, NL, TR, SV, NO, DA, CS).
- Data is client-side: React Query against `NEXT_PUBLIC_API_URL`; `/api/events` SSE updates the cache live.
- Cache Components rules: no `Date.now()` during render (use effects), `usePathname`/params under `<Suspense>`.
- Design tokens in `globals.css` (`--electric` #3d6bff accent, layered dark surfaces, faint grid backdrop `.panel-backdrop`, `.glow-electric`, `.shimmer`, `.bar-running`). References: whitenetwork.cloud (tokens) + rythm.fm (shell).
- Check visually with Playwright (MCP) after UI changes; `npx next build` catches prerender errors.

- Files removed by the modules' retention (fl-reel `files_removed`, `reels/files-removed.tsx` in place of «Готовый ролик» and
  the tracks; fl-footage `files_removed` on the project) — a note instead of the download buttons; local types.
  fl-reel `work_removed` (a day after done: working files gone, mp4 / project / tracks stay) — the tracks card hides
  «Собрать заново» and says why (`workRemoved`).
  `result.montage_removed` (the DaVinci project archive deleted to free the disk) — the reel card hides «Проект для DaVinci».
- Client-facing: no accounts/strategy in the UI (internal), minimal copy — no slogans or explanatory subtitles. No logo/brand yet.
- Batch archive menu (`jobs/job-menu.tsx`): download, and «Скопировать ссылку» — fl-api signs a link to that archive that
  opens without signing in for 7 days (`api.zipLink` → `/api/jobs/{id}/zip/shared`); the clipboard gets a promise (Safari).
- Single vs batch is not stored in the API: `isSingle(job)` = 1 row and not f2v (feed on Создать); everything else is a batch.
- «Материалы» on the reel screen (`reels/result.tsx`): per planned category — found in it (`own`), where the rest went
  (`moved`: second round / AI), and the shares by the storyboard vs in the reel (`materials.mix`); the list's mix bar uses
  `materials.mix` when the brain sends it.
- «Проверка кадров» on the reel screen (`reels/review.tsx`, under «Материалы»): fl-reel stage `review` («проверка»,
  between materials and music — the steps line comes from the brain's `steps`) and `reel.review` — summary (checked /
  flagged / replaced / left) and the flagged shots: timecode, id, category dot, problems (red ones marked), action
  (заменён / оставлен / осталась проблема); `failed` / `off` — one muted line with the note; older reels — nothing.
