import { Client } from "pg";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

type ChangeHandler = (userId: number) => void;

interface ListenerState {
    client: Client | null;
    handlers: Set<ChangeHandler>;
    connecting: boolean;
}

const globalScope = globalThis as unknown as { todosListener?: ListenerState };

function getListenerState(): ListenerState {
    if (!globalScope.todosListener) {
        globalScope.todosListener = { client: null, handlers: new Set(), connecting: false };
    }
    return globalScope.todosListener;
}

function handleNotification(state: ListenerState, rawPayload: string | undefined): void {
    if (!rawPayload) {
        return;
    }
    try {
        const payload = JSON.parse(rawPayload) as { userId?: number };
        if (typeof payload.userId === "number") {
            for (const handler of state.handlers) {
                handler(payload.userId);
            }
        }
    } catch {
        logger.warn("ignoring malformed payload on todos_changed channel");
    }
}

async function ensureConnected(state: ListenerState): Promise<void> {
    if (state.client || state.connecting) {
        return;
    }
    state.connecting = true;
    try {
        const client = new Client({ connectionString: getEnv().DATABASE_URL });
        await client.connect();
        client.on("notification", message => handleNotification(state, message.payload));
        client.on("error", error => {
            logger.error({ err: error }, "todos listener lost database connection");
            state.client = null;
            client.end().catch(() => undefined);
            setTimeout(() => {
                if (state.handlers.size > 0) {
                    ensureConnected(state).catch(() => undefined);
                }
            }, 3_000);
        });
        await client.query("listen todos_changed");
        state.client = client;
    } finally {
        state.connecting = false;
    }
}

export async function subscribeTodoChanges(handler: ChangeHandler): Promise<() => void> {
    const state = getListenerState();
    state.handlers.add(handler);
    await ensureConnected(state);
    return () => {
        state.handlers.delete(handler);
    };
}
