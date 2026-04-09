import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

const protectedPrefixes = ["/dashboard", "/runs", "/saved-searches", "/targets", "/settings", "/scans"] as const

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hasSessionCookie = Boolean(getSessionCookie(request))
  const requestHeaders = new Headers(request.headers)

  requestHeaders.set("x-stackray-pathname", pathname)

  if (pathname === "/change-password") {
    if (!hasSessionCookie) {
      return NextResponse.redirect(new URL("/sign-in", request.url))
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  if (protectedPrefixes.some((prefix) => matchesPrefix(pathname, prefix)) && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: ["/dashboard/:path*", "/runs/:path*", "/saved-searches/:path*", "/targets/:path*", "/settings/:path*", "/scans/:path*", "/change-password"],
}
