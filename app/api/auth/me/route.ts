import { NextResponse } from "next/server"
import { getCurrentUserId } from "@/lib/auth/currentUser"
import { handleRoute, jsonError } from "@/lib/http"
import { findUserById } from "@/lib/repositories/users"

export function GET(): Promise<Response> {
  return handleRoute(async () => {
    const userId = await getCurrentUserId()
    if (!userId) {
      return jsonError(401, "unauthorized")
    }

    const user = await findUserById(userId)
    if (!user) {
      return jsonError(401, "unauthorized")
    }

    return NextResponse.json({ email: user.email })
  })
}
