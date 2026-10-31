"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-form"
import { auth } from "@/lib/api"

function ForgotPasswordInner() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get("email") ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await auth.forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить письмо")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div className="rounded-[4px] border border-line bg-surface p-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Восстановление пароля</h1>

        {sent ? (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-start gap-2.5 rounded-[3px] border border-line bg-background p-3.5 text-[13px] text-foreground-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                Если аккаунт <span className="font-mono text-foreground">{email.trim()}</span> зарегистрирован, мы
                отправили письмо со ссылкой для сброса пароля. Проверьте «Входящие» и «Спам».
              </div>
            </div>
            <Link
              href="/login"
              className="flex h-10 w-full items-center justify-center rounded-[3px] border border-line-strong bg-background text-sm font-medium hover:border-faint"
            >
              Вернуться ко входу
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              Укажите почту аккаунта — отправим одноразовую ссылку для смены пароля.
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

            <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3.5">
              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
                  Почта
                </label>
                <input
                  id="forgot-email"
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
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Отправить ссылку
              </button>
            </form>
          </>
        )}
      </div>

      <p className="mt-4 text-center text-[13px] text-muted-foreground">
        <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-electric">
          <ArrowLeft className="size-3.5" />
          Назад ко входу
        </Link>
      </p>
    </AuthShell>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <ForgotPasswordInner />
    </Suspense>
  )
}
