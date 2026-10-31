"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Eye, EyeOff, Loader2, Mail } from "lucide-react"
import { toast } from "sonner"

import { Logo } from "@/components/shell/logo"
import { ThemeToggle } from "@/components/shell/nav"
import { auth } from "@/lib/api"
import { authKeys, safeNextPath, useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

export function GoogleMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29A11.99 11.99 0 0 0 0 12c0 1.92.46 3.74 1.29 5.38l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
      />
    </svg>
  )
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col justify-between px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-[960px] items-center justify-between">
        <Link href="/login" className="flex items-center gap-2.5">
          <Logo className="size-7" />
          <span className="text-[15px] font-semibold">Motion Pr</span>
        </Link>
        <ThemeToggle className="w-36" />
      </div>
      <div className="mx-auto my-8 w-full max-w-[380px]">{children}</div>
      <div className="mx-auto flex w-full max-w-[960px] flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span>© Motion Pr</span>
        <Link href="/privacy" className="hover:text-foreground">
          Политика конфиденциальности
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          Условия использования
        </Link>
      </div>
    </div>
  )
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const { setUser } = useAuth()

  const next = safeNextPath(searchParams.get("next"))
  const oauthError = searchParams.get("auth_error")

  const { data: providers } = useQuery({
    queryKey: authKeys.providers,
    queryFn: auth.providers,
    staleTime: 60_000,
    retry: false,
  })

  const [method, setMethod] = useState<"password" | "code">("password")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [codeSent, setCodeSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRegister = mode === "register"
  const switchHref = `${isRegister ? "/login" : "/register"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`
  const forgotHref = `/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`
  const emailCodeEnabled = Boolean(providers?.email_code)
  const resetEnabled = Boolean(providers?.password_reset)

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8 && isRegister) {
      setError("Пароль должен содержать минимум 8 символов")
      return
    }
    setSubmitting(true)
    try {
      const user = isRegister
        ? await auth.register({ email: email.trim(), password, name: name.trim() })
        : await auth.login({ email: email.trim(), password })
      qc.clear()
      setUser(user)
      if (isRegister && emailCodeEnabled) {
        toast.success("Аккаунт создан — письмо для подтверждения отправлено на почту")
      }
      router.replace(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации")
    } finally {
      setSubmitting(false)
    }
  }

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await auth.sendEmailCode(email.trim())
      setCodeSent(true)
      setCode("")
      toast.success("Код отправлен на почту")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить код")
    } finally {
      setSubmitting(false)
    }
  }

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await auth.verifyEmailCode(email.trim(), code.trim())
      qc.clear()
      setUser(user)
      router.replace(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный код")
    } finally {
      setSubmitting(false)
    }
  }

  function onGoogleClick() {
    if (providers && !providers.google) {
      toast.error("Вход через Google не настроен (укажите GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET в fl-api/.env)")
      return
    }
    window.location.href = auth.googleStartUrl(next, "login")
  }

  return (
    <AuthShell>
      <div className="rounded-[4px] border border-line bg-surface p-6">
        <h1 className="text-[22px] font-semibold tracking-tight">{isRegister ? "Регистрация" : "Вход"}</h1>

        {(error || oauthError) && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-[3px] border border-danger/30 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error || oauthError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onGoogleClick}
          className="mt-5 flex h-10 w-full items-center justify-center gap-2.5 rounded-[3px] border border-line-strong bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-faint hover:bg-elev/40"
        >
          <GoogleMark />
          Продолжить с Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-line-strong" />
          <span>или по почте</span>
          <span className="h-px flex-1 bg-line-strong" />
        </div>

        {emailCodeEnabled && (
          <div className="mb-4 grid grid-cols-2 rounded-[3px] border border-line bg-background p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setMethod("password")
                setError(null)
              }}
              className={cn(
                "h-7 rounded-[2px] font-medium transition-colors",
                method === "password" ? "bg-surface text-foreground shadow-2xs ring-1 ring-line" : "text-muted-foreground hover:text-foreground"
              )}
            >
              По паролю
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod("code")
                setError(null)
              }}
              className={cn(
                "h-7 rounded-[2px] font-medium transition-colors",
                method === "code" ? "bg-surface text-foreground shadow-2xs ring-1 ring-line" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Код на почту
            </button>
          </div>
        )}

        {method === "code" && emailCodeEnabled ? (
          !codeSent ? (
            <form onSubmit={onSendCode} className="flex flex-col gap-3.5">
              <div>
                <label htmlFor="otp-email" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
                  Почта
                </label>
                <input
                  id="otp-email"
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={320}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-9 w-full rounded-[3px] border border-line-strong bg-background px-3 font-mono text-[13px] outline-none transition-colors placeholder:text-faint focus:border-electric"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-[3px] bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                Получить 6-значный код
              </button>
            </form>
          ) : (
            <form onSubmit={onVerifyCode} className="flex flex-col gap-3.5">
              <div className="rounded-[3px] border border-line bg-background px-3 py-2 text-xs text-muted-foreground">
                Отправили одноразовый код на <span className="font-mono text-foreground">{email.trim()}</span>
              </div>

              <div>
                <label htmlFor="otp-code" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
                  Код из письма
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                  className="h-10 w-full rounded-[3px] border border-line-strong bg-background px-3 text-center font-mono text-lg tracking-[0.28em] outline-none transition-colors placeholder:tracking-[0.28em] placeholder:text-faint focus:border-electric"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || code.length < 6}
                className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-[3px] bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Подтвердить и войти
              </button>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setCodeSent(false)
                    setCode("")
                    setError(null)
                  }}
                  className="hover:text-foreground"
                >
                  Изменить почту
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={(e) => onSendCode(e)}
                  className="hover:text-foreground"
                >
                  Отправить код повторно
                </button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={onSubmitPassword} className="flex flex-col gap-3.5">
            {isRegister && (
              <div>
                <label htmlFor="auth-name" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
                  Имя
                </label>
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Алексей"
                  className="h-9 w-full rounded-[3px] border border-line-strong bg-background px-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-electric"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
                Почта
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                maxLength={320}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-9 w-full rounded-[3px] border border-line-strong bg-background px-3 font-mono text-[13px] outline-none transition-colors placeholder:text-faint focus:border-electric"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="auth-password" className="text-[13px] font-medium text-foreground-2">
                  Пароль
                </label>
                {isRegister ? (
                  <span className="font-mono text-[11px] text-faint">от 8 символов</span>
                ) : (
                  resetEnabled && (
                    <Link href={forgotHref} className="text-xs text-muted-foreground hover:text-foreground">
                      Забыли пароль?
                    </Link>
                  )
                )}
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={isRegister ? 8 : 1}
                  maxLength={128}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9 w-full rounded-[3px] border border-line-strong bg-background pr-9 pl-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-electric"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-[3px] bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isRegister ? "Создать аккаунт" : "Войти"}
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-center text-[13px] text-muted-foreground">
        {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}{" "}
        <Link href={switchHref} className="font-medium text-foreground underline underline-offset-4 hover:text-electric">
          {isRegister ? "Войти" : "Зарегистрироваться"}
        </Link>
      </p>
    </AuthShell>
  )
}
