"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, MailCheck } from "lucide-react"
import { toast } from "sonner"

import { Logo } from "@/components/shell/logo"
import { ThemeToggle } from "@/components/shell/nav"
import { ApiError, auth } from "@/lib/api"
import { authKeys, safeNextPath, useAuth } from "@/lib/auth"

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

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [loginIdent, setLoginIdent] = useState("")
  const [password, setPassword] = useState("")
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRegister = mode === "register"
  const switchHref = `${isRegister ? "/login" : "/register"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`
  const emailHint = loginIdent.includes("@") ? loginIdent.trim() : ""
  const forgotHref = `/forgot-password${emailHint ? `?email=${encodeURIComponent(emailHint)}` : ""}`
  const resetEnabled = Boolean(providers?.password_reset)

  async function onSubmitCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (isRegister) {
      const cleanU = username.trim().replace(/^@+/, "")
      if (cleanU.length < 3) {
        setError("Логин должен содержать минимум 3 символа")
        return
      }
      if (password.length < 8) {
        setError("Пароль должен содержать минимум 8 символов")
        return
      }
      setSubmitting(true)
      try {
        const pending = await auth.register({
          username: cleanU,
          email: email.trim(),
          password,
        })
        setPendingEmail(pending.email)
        setVerifyCode("")
        toast.success("Код подтверждения отправлен на почту")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка регистрации")
      } finally {
        setSubmitting(false)
      }
      return
    }

    setSubmitting(true)
    try {
      const user = await auth.login({
        login: loginIdent.trim(),
        password,
      })
      qc.clear()
      setUser(user)
      router.replace(next)
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError && err.code === "email_not_verified" && err.email) {
        setPendingEmail(err.email)
        setVerifyCode("")
        toast("Подтвердите почту кодом из письма")
      } else {
        setError(err instanceof Error ? err.message : "Ошибка авторизации")
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function onConfirmEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingEmail) return
    setError(null)
    setSubmitting(true)
    try {
      const user = await auth.confirmVerifyEmail({
        email: pendingEmail,
        code: verifyCode.trim(),
      })
      qc.clear()
      setUser(user)
      toast.success("Почта подтверждена")
      router.replace(next)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный код подтверждения")
    } finally {
      setSubmitting(false)
    }
  }

  async function onResendVerification() {
    if (!pendingEmail) return
    setError(null)
    setResending(true)
    try {
      await auth.resendVerifyEmail(pendingEmail)
      toast.success("Новый код отправлен на почту")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить письмо повторно")
    } finally {
      setResending(false)
    }
  }

  function onGoogleClick() {
    if (providers && !providers.google) {
      toast.error("Вход через Google не настроен на сервере")
      return
    }
    window.location.href = auth.googleStartUrl(next, "login")
  }

  if (pendingEmail) {
    return (
      <AuthShell>
        <div className="rounded-[4px] border border-line bg-surface p-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-[3px] bg-electric-soft text-electric-text">
              <MailCheck className="size-4" />
            </span>
            <h1 className="text-[20px] font-semibold tracking-tight">Подтвердите почту</h1>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            Мы отправили 6-значный код подтверждения на{" "}
            <span className="font-mono text-foreground">{pendingEmail}</span>. Введите код ниже или перейдите по ссылке
            в письме, чтобы завершить вход.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-[3px] border border-danger/30 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={onConfirmEmail} className="mt-4 flex flex-col gap-3.5">
            <div>
              <label htmlFor="verify-email-code" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
                6-значный код из письма
              </label>
              <input
                id="verify-email-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                autoFocus
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="h-10 w-full rounded-[3px] border border-line-strong bg-background px-3 text-center font-mono text-lg tracking-[0.28em] outline-none transition-colors placeholder:tracking-[0.28em] placeholder:text-faint focus:border-electric"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || verifyCode.length < 6}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-[3px] bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Подтвердить почту и войти
            </button>

            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                disabled={submitting || resending}
                onClick={() => {
                  setPendingEmail(null)
                  setVerifyCode("")
                  setError(null)
                }}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                Назад
              </button>
              <button
                type="button"
                disabled={submitting || resending}
                onClick={onResendVerification}
                className="font-medium text-electric-text hover:underline disabled:opacity-50"
              >
                {resending ? "Отправляем…" : "Отправить код повторно"}
              </button>
            </div>
          </form>
        </div>
      </AuthShell>
    )
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
          <span>или</span>
          <span className="h-px flex-1 bg-line-strong" />
        </div>

        <form onSubmit={onSubmitCredentials} className="flex flex-col gap-3.5">
          {isRegister ? (
            <>
              <div>
                <label htmlFor="auth-username" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
                  Логин
                </label>
                <input
                  id="auth-username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={32}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
                  placeholder="логин"
                  className="h-9 w-full rounded-[3px] border border-line-strong bg-background px-3 font-mono text-[13px] outline-none transition-colors placeholder:text-faint focus:border-electric"
                />
              </div>

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
            </>
          ) : (
            <div>
              <label htmlFor="auth-login" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
                Логин или почта
              </label>
              <input
                id="auth-login"
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                maxLength={320}
                value={loginIdent}
                onChange={(e) => setLoginIdent(e.target.value)}
                placeholder="логин или you@example.com"
                className="h-9 w-full rounded-[3px] border border-line-strong bg-background px-3 font-mono text-[13px] outline-none transition-colors placeholder:text-faint focus:border-electric"
              />
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="auth-password" className="text-[13px] font-medium text-foreground-2">
                Пароль
              </label>
              {!isRegister && resetEnabled && (
                <Link href={forgotHref} className="text-xs text-muted-foreground hover:text-foreground">
                  Забыли пароль?
                </Link>
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
