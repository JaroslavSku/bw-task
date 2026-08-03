import { Pool, types } from "pg"
import { getEnv } from "@/lib/env"
import { logger } from "@/lib/logger"

types.setTypeParser(types.builtins.DATE, (value) => value)

const globalScope = globalThis as unknown as { pgPool?: Pool }

export function getPool(): Pool {
  if (!globalScope.pgPool) {
    const pool = new Pool({
      connectionString: getEnv().DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
    pool.on("error", (error) => {
      logger.error({ err: error }, "idle database client errored")
    })
    globalScope.pgPool = pool
  }
  return globalScope.pgPool
}

export async function closePool(): Promise<void> {
  if (globalScope.pgPool) {
    await globalScope.pgPool.end()
    globalScope.pgPool = undefined
  }
}
