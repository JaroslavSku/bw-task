import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  try {
    await getPool().query("select 1")
    return NextResponse.json({ status: "ok" })
  } catch (error) {
    logger.error({ err: error }, "health check could not reach the database")
    return NextResponse.json(
      { status: "database unreachable" },
      { status: 503 },
    )
  }
}
