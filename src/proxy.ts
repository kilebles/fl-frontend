import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const SESSION_COOKIE = "fl_session"
const GUEST_AUTH_PAGES = new Set(["/login", "/register", "/forgot-password", "/reset-password"])
const OPEN_PAGES = new Set(["/verify-email", "/privacy", "/terms"])

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/"
  return raw
}

export function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_API_TOKEN) {
    return NextResponse.next()
  }

  const { pathname, search } = request.nextUrl
  if (OPEN_PAGES.has(pathname)) {
    return NextResponse.next()
  }
  const isAuthPage = GUEST_AUTH_PAGES.has(pathname)
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)

  if (isAuthPage) {
    if (request.nextUrl.searchParams.get("expired") === "1") {
      const response = NextResponse.next()
      response.cookies.delete(SESSION_COOKIE)
      return response
    }
    if (hasSession) {
      const target = safeNext(request.nextUrl.searchParams.get("next"))
      return NextResponse.redirect(new URL(target, request.url))
    }
    return NextResponse.next()
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url)
    const dest = pathname + search
    if (dest && dest !== "/") {
      loginUrl.searchParams.set("next", dest)
    }
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|files|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
