import type { Metadata } from "next"
import { Suspense } from "react"
import { Golos_Text, JetBrains_Mono } from "next/font/google"
import Script from "next/script"

import { Providers } from "@/components/providers"
import { AppShell } from "@/components/shell/app-shell"
import { SidebarFallback } from "@/components/shell/nav"
import { themeScript } from "@/lib/theme-script"
import "./globals.css"

const golos = Golos_Text({ variable: "--font-golos", subsets: ["latin", "cyrillic"] })
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin", "cyrillic"] })

export const metadata: Metadata = {
  title: "Motion Pr",
  description: "Производство роликов: сценарий, озвучка, генерации, графика, монтаж",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`dark ${golos.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <Providers>
          <Suspense
            fallback={
              <div className="flex min-h-dvh flex-col md:flex-row">
                <SidebarFallback />
                <div className="min-w-0 flex-1" />
              </div>
            }
          >
            <AppShell>{children}</AppShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  )
}
