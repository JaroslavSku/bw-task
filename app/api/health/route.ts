import { NextResponse } from "next/server"
import { getPool } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  try {
    await getPool().query("select 1")
    return NextResponse.json({ status: "ok" })
  } catch {
    return NextResponse.json(
      { status: "database unreachable" },
      { status: 503 },
    )
  }
}
