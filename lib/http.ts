import { NextResponse } from "next/server"
import type { ZodError } from "zod"
import { logger } from "@/lib/logger"

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export function validationError(error: ZodError): NextResponse {
  return NextResponse.json(
    {
      error: "validation failed",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 },
  )
}

export async function readJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function handleRoute(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler()
  } catch (error) {
    logger.error({ err: error }, "unhandled api error")
    return jsonError(500, "internal server error")
  }
}
