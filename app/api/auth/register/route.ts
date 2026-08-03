import { NextResponse } from "next/server"
import { hashPassword } from "@/lib/auth/password"
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
import { logger } from "@/lib/logger"
import { createUser } from "@/lib/repositories/users"
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
    const passwordHash = await hashPassword(password)
    const user = await createUser(email.toLowerCase(), passwordHash)
    if (!user) {
      return jsonError(409, "email is already registered")
    }

    logger.info({ userId: user.id }, "user registered")

    const token = await createSessionToken(user.id)
    const response = NextResponse.json({ email: user.email }, { status: 201 })
    response.cookies.set(sessionCookieName, token, sessionCookieOptions)
    return response
  })
}
