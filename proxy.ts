import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

const protectedPrefixes = ["/dashboard", "/history", "/saved-searches", "/search", "/settings", "/scans"] as const

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hasSessionCookie = Boolean(getSessionCookie(request))

  if (pathname === "/change-password") {
    if (!hasSessionCookie) {
      return NextResponse.redirect(new URL("/sign-in", request.url))
    }

    return NextResponse.next()
  }

  if (protectedPrefixes.some((prefix) => matchesPrefix(pathname, prefix)) && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/history/:path*", "/saved-searches/:path*", "/search/:path*", "/settings/:path*", "/scans/:path*", "/change-password"],
}
