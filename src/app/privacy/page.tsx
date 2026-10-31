import type { Metadata } from "next"
import Link from "next/link"

import { Logo } from "@/components/shell/logo"

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Motion Pr",
  description: "Политика обработки и защиты персональных данных пользователей сервиса Motion Pr (motionpr.org).",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-[720px]">
        <header className="flex items-center justify-between border-b border-line pb-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="size-7" />
            <span className="text-[15px] font-semibold">Motion Pr</span>
          </Link>
          <Link href="/login" className="text-xs font-medium text-electric-text hover:underline">
            Назад к сервису
          </Link>
        </header>

        <article className="mt-8 space-y-5 text-sm leading-relaxed text-foreground-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Политика конфиденциальности</h1>
            <p className="mt-1 text-xs text-muted-foreground">Редакция от 31 октября 2026 г. · motionpr.org</p>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Какие данные мы собираем</h2>
            <p>
              При регистрации и входе в Motion Pr мы обрабатываем адрес электронной почты, отображаемое имя, аватар
              профиля (в том числе при входе через Google OAuth 2.0: базовые поля профиля <code>openid</code>,{" "}
              <code>email</code> и <code>profile</code>), а также технические сведения о сессиях (IP-адрес и User-Agent
              браузера для защиты аккаунта и отображения активных устройств).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Как используются данные</h2>
            <p>
              Персональные данные используются исключительно для аутентификации пользователя, изоляции рабочих проектов
              и медиафайлов аккаунта, отправки одноразовых кодов входа и ссылок восстановления пароля, а также защиты от
              несанкционированного доступа. Мы не продаём и не передаём пользовательские данные рекламным сетям.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Хранение и защита</h2>
            <p>
              Пароли хранятся только в виде криптографических хешей Argon2id. Сессии защищены односторонним хешированием
              токенов и HttpOnly-cookie. Вы можете в любой момент просмотреть и завершить активные сессии или отвязать
              Google-аккаунт в разделе «Аккаунт».
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Контакты</h2>
            <p>
              По вопросам обработки или удаления данных аккаунта свяжитесь с администратором платформы по адресу{" "}
              <a href="mailto:yeelisey@gmail.com" className="text-electric-text hover:underline">
                yeelisey@gmail.com
              </a>
              .
            </p>
          </section>
        </article>
      </div>
    </div>
  )
}
