"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { AuthShell } from "@/components/auth/auth-form"
import { auth } from "@/lib/api"
import { useAuth } from "@/lib/auth"

function ResetPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const { setUser } = useAuth()

  const token = searchParams.get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError("Ссылка неполная — запросите сброс пароля заново")
      return
    }
    if (password.length < 8) {
      setError("Пароль должен содержать минимум 8 символов")
      return
    }
    if (password !== confirm) {
      setError("Пароли не совпадают")
      return
    }
    setSubmitting(true)
    try {
      const user = await auth.resetPassword(token, password)
      qc.clear()
      setUser(user)
      toast.success("Пароль обновлён")
      router.replace("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить пароль")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div className="rounded-[4px] border border-line bg-surface p-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Новый пароль</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Задайте новый пароль — старые сессии на других устройствах будут завершены.
        </p>

        {(error || !token) && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-[3px] border border-danger/30 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error || "Ссылка для сброса пароля отсутствует. Запросите новое письмо."}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3.5">
          <div>
            <label htmlFor="reset-pw" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
              Новый пароль
            </label>
            <div className="relative">
              <input
                id="reset-pw"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
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

          <div>
            <label htmlFor="reset-pw-confirm" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
              Повторите пароль
            </label>
            <input
              id="reset-pw-confirm"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="h-9 w-full rounded-[3px] border border-line-strong bg-background px-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-electric"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !token}
            className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-[3px] bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Сохранить пароль и войти
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-[13px] text-muted-foreground">
        <Link href="/forgot-password" className="font-medium text-foreground underline underline-offset-4 hover:text-electric">
          Запросить новую ссылку
        </Link>
      </p>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <ResetPasswordInner />
    </Suspense>
  )
}
