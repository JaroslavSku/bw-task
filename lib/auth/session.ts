import { SignJWT, jwtVerify } from "jose"
import { getEnv } from "@/lib/env"

const sessionDurationSeconds = 60 * 60 * 24 * 7

export const sessionCookieName = "session"

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: sessionDurationSeconds,
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET)
}

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({})
    .setSubject(String(userId))
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${sessionDurationSeconds}s`)
    .sign(getSecretKey())
}

export async function getUserIdFromToken(
  token: string,
): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    const userId = Number(payload.sub)
    return Number.isInteger(userId) && userId > 0 ? userId : null
  } catch {
    return null
  }
}
