"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-form"
import { auth } from "@/lib/api"
import { useAuth } from "@/lib/auth"

function VerifyEmailInner() {
  const searchParams = useSearchParams()
  const { user, refresh } = useAuth()
  const token = searchParams.get("token") ?? ""
  const startedRef = useRef(false)

  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error")
  const [message, setMessage] = useState<string>(token ? "" : "Ссылка подтверждения отсутствует")

  useEffect(() => {
    if (!token || startedRef.current) return
    startedRef.current = true
    auth
      .confirmVerifyEmail({ token })
      .then(async (res) => {
        setState("ok")
        setMessage(res.email)
        await refresh()
      })
      .catch((err: unknown) => {
        setState("error")
        setMessage(err instanceof Error ? err.message : "Не удалось подтвердить почту")
      })
  }, [token, refresh])

  return (
    <AuthShell>
      <div className="rounded-[4px] border border-line bg-surface p-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Подтверждение почты</h1>

        {state === "loading" && (
          <div className="mt-5 flex items-center gap-2.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Проверяем ссылку…
          </div>
        )}

        {state === "ok" && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-start gap-2.5 rounded-[3px] border border-line bg-background p-3.5 text-[13px] text-foreground-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                Почта <span className="font-mono text-foreground">{message}</span> успешно подтверждена.
              </div>
            </div>
            <Link
              href={user ? "/account" : "/login"}
              className="flex h-10 w-full items-center justify-center rounded-[3px] bg-primary text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {user ? "Перейти в аккаунт" : "Перейти ко входу"}
            </Link>
          </div>
        )}

        {state === "error" && (
          <div className="mt-4 flex flex-col gap-4">
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[3px] border border-danger/30 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{message}</span>
            </div>
            <Link
              href={user ? "/account" : "/login"}
              className="flex h-10 w-full items-center justify-center rounded-[3px] border border-line-strong bg-background text-sm font-medium hover:border-faint"
            >
              {user ? "Настройки аккаунта" : "На страницу входа"}
            </Link>
          </div>
        )}
      </div>
    </AuthShell>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <VerifyEmailInner />
    </Suspense>
  )
}
