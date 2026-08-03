import { Client } from "pg"
import { getEnv } from "@/lib/env"
import { logger } from "@/lib/logger"

type ChangeHandler = () => void

interface ListenerState {
  client: Client | null
  handlers: Map<number, Set<ChangeHandler>>
  connectionPromise: Promise<void> | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
}

const channel = "todos_changed"
const reconnectDelayMs = 3_000

const globalScope = globalThis as unknown as { todosListener?: ListenerState }

function getListenerState(): ListenerState {
  if (!globalScope.todosListener) {
    globalScope.todosListener = {
      client: null,
      handlers: new Map(),
      connectionPromise: null,
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

  let payload: { userId?: unknown }
  try {
    payload = JSON.parse(rawPayload) as { userId?: unknown }
  } catch {
    logger.warn("ignoring malformed payload on todos_changed channel")
    return
  }

  const userId = payload.userId
  if (typeof userId !== "number") {
    return
  }

  const handlers = state.handlers.get(userId)
  if (!handlers) {
    return
  }

  for (const handler of handlers) {
    try {
      handler()
    } catch (error) {
      logger.error({ err: error }, "todo change handler failed")
    }
  }
}

async function endClient(client: Client): Promise<void> {
  try {
    await client.end()
  } catch {
    return
  }
}

function discardClient(state: ListenerState, client: Client): void {
  if (state.client === client) {
    state.client = null
  }
  void endClient(client)
}

function scheduleReconnect(state: ListenerState): void {
  if (state.reconnectTimer || state.handlers.size === 0) {
    return
  }
  state.reconnectTimer = setTimeout(async () => {
    state.reconnectTimer = null
    if (state.handlers.size === 0) {
      return
    }
    try {
      await ensureConnected(state)
    } catch (error) {
      logger.warn({ err: error }, "todos listener could not reconnect")
      scheduleReconnect(state)
    }
  }, reconnectDelayMs)
}

async function connect(state: ListenerState): Promise<void> {
  const client = new Client({ connectionString: getEnv().DATABASE_URL })

  const handleDisconnect = (error?: Error): void => {
    if (state.client !== client) {
      return
    }
    logger.error({ err: error }, "todos listener lost database connection")
    discardClient(state, client)
    scheduleReconnect(state)
  }

  try {
    await client.connect()
    client.on("notification", (message) =>
      handleNotification(state, message.payload),
    )
    client.on("error", handleDisconnect)
    client.on("end", () => handleDisconnect())
    await client.query(`listen ${channel}`)
    state.client = client
  } catch (error) {
    discardClient(state, client)
    throw error
  }
}

async function connectAndClear(state: ListenerState): Promise<void> {
  try {
    await connect(state)
  } finally {
    state.connectionPromise = null
  }
}

async function ensureConnected(state: ListenerState): Promise<void> {
  if (state.client) {
    return
  }
  if (!state.connectionPromise) {
    state.connectionPromise = connectAndClear(state)
  }
  await state.connectionPromise
}

function addHandler(
  state: ListenerState,
  userId: number,
  handler: ChangeHandler,
): void {
  const existing = state.handlers.get(userId)
  if (existing) {
    existing.add(handler)
    return
  }
  state.handlers.set(userId, new Set([handler]))
}

function removeHandler(
  state: ListenerState,
  userId: number,
  handler: ChangeHandler,
): void {
  const handlers = state.handlers.get(userId)
  if (!handlers) {
    return
  }
  handlers.delete(handler)
  if (handlers.size === 0) {
    state.handlers.delete(userId)
  }
}

export async function subscribeTodoChanges(
  userId: number,
  handler: ChangeHandler,
): Promise<() => void> {
  const state = getListenerState()
  addHandler(state, userId, handler)
  try {
    await ensureConnected(state)
  } catch (error) {
    removeHandler(state, userId, handler)
    throw error
  }
  return () => {
    removeHandler(state, userId, handler)
  }
}

export async function closeTodosListener(): Promise<void> {
  const state = getListenerState()
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }
  state.handlers.clear()

  try {
    await state.connectionPromise
  } catch {
    return
  }

  const client = state.client
  state.client = null
  if (client) {
    await client.end()
  }
}
