import { Client } from "pg"
import { getEnv } from "@/lib/env"
import { logger } from "@/lib/logger"

type ChangeHandler = (userId: number) => void

interface ListenerState {
  client: Client | null
  handlers: Set<ChangeHandler>
  connecting: boolean
  reconnectTimer: ReturnType<typeof setTimeout> | null
}

const reconnectDelayMs = 3_000

const globalScope = globalThis as unknown as { todosListener?: ListenerState }

function getListenerState(): ListenerState {
  if (!globalScope.todosListener) {
    globalScope.todosListener = {
      client: null,
      handlers: new Set(),
      connecting: false,
      reconnectTimer: null,
    }
  }
  return globalScope.todosListener
}

function handleNotification(
  state: ListenerState,
  rawPayload: string | undefined,
): void {
  if (!rawPayload) {
    return
  }
  try {
    const payload = JSON.parse(rawPayload) as { userId?: number }
    if (typeof payload.userId === "number") {
      for (const handler of state.handlers) {
        handler(payload.userId)
      }
    }
  } catch {
    logger.warn("ignoring malformed payload on todos_changed channel")
  }
}

function discardClient(state: ListenerState, client: Client): void {
  if (state.client === client) {
    state.client = null
  }
  client.end().catch(() => undefined)
}

function scheduleReconnect(state: ListenerState): void {
  if (state.reconnectTimer || state.handlers.size === 0) {
    return
  }
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null
    if (state.handlers.size === 0) {
      return
    }
    ensureConnected(state).catch(() => scheduleReconnect(state))
  }, reconnectDelayMs)
}

async function ensureConnected(state: ListenerState): Promise<void> {
  if (state.client || state.connecting) {
    return
  }
  state.connecting = true
  const client = new Client({ connectionString: getEnv().DATABASE_URL })
  try {
    await client.connect()
    client.on("notification", (message) =>
      handleNotification(state, message.payload),
    )
    client.on("error", (error) => {
      logger.error({ err: error }, "todos listener lost database connection")
      discardClient(state, client)
      scheduleReconnect(state)
    })
    await client.query("listen todos_changed")
    state.client = client
  } catch (error) {
    discardClient(state, client)
    throw error
  } finally {
    state.connecting = false
  }
}

export async function subscribeTodoChanges(
  handler: ChangeHandler,
): Promise<() => void> {
  const state = getListenerState()
  state.handlers.add(handler)
  try {
    await ensureConnected(state)
  } catch (error) {
    state.handlers.delete(handler)
    throw error
  }
  return () => {
    state.handlers.delete(handler)
  }
}

export async function closeTodosListener(): Promise<void> {
  const state = getListenerState()
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }
  state.handlers.clear()

  const client = state.client
  state.client = null
  if (client) {
    await client.end()
  }
}
