import { NextResponse } from "next/server"
import { verifyPassword } from "@/lib/auth/password"
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/auth/session"
import {
  handleRoute,
  jsonError,
  readJsonBody,
  validationError,
} from "@/lib/http"
import { findUserByEmail } from "@/lib/repositories/users"
import { credentialsSchema } from "@/lib/schemas/auth"

export function POST(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const body = await readJsonBody(request)
    if (body === null) {
      return jsonError(400, "invalid json body")
    }

    const parsedCredentials = credentialsSchema.safeParse(body)
    if (!parsedCredentials.success) {
      return validationError(parsedCredentials.error)
    }

    const { email, password } = parsedCredentials.data
    const user = await findUserByEmail(email.toLowerCase())
    if (!user) {
      return jsonError(401, "invalid email or password")
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash)
    if (!passwordMatches) {
      return jsonError(401, "invalid email or password")
    }

    const token = await createSessionToken(user.id)
    const response = NextResponse.json({ email: user.email })
    response.cookies.set(sessionCookieName, token, sessionCookieOptions)
    return response
  })
}
