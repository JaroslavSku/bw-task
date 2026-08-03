import { cookies } from "next/headers"
import { getUserIdFromToken, sessionCookieName } from "@/lib/auth/session"

export async function getCurrentUserId(): Promise<number | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(sessionCookieName)?.value
  if (!token) {
    return null
  }
  return getUserIdFromToken(token)
}
