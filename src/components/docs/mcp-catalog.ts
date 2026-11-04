export type ClientId = "antigravity" | "claude-code" | "claude-desktop" | "cursor" | "http"
export type AuthTransport = "header" | "query"

export type ToolCategory =
  | "all"
  | "jobs"
  | "projects"
  | "scenario"
  | "prompts"
  | "graphics"
  | "voice"
  | "footage"
  | "admin"

export type ToolMode = "read" | "write" | "destructive"

export interface McpToolItem {
  name: string
  category: Exclude<ToolCategory, "all">
  mode: ToolMode
  args?: string
  summary: string
  adminOnly?: boolean
}

export interface PipelineStageInfo {
  step: string
  title: string
  href: string
  entryTool: string
  flow: string
}

export interface ReadyPromptCard {
  id: string
  title: string
  tag: string
  prompt: string
  adminOnly?: boolean
}

export interface McpResourceItem {
  uri: string
  title: string
  summary: string
}

export interface McpPromptTemplateItem {
  name: string
  args?: string
  summary: string
  adminOnly?: boolean
}

export const CLIENT_TABS: { id: ClientId; label: string; configPath: string }[] = [
  { id: "antigravity", label: "Antigravity", configPath: "mcp_config.json" },
  { id: "claude-code", label: "Claude Code", configPath: "Терминал (CLI)" },
  { id: "claude-desktop", label: "Claude Desktop", configPath: "claude_desktop_config.json" },
  { id: "cursor", label: "Cursor", configPath: ".cursor/mcp.json" },
  { id: "http", label: "HTTP / cURL", configPath: "Streamable HTTP · JSON-RPC 2.0" },
]

export const PRESET_TOKEN_NAMES = ["Antigravity", "Claude Code", "Claude Desktop", "Cursor"] as const

