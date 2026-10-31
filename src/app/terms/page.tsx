import type { Metadata } from "next"
import Link from "next/link"

import { Logo } from "@/components/shell/logo"

export const metadata: Metadata = {
  title: "Условия использования — Motion Pr",
  description: "Пользовательское соглашение и правила использования сервиса Motion Pr (motionpr.org).",
}

export default function TermsPage() {
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
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Условия использования</h1>
            <p className="mt-1 text-xs text-muted-foreground">Редакция от 31 октября 2026 г. · motionpr.org</p>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Назначение сервиса</h2>
            <p>
              Motion Pr предоставляет инструменты автоматизации продакшена видео, инфографики, озвучки и сценариев для
              авторизованных пользователей платформы.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Учётная запись и безопасность</h2>
            <p>
              Пользователь обязуется указывать достоверный адрес электронной почты, обеспечивать сохранность учётных
              данных и незамедлительно завершать подозрительные сессии в настройках аккаунта. Администрация вправе
              ограничить доступ к учётной записи при нарушении правил безопасности или злоупотреблении вычислительными
              ресурсами.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Контент пользователя</h2>
            <p>
              Права на загружаемые исходные материалы и сгенерированные результаты принадлежат пользователю. Пользователь
              самостоятельно несёт ответственность за соблюдение авторских прав и применимого законодательства при
              загрузке и публикации материалов.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Обратная связь</h2>
            <p>
              Вопросы по работе сервиса направляйте на{" "}
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
