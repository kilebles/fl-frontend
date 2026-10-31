"use client"

import { useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Camera,
  Check,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Shield,
  Smartphone,
  Trash2,
  UserCog,
} from "lucide-react"
import { toast } from "sonner"

import { GoogleMark } from "@/components/auth/auth-form"
import { PageHeader } from "@/components/shell/page-header"
import { admin, api, auth, type AdminUser, type User, type UserSession } from "@/lib/api"
import { UserAvatar, authKeys, useAuth } from "@/lib/auth"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

type TabId = "profile" | "security" | "admin"

const dateTimeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const shortDateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function formatDateTime(iso: string): string {
  try {
    return dateTimeFmt.format(new Date(iso))
  } catch {
    return iso
  }
}

function formatShortDate(iso: string): string {
  try {
    return shortDateFmt.format(new Date(iso))
  } catch {
    return iso
  }
}

function isMobileDevice(device: string): boolean {
  return device.includes("iOS") || device.includes("Android")
}

function ProfileTab({ user }: { user: User }) {
  const { setUser, refresh } = useAuth()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState("")
  const [verifyCode, setVerifyCode] = useState("")
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const { data: providers } = useQuery({
    queryKey: authKeys.providers,
    queryFn: auth.providers,
    staleTime: 60_000,
    retry: false,
  })

  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase()
  const hasChanges = name.trim() !== user.name || emailChanged

  const saveProfile = useMutation({
    mutationFn: () =>
      auth.updateProfile({
        name: name.trim(),
        email: email.trim(),
        current_password: emailChanged && user.has_password ? currentPassword : undefined,
      }),
    onSuccess: (updated) => {
      setUser(updated)
      setName(updated.name)
      setEmail(updated.email)
      setCurrentPassword("")
      toast.success("Профиль сохранён")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const clearAvatar = useMutation({
    mutationFn: () => auth.updateProfile({ clear_avatar: true }),
    onSuccess: (updated) => {
      setUser(updated)
      toast("Аватар удалён")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const unlinkGoogle = useMutation({
    mutationFn: () => auth.unlinkGoogle(),
    onSuccess: (updated) => {
      setUser(updated)
      qc.invalidateQueries({ queryKey: authKeys.me })
      toast("Аккаунт Google отключён")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const sendVerify = useMutation({
    mutationFn: () => auth.sendVerifyEmail(),
    onSuccess: () => {
      setVerifyOpen(true)
      toast.success("Письмо с кодом и ссылкой отправлено")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const confirmVerify = useMutation({
    mutationFn: () => auth.confirmVerifyEmail({ code: verifyCode.trim() }),
    onSuccess: async () => {
      setVerifyCode("")
      setVerifyOpen(false)
      await refresh()
      toast.success("Почта подтверждена")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploadingAvatar(true)
    try {
      const uploaded = await api.upload(file)
      const updated = await auth.updateProfile({ avatar_key: uploaded.key })
      setUser(updated)
      toast.success("Аватар обновлён")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось загрузить файл")
    } finally {
      setUploadingAvatar(false)
    }
  }

  function onConnectGoogle() {
    if (providers && !providers.google) {
      toast.error("Вход через Google не настроен на сервере")
      return
    }
    window.location.href = auth.googleStartUrl("/account", "link")
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <section className="rounded-[4px] border border-line bg-surface p-5">
        <h2 className="text-[15px] font-semibold">Профиль</h2>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-b border-line pb-5">
          <UserAvatar user={user} className="size-14 text-base" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              На платформе с {formatShortDate(user.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={onPickAvatar}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-line-strong bg-background px-3 text-xs font-medium transition-colors hover:border-faint disabled:opacity-50"
            >
              {uploadingAvatar ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
              Загрузить фото
            </button>
            {user.avatar_url && (
              <button
                type="button"
                disabled={clearAvatar.isPending}
                onClick={() => clearAvatar.mutate()}
                className="inline-flex h-8 items-center rounded-[3px] px-2.5 text-xs text-muted-foreground transition-colors hover:bg-elev hover:text-danger"
              >
                Удалить
              </button>
            )}
          </div>
        </div>

        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            saveProfile.mutate()
          }}
        >
          <div>
            <label htmlFor="profile-name" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
              Имя
            </label>
            <input
              id="profile-name"
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-[3px] border border-line-strong bg-background px-3 text-sm outline-none transition-colors focus:border-electric"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="profile-email" className="text-[13px] font-medium text-foreground-2">
                Электронная почта
              </label>
              {user.email_verified ? (
                <span className="inline-flex items-center gap-1 rounded-[2px] bg-ok/12 px-2 py-0.5 text-[11px] font-medium text-ok">
                  <Check className="size-3" />
                  Подтверждена
                </span>
              ) : (
                providers?.email_code && (
                  <button
                    type="button"
                    disabled={sendVerify.isPending}
                    onClick={() => sendVerify.mutate()}
                    className="text-xs font-medium text-electric-text hover:underline disabled:opacity-50"
                  >
                    {sendVerify.isPending ? "Отправляем…" : "Подтвердить почту"}
                  </button>
                )
              )}
            </div>
            <input
              id="profile-email"
              type="email"
              required
              maxLength={320}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 w-full rounded-[3px] border border-line-strong bg-background px-3 font-mono text-[13px] outline-none transition-colors focus:border-electric"
            />
            {!user.email_verified && verifyOpen && (
              <div className="mt-2.5 flex items-center gap-2 rounded-[3px] border border-line bg-background p-2.5">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-значный код из письма"
                  className="h-8 flex-1 rounded-[3px] border border-line-strong bg-surface px-2.5 font-mono text-xs outline-none focus:border-electric"
                />
                <button
                  type="button"
                  disabled={verifyCode.length < 6 || confirmVerify.isPending}
                  onClick={() => confirmVerify.mutate()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[3px] bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {confirmVerify.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Подтвердить
                </button>
              </div>
            )}
          </div>

          {emailChanged && user.has_password && (
            <div>
              <label htmlFor="profile-cur-pw" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
                Текущий пароль для подтверждения смены почты
              </label>
              <input
                id="profile-cur-pw"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="h-9 w-full rounded-[3px] border border-line-strong bg-background px-3 text-sm outline-none transition-colors focus:border-electric"
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!hasChanges || saveProfile.isPending}
              className="inline-flex h-9 items-center gap-2 rounded-[3px] bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-45"
            >
              {saveProfile.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Сохранить
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[4px] border border-line bg-surface p-5">
        <h2 className="text-[15px] font-semibold">Способы входа</h2>
        <div className="mt-4 divide-y divide-line">
          <div className="flex items-center justify-between gap-3 pb-3.5">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-[3px] border border-line-strong bg-background">
                <Mail className="size-4 text-muted-foreground" />
              </span>
              <div>
                <p className="text-sm font-medium">Почта и пароль</p>
                <p className="font-mono text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <span
              className={cn(
                "rounded-[2px] px-2 py-0.5 text-xs font-medium",
                user.has_password ? "bg-ok/12 text-ok" : "bg-surface-2 text-muted-foreground"
              )}
            >
              {user.has_password ? "Установлен" : "Пароль не задан"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3.5">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-[3px] border border-line-strong bg-background">
                <GoogleMark />
              </span>
              <div>
                <p className="text-sm font-medium">Google</p>
                <p className="text-xs text-muted-foreground">
                  {user.has_google ? "Вход в один клик подключён" : "Не привязан к аккаунту"}
                </p>
              </div>
            </div>
            {user.has_google ? (
              <button
                type="button"
                disabled={!user.has_password || unlinkGoogle.isPending}
                title={!user.has_password ? "Сначала задайте пароль во вкладке «Пароль и сессии»" : undefined}
                onClick={() => unlinkGoogle.mutate()}
                className="h-8 rounded-[3px] border border-line-strong bg-background px-3 text-xs font-medium text-foreground-2 transition-colors hover:border-danger/50 hover:text-danger disabled:opacity-45"
              >
                Отключить
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnectGoogle}
                className="h-8 rounded-[3px] border border-line-strong bg-background px-3 text-xs font-medium transition-colors hover:border-faint"
              >
                Подключить
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function SecurityTab() {
  const { user, refresh, logout } = useAuth()
  const qc = useQueryClient()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [revokeOthersOnPw, setRevokeOthersOnPw] = useState(true)

  const sessionsQuery = useQuery({
    queryKey: authKeys.sessions,
    queryFn: auth.sessions,
  })

  const updatePassword = useMutation({
    mutationFn: () =>
      auth.changePassword({
        current_password: user?.has_password ? currentPassword : null,
        new_password: newPassword,
        revoke_other_sessions: revokeOthersOnPw,
      }),
    onSuccess: async (res) => {
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      await refresh()
      qc.invalidateQueries({ queryKey: authKeys.sessions })
      toast.success(
        res.revoked_sessions > 0
          ? `Пароль обновлён · завершено других сессий: ${res.revoked_sessions}`
          : "Пароль обновлён"
      )
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const revokeOne = useMutation({
    mutationFn: (session: UserSession) => auth.revokeSession(session.id),
    onSuccess: (_, session) => {
      if (session.is_current) {
        void logout()
        return
      }
      qc.setQueryData<UserSession[]>(authKeys.sessions, (prev) => prev?.filter((s) => s.id !== session.id))
      toast("Сессия завершена")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const revokeOthers = useMutation({
    mutationFn: auth.revokeOtherSessions,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: authKeys.sessions })
      toast.success(`Завершено сессий: ${res.revoked}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error("Новый пароль должен содержать минимум 8 символов")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("Пароли не совпадают")
      return
    }
    updatePassword.mutate()
  }

  if (!user) return null
  const sessions = sessionsQuery.data ?? []
  const otherSessionsCount = sessions.filter((s) => !s.is_current).length

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <section className="rounded-[4px] border border-line bg-surface p-5">
        <h2 className="text-[15px] font-semibold">
          {user.has_password ? "Смена пароля" : "Задать пароль для входа по почте"}
        </h2>

        <form onSubmit={onSubmitPassword} className="mt-4 flex flex-col gap-3.5">
          {user.has_password && (
            <div>
              <label htmlFor="sec-cur-pw" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
                Текущий пароль
              </label>
              <input
                id="sec-cur-pw"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-9 w-full rounded-[3px] border border-line-strong bg-background px-3 text-sm outline-none transition-colors focus:border-electric"
              />
            </div>
          )}

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="sec-new-pw" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
                Новый пароль
              </label>
              <input
                id="sec-new-pw"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                placeholder="Минимум 8 символов"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-9 w-full rounded-[3px] border border-line-strong bg-background px-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-electric"
              />
            </div>
            <div>
              <label htmlFor="sec-confirm-pw" className="mb-1.5 block text-[13px] font-medium text-foreground-2">
                Подтверждение
              </label>
              <input
                id="sec-confirm-pw"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                placeholder="Повторите пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-9 w-full rounded-[3px] border border-line-strong bg-background px-3 text-sm outline-none transition-colors placeholder:text-faint focus:border-electric"
              />
            </div>
          </div>

          {otherSessionsCount > 0 && (
            <label className="mt-1 flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={revokeOthersOnPw}
                onChange={(e) => setRevokeOthersOnPw(e.target.checked)}
                className="size-4 accent-electric"
              />
              Выйти на всех остальных устройствах после смены пароля
            </label>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={updatePassword.isPending}
              className="inline-flex h-9 items-center gap-2 rounded-[3px] bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {updatePassword.isPending && <Loader2 className="size-4 animate-spin" />}
              {user.has_password ? "Обновить пароль" : "Задать пароль"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[4px] border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Активные сессии</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {sessions.length}{" "}
              {plural(sessions.length, "активное устройство", "активных устройства", "активных устройств")}
            </p>
          </div>
          {otherSessionsCount > 0 && (
            <button
              type="button"
              disabled={revokeOthers.isPending}
              onClick={() => revokeOthers.mutate()}
              className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-line-strong bg-background px-3 text-xs font-medium text-danger transition-colors hover:border-danger/50 hover:bg-danger/10 disabled:opacity-50"
            >
              {revokeOthers.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Выйти на остальных ({otherSessionsCount})
            </button>
          )}
        </div>

        <div className="mt-4 divide-y divide-line">
          {sessionsQuery.isLoading ? (
            <div className="h-24 rounded-[3px] shimmer" />
          ) : (
            sessions.map((s) => {
              const Icon = isMobileDevice(s.device) ? Smartphone : Monitor
              return (
                <div key={s.id} className="flex items-start justify-between gap-3 py-3.5 first:pt-1 last:pb-0">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[3px] border border-line-strong bg-background">
                      <Icon className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{s.device}</span>
                        {s.is_current && (
                          <span className="rounded-[2px] bg-ok/12 px-1.5 py-0.5 text-[11px] font-medium text-ok">
                            Текущая
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {s.ip_address || "локально"} · активность {formatDateTime(s.last_seen_at)}
                      </p>
                      <p className="font-mono text-[11px] text-faint">Вход: {formatDateTime(s.created_at)}</p>
                    </div>
                  </div>
                  {!s.is_current && (
                    <button
                      type="button"
                      disabled={revokeOne.isPending}
                      onClick={() => revokeOne.mutate(s)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[3px] px-2.5 text-xs text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                      Завершить
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}

function AdminTab() {
  const { user: currentUser } = useAuth()
  const qc = useQueryClient()

  const usersQuery = useQuery({
    queryKey: authKeys.adminUsers,
    queryFn: admin.users,
  })

  const patchUser = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { role?: "user" | "admin"; is_active?: boolean } }) =>
      admin.updateUser(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData<AdminUser[]>(authKeys.adminUsers, (prev) =>
        prev?.map((u) => (u.id === updated.id ? updated : u))
      )
      toast.success("Изменения сохранены")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const users = usersQuery.data ?? []

  return (
    <section className="max-w-4xl rounded-[4px] border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Пользователи</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Всего зарегистрировано: {users.length}
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-line">
        {usersQuery.isLoading ? (
          <div className="h-28 rounded-[3px] shimmer" />
        ) : (
          users.map((u) => {
            const isSelf = u.id === currentUser?.id
            return (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar user={u} className="size-8" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{u.name}</span>
                      {u.role === "admin" && (
                        <span className="rounded-[2px] bg-electric-soft px-1.5 py-0.5 font-mono text-[10px] font-medium text-electric-text uppercase">
                          admin
                        </span>
                      )}
                      {!u.is_active && (
                        <span className="rounded-[2px] bg-danger/15 px-1.5 py-0.5 text-[11px] font-medium text-danger">
                          Заблокирован
                        </span>
                      )}
                      {isSelf && <span className="text-[11px] text-faint">(вы)</span>}
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {u.email} · сессий: {u.active_sessions} · с {formatShortDate(u.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSelf || patchUser.isPending}
                    onClick={() =>
                      patchUser.mutate({
                        id: u.id,
                        patch: { role: u.role === "admin" ? "user" : "admin" },
                      })
                    }
                    className="h-8 rounded-[3px] border border-line-strong bg-background px-2.5 text-xs font-medium transition-colors hover:border-faint disabled:opacity-40"
                  >
                    {u.role === "admin" ? "Сделать user" : "Сделать admin"}
                  </button>
                  <button
                    type="button"
                    disabled={isSelf || patchUser.isPending}
                    onClick={() =>
                      patchUser.mutate({
                        id: u.id,
                        patch: { is_active: !u.is_active },
                      })
                    }
                    className={cn(
                      "h-8 rounded-[3px] border px-2.5 text-xs font-medium transition-colors disabled:opacity-40",
                      u.is_active
                        ? "border-line-strong bg-background text-danger hover:border-danger/50 hover:bg-danger/10"
                        : "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20"
                    )}
                  >
                    {u.is_active ? "Блокировать" : "Разблокировать"}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export function AccountView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, logout } = useAuth()

  const rawTab = searchParams.get("tab")
  const authError = searchParams.get("auth_error")
  const isAdmin = user?.role === "admin"
  const activeTab: TabId =
    rawTab === "security" ? "security" : rawTab === "admin" && isAdmin ? "admin" : "profile"

  function setTab(next: TabId) {
    const qs = next === "profile" ? "" : `?tab=${next}`
    router.replace(`/account${qs}`, { scroll: false })
  }

  const tabs: { id: TabId; label: string; icon: typeof UserCog }[] = [
    { id: "profile", label: "Профиль", icon: UserCog },
    { id: "security", label: "Пароль и сессии", icon: KeyRound },
    ...(isAdmin ? [{ id: "admin" as const, label: "Пользователи", icon: Shield }] : []),
  ]

  return (
    <div className="px-4 pt-8 pb-20 sm:px-7">
      <PageHeader
        title="Аккаунт"
        actions={
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-line-strong bg-surface px-3.5 text-sm font-medium text-foreground-2 transition-colors hover:border-danger/50 hover:text-danger"
          >
            <LogOut className="size-4" />
            Выйти
          </button>
        }
      />

      {authError && (
        <div
          role="alert"
          className="mb-5 flex max-w-2xl items-start gap-2 rounded-[4px] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-1 border-b border-line pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const on = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-[3px] px-3 text-sm transition-colors",
                on
                  ? "bg-elev font-medium text-foreground"
                  : "text-muted-foreground hover:bg-elev/60 hover:text-foreground"
              )}
            >
              <Icon className={cn("size-4", on ? "text-electric" : "text-muted-foreground")} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === "profile" && user && <ProfileTab key={user.id} user={user} />}
      {activeTab === "security" && <SecurityTab />}
      {activeTab === "admin" && isAdmin && <AdminTab />}
    </div>
  )
}
