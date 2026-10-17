import type { Metadata } from "next"
import { Suspense } from "react"
import { Golos_Text, JetBrains_Mono } from "next/font/google"
import Script from "next/script"

import { Providers } from "@/components/providers"
import { MobileNav, Sidebar, SidebarFallback } from "@/components/shell/nav"
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
          <div className="flex min-h-dvh flex-col md:flex-row">
            <Suspense fallback={<SidebarFallback />}>
              <Sidebar />
              <MobileNav />
            </Suspense>
            <main className="relative min-w-0 flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
