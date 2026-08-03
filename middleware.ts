import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getUserIdFromToken, sessionCookieName } from "@/lib/auth/session"

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(sessionCookieName)?.value
  const userId = token ? await getUserIdFromToken(token) : null
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/api")) {
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (pathname === "/login") {
    if (userId) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/login", "/api/todos/:path*", "/api/auth/me"],
}