export function buildClientSnippet(
  client: ClientId,
  endpointUrl: string,
  token: string,
  transport: AuthTransport
): string {
  const urlWithQuery = `${endpointUrl}?token=${token}`

  if (client === "antigravity") {
    if (transport === "query") {
      return JSON.stringify(
        {
          mcpServers: {
            "motion-pr": {
              serverUrl: urlWithQuery,
            },
          },
        },
        null,
        2
      )
    }
    return JSON.stringify(
      {
        mcpServers: {
          "motion-pr": {
            serverUrl: endpointUrl,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        },
      },
      null,
      2
    )
  }

  if (client === "claude-code") {
    if (transport === "query") {
      return `claude mcp add --transport http motion-pr "${urlWithQuery}"`
    }
    return `claude mcp add --transport http motion-pr "${endpointUrl}" \\\n  --header "Authorization: Bearer ${token}"`
  }

  if (client === "claude-desktop") {
    if (transport === "query") {
      return JSON.stringify(
        {
          mcpServers: {
            "motion-pr": {
              command: "npx",
              args: ["-y", "mcp-remote", urlWithQuery],
            },
          },
        },
        null,
        2
      )
    }
    return JSON.stringify(
      {
        mcpServers: {
          "motion-pr": {
            command: "npx",
            args: [
              "-y",
              "mcp-remote",
              endpointUrl,
              "--header",
              `Authorization: Bearer ${token}`,
            ],
          },
        },
      },
      null,
      2
    )
  }

  if (client === "cursor") {
    if (transport === "query") {
      return JSON.stringify(
        {
          mcpServers: {
            "motion-pr": {
              url: urlWithQuery,
            },
          },
        },
        null,
        2
      )
    }
    return JSON.stringify(
      {
        mcpServers: {
          "motion-pr": {
            url: endpointUrl,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        },
      },
      null,
      2
    )
  }

  const target = transport === "query" ? urlWithQuery : endpointUrl
  const authLine = transport === "header" ? `  -H "Authorization: Bearer ${token}" \\\n` : ""
  return (
    `curl -X POST "${target}" \\\n` +
    authLine +
    `  -H "Content-Type: application/json" \\\n` +
    `  -H "Accept: application/json, text/event-stream" \\\n` +
    `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
  )
}

export const PIPELINE_STAGES: PipelineStageInfo[] = [
  {
    step: "01",
    title: "Сценарий",
    href: "/script",
    entryTool: "create_scenario_project",
    flow: "Аналитика → бриф → план → главы .docx",
  },
  {
    step: "02",
    title: "Промпты",
    href: "/prompts",
    entryTool: "start_prompt_generation",
    flow: "Шаблон стиля → пары (img, vid) по абзацам",
  },
  {
    step: "03",
    title: "Генерации",
    href: "/",
    entryTool: "handoff_prompts_to_job",
    flow: "Очередь t2v / i2v / i2i2v / f2v → результаты",
  },
  {
    step: "04",
    title: "Графика",
    href: "/graphics",
    entryTool: "start_infographics_run",
    flow: "Wikidata / Wikimedia → Remotion-карточки",
  },
  {
    step: "05",
    title: "Озвучка",
    href: "/voice",
    entryTool: "start_voice_job",
    flow: "Перевод → синтез речи → сведение дорожки",
  },
  {
    step: "06",
    title: "Поиск видео",
    href: "/footage",
    entryTool: "start_footage_project",
    flow: "Подбор шотов под тайминг озвучки",
  },
]

export const READY_PROMPTS: ReadyPromptCard[] = [
  {
    id: "queue-status",
    title: "Статус очереди и активных задач",
    tag: "Очередь",
    prompt:
      "Проверь текущее состояние очередей в Motion Pr: какие генерации, промпты и рендеры графики сейчас выполняются или ждут в очереди, сколько сцен уже готово и есть ли остановленные задачи.",
  },
  {
    id: "e2e-pipeline",
    title: "Запуск ролика от промптов до генерации",
    tag: "Конвейер",
    prompt:
      "Создай проект «Падение Рима» со стилем «35mm anamorphic film grain, dramatic chiaroscuro lighting», сгенерируй промпты по тексту сценария (по 2 пары на абзац) и после готовности передай их в генерацию i2v.",
  },
  {
    id: "parallel-stages",
    title: "Параллельно: графика + озвучка по сценарию",
    tag: "Этапы",
    prompt:
      "Возьми готовый сценарий из последнего проекта в разделе Сценарий и запусти параллельно рендер инфографики (персоны и места) и озвучку на английском языке.",
  },
  {
    id: "job-check",
    title: "Разбор пропущенных сцен и перезапуск",
    tag: "Диагностика",
    prompt:
      "Покажи последние 5 задач генерации, проверь есть ли у них пропущенные строки (skip) или ошибки фильтрации промптов, и предложи перезапуск недостающих сцен.",
  },
  {
    id: "admin-audit",
    title: "Аудит воркеров, квот и прокси",
    tag: "Admin",
    adminOnly: true,
    prompt:
      "Выполни полный операционный аудит: вызови get_system_overview и get_accounts_status, проверь кулдауны квот, мёртвые прокси и хвост серверных логов, затем предложи действия по восстановлению.",
  },
]

export const CATEGORY_LABELS: { id: ToolCategory; label: string; adminOnly?: boolean }[] = [
  { id: "all", label: "Все" },
  { id: "jobs", label: "Генерации" },
  { id: "projects", label: "Проекты и аватары" },
  { id: "scenario", label: "Сценарий" },
  { id: "prompts", label: "Промпты" },
  { id: "graphics", label: "Графика" },
  { id: "voice", label: "Озвучка" },
  { id: "footage", label: "Поиск видео" },
  { id: "admin", label: "Мониторинг · Admin", adminOnly: true },
]

export const MCP_TOOLS: McpToolItem[] = [
  // Генерации (8)
  {
    name: "list_generation_modes",
    category: "jobs",
    mode: "read",
    summary: "Список режимов генерации (t2v, flash_t2v, img, i2v, flash_i2v, i2i2v, f2v) и их входных параметров.",
  },
  {
    name: "list_jobs",
    category: "jobs",
    mode: "read",
    args: "state?, project_id?, limit?",
    summary: "Список задач генерации с фильтрацией по статусу и проекту.",
  },
  {
    name: "get_job_details",
    category: "jobs",
    mode: "read",
    args: "job_id, include_rows?, include_files?",
    summary: "Детальный прогресс задачи, позиция в очереди, строки промптов и ссылки на готовые файлы.",
  },
  {
    name: "upload_input_image",
    category: "jobs",
    mode: "write",
    args: "file_path? | image_url? | base64_data?",
    summary: "Загрузка референс-изображения в хранилище (возвращает ключ inputs/…).",
  },
  {
    name: "submit_generation_job",
    category: "jobs",
    mode: "write",
    args: "mode, rows? | prompts? | xlsx_path?, title?, project_id?, avatar_id?",
    summary: "Постановка новой одиночной или пакетной генерации в очередь (с автоподстановкой стиля проекта и аватара).",
  },
  {
    name: "control_job",
    category: "jobs",
    mode: "write",
    args: "job_id, action: 'cancel' | 'retry'",
    summary: "Остановка активной задачи или докачка только недостающих сцен после паузы.",
  },
  {
    name: "delete_job",
    category: "jobs",
    mode: "destructive",
    args: "job_id",
    summary: "Удаление завершённой задачи вместе с её файлами в хранилище.",
  },
  {
    name: "sync_jobs_from_storage",
    category: "jobs",
    mode: "write",
    summary: "Синхронизация завершённых задач из объектного хранилища S3 / R2 в базу.",
  },

  // Проекты и аватары (8)
  {
    name: "list_projects",
    category: "projects",
    mode: "read",
    summary: "Список проектов («Роликов») пользователя с их стилевыми суффиксами.",
  },
  {
    name: "get_project",
    category: "projects",
    mode: "read",
    args: "project_id",
    summary: "Получение карточки проекта по ID.",
  },
  {
    name: "save_project",
    category: "projects",
    mode: "write",
    args: "title?, style?, project_id?",
    summary: "Создание нового проекта или обновление названия и визуального стиля существующего.",
  },
  {
    name: "delete_project",
    category: "projects",
    mode: "destructive",
    args: "project_id",
    summary: "Удаление проекта (связанные генерации сохраняются без привязки).",
  },
  {
    name: "list_avatars",
    category: "projects",
    mode: "read",
    summary: "Список сохранённых персонажей (референс-кадры и текстовое описание внешности).",
  },
  {
    name: "get_avatar",
    category: "projects",
    mode: "read",
    args: "avatar_id",
    summary: "Получение карточки аватара по ID.",
  },
  {
    name: "save_avatar",
    category: "projects",
    mode: "write",
    args: "name?, description?, image_paths?, image_keys?, avatar_id?",
    summary: "Создание или обновление персонажа для консистентной генерации i2i2v.",
  },
  {
    name: "delete_avatar",
    category: "projects",
    mode: "destructive",
    args: "avatar_id",
    summary: "Удаление аватара из библиотеки.",
  },

  // Сценарий и Аналитика (8)
  {
    name: "list_scenario_analytics",
    category: "scenario",
    mode: "read",
    args: "niche?",
    summary: "Список запусков аналитики конкурентов и предложенных тем.",
  },
  {
    name: "start_scenario_analytics",
    category: "scenario",
    mode: "write",
    args: "niche?, urls?, notes?",
    summary: "Запуск исследования YouTube-каналов и генерации тем в нише.",
  },
  {
    name: "promote_analytics_topic_to_scenario",
    category: "scenario",
    mode: "write",
    args: "analytics_file, topic_index",
    summary: "Создание сценарного проекта напрямую из выбранной темы аналитики.",
  },
  {
    name: "list_scenario_projects",
    category: "scenario",
    mode: "read",
    summary: "Список всех проектов сценариев со статусами глав и слов.",
  },
  {
    name: "get_scenario_project",
    category: "scenario",
    mode: "read",
    args: "project_id, include_script?, include_log?",
    summary: "Состояние сценарного проекта, полный текст готового сценария и лог генерации.",
  },
  {
    name: "create_scenario_project",
    category: "scenario",
    mode: "write",
    args: "title, brief?, niche?, target_words?, language?, model?",
    summary: "Создание нового сценарного проекта с целевым объёмом и моделью.",
  },
  {
    name: "control_scenario_project",
    category: "scenario",
    mode: "write",
    args: "project_id, action: 'brief' | 'launch' | 'stop' | 'resume'",
    summary: "Генерация брифа, запуск написания глав, пауза или продолжение сценария.",
  },
  {
    name: "delete_scenario_project",
    category: "scenario",
    mode: "destructive",
    args: "project_id",
    summary: "Удаление сценарного проекта.",
  },

  // Промпты (7)
  {
    name: "get_prompts_options",
    category: "prompts",
    mode: "read",
    summary: "Доступные модели генерации промптов, ниши и встроенные шаблоны.",
  },
  {
    name: "list_prompt_templates",
    category: "prompts",
    mode: "read",
    summary: "Список шаблонов визуального стиля для генератора промптов.",
  },
  {
    name: "extract_prompt_template",
    category: "prompts",
    mode: "write",
    args: "name, brief_text? | brief_path?",
    summary: "Извлечение структурированного шаблона стиля из текстового или .docx брифа.",
  },
  {
    name: "list_prompt_runs",
    category: "prompts",
    mode: "read",
    args: "backend?",
    summary: "Список запусков генерации промптов со счётчиками готовых пар.",
  },
  {
    name: "get_prompt_run_details",
    category: "prompts",
    mode: "read",
    args: "run_id, backend?, include_pairs?",
    summary: "Статус прогона и все сгенерированные пары (image_prompt, video_prompt) по абзацам.",
  },
  {
    name: "start_prompt_generation",
    category: "prompts",
    mode: "write",
    args: "scenario_text? | scenario_path? | scenario_project_id?, template_id?, pair_count?",
    summary: "Запуск генерации пар промптов из текста, .docx или проекта из раздела «Сценарий».",
  },
  {
    name: "handoff_prompts_to_job",
    category: "prompts",
    mode: "write",
    args: "prompt_run_id, mode?, project_id?, avatar_id?, max_rows?",
    summary: "Бесшовная передача готовых промптов напрямую в очередь видеогенерации.",
  },

  // Графика / Инфографика (4)
  {
    name: "list_infographics_runs",
    category: "graphics",
    mode: "read",
    args: "project_id?",
    summary: "Список рендеров инфографики с фазами поиска и рендера.",
  },
  {
    name: "get_infographics_run_details",
    category: "graphics",
    mode: "read",
    args: "run_id, include_files?, include_log?",
    summary: "Прогресс инфографики, готовые .mp4 карточки и хвост лога рендера.",
  },
  {
    name: "start_infographics_run",
    category: "graphics",
    mode: "write",
    args: "scenario_text? | scenario_path? | scenario_project_id?, people?, places?, artifacts?",
    summary: "Поиск сущностей в Wikidata / Wikimedia по сценарию и рендер анимированных карточек Remotion.",
  },
  {
    name: "control_infographics_run",
    category: "graphics",
    mode: "write",
    args: "run_id, action: 'cancel' | 'retry' | 'delete'",
    summary: "Отмена, продолжение с сохранённого плана или удаление рендера инфографики.",
  },

  // Озвучка (2)
  {
    name: "list_voice_jobs",
    category: "voice",
    mode: "read",
    args: "limit?",
    summary: "Проверка воркера озвучки, доступных языков/моделей и списка аудиозадач.",
  },
  {
    name: "start_voice_job",
    category: "voice",
    mode: "write",
    args: "mode: 'translate_and_voice' | 'voice_only' | 'translate_only', target_language?, model?",
    summary: "Запуск перевода и синтеза дикторской озвучки со сведением в единый трек.",
  },

  // Поиск видео / Футажи (3)
  {
    name: "list_footage_projects",
    category: "footage",
    mode: "read",
    summary: "Список проектов подбора хроники, кино, стоков и YouTube-фрагментов.",
  },
  {
    name: "start_footage_project",
    category: "footage",
    mode: "write",
    args: "title, voice_job_id? | script_text?, groups?, aspect_format?",
    summary: "Запуск автоматического поиска и нарезки видеошотов под озвучку или сценарий.",
  },
  {
    name: "control_footage_project",
    category: "footage",
    mode: "write",
    args: "project_id, action: 'status' | 'log' | 'stop' | 'resume' | 'delete'",
    summary: "Чтение прогресса и лога, пауза, возобновление или удаление проекта футажей.",
  },

  // Мониторинг · Admin (6) — показываются только администраторам
  {
    name: "get_system_overview",
    category: "admin",
    mode: "read",
    adminOnly: true,
    summary: "Единый срез очередей JobQueue, пула браузерных профилей, промптов, графики и микросервисов.",
  },
  {
    name: "get_accounts_status",
    category: "admin",
    mode: "read",
    adminOnly: true,
    summary: "Состояние всех профилей (кулдауны видео/картинок, живые и мёртвые прокси, привязка Flow-проекта).",
  },
  {
    name: "reset_account_cooldown",
    category: "admin",
    mode: "write",
    args: "account_name, scope: 'all' | 'video' | 'image' | 'video_denied'",
    adminOnly: true,
    summary: "Сброс in-memory кулдаунов квот на выбранном профиле.",
  },
  {
    name: "revive_account_proxies",
    category: "admin",
    mode: "write",
    args: "account_name, proxies?",
    adminOnly: true,
    summary: "Очистка списка dead_proxies.txt для возврата прокси в ротацию.",
  },
  {
    name: "tail_server_logs",
    category: "admin",
    mode: "read",
    args: "lines?, level?, contains?",
    adminOnly: true,
    summary: "Чтение последних строк серверного лога с фильтрацией и автоскрытием секретов.",
  },
  {
    name: "diagnose_job",
    category: "admin",
    mode: "read",
    args: "job_id",
    adminOnly: true,
    summary: "Глубокая диагностика задачи: причины skip, квоты профилей, прокси и релевантные строки лога.",
  },
]

export const MCP_RESOURCES: McpResourceItem[] = [
  {
    uri: "fl://modes",
    title: "Спецификация режимов генерации",
    summary: "JSON-таблица всех режимов (t2v, flash_t2v, img, i2v, flash_i2v, i2i2v, f2v) и требований к промптам.",
  },
  {
    uri: "fl://pipeline",
    title: "Карта конвейера платформы",
    summary: "Структура этапов производства, статусов задач и правил передачи данных между сервисами.",
  },
  {
    uri: "fl://jobs/{job_id}",
    title: "Снимок задачи по ID",
    summary: "Динамический URI-шаблон для чтения прогресса и позиции конкретной задачи в очереди.",
  },
]

export const MCP_PROMPT_TEMPLATES: McpPromptTemplateItem[] = [
  {
    name: "launch_video_pipeline",
    args: "topic_or_title, style?, mode?",
    summary: "Пошаговый сценарий оркестрации нового ролика через проекты, промпты, графику и генерацию.",
  },
  {
    name: "troubleshoot_job",
    args: "job_id",
    summary: "Шаблон глубокого разбора конкретной задачи и формирования плана перезапуска.",
  },
  {
    name: "ops_health_check",
    summary: "Полный операционный аудит очередей, квот, прокси и остановленных задач.",
    adminOnly: true,
  },
]
