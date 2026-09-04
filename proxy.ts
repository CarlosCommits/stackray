import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

import { buildSignInHref } from "@/lib/auth/return-to"

const protectedPrefixes = ["/dashboard", "/runs", "/targets", "/settings", "/scans"] as const

function canUseDevelopmentActor() {
  return process.env.NODE_ENV !== "production" && process.env.STACKRAY_ENABLE_DEV_ACTOR === "true"
}

function canUseDemoActor() {
  return process.env.STACKRAY_ENABLE_DEMO === "true"
}

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const returnTo = `${pathname}${request.nextUrl.search}`
  const hasSessionCookie = Boolean(getSessionCookie(request))
  const hasSessionAccess = hasSessionCookie || canUseDevelopmentActor() || canUseDemoActor()
  const requestHeaders = new Headers(request.headers)

  requestHeaders.set("x-stackray-pathname", pathname)
  requestHeaders.set("x-stackray-return-to", returnTo)

  if (pathname === "/change-password") {
    if (!hasSessionAccess) {
      return NextResponse.redirect(new URL("/", request.url))
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  if (protectedPrefixes.some((prefix) => matchesPrefix(pathname, prefix)) && !hasSessionAccess) {
    return NextResponse.redirect(new URL(buildSignInHref(returnTo), request.url))
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: ["/dashboard/:path*", "/runs/:path*", "/targets/:path*", "/settings/:path*", "/scans/:path*", "/change-password"],
}
