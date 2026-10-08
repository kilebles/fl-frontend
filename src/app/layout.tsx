import type { Metadata } from "next"
import { Suspense } from "react"
import { JetBrains_Mono, Onest } from "next/font/google"

import { Providers } from "@/components/providers"
import { Sidebar, SidebarFallback } from "@/components/shell/nav"
import { Topbar } from "@/components/shell/topbar"
import "./globals.css"

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"] })
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin", "cyrillic"] })

export const metadata: Metadata = {
  title: "flowgen — генерация видео",
  description: "Пакетная генерация видео и картинок в Google Flow",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`dark ${onest.variable} ${jetbrains.variable} h-full`}>
      <body className="h-full overflow-hidden">
        <Providers>
          <div className="flex h-full flex-col p-1.5 pt-0 md:p-2 md:pt-0">
            <Topbar />
            <div className="flex min-h-0 flex-1 gap-2">
              <Suspense fallback={<SidebarFallback />}>
                <Sidebar />
              </Suspense>
              <main className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-surface/70">
                <div className="panel-backdrop pointer-events-none absolute inset-0" />
                <div className="relative h-full overflow-y-auto">{children}</div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}
