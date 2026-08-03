import { getCurrentUserId } from "@/lib/auth/currentUser"
import { handleRoute } from "@/lib/http"
import { logger } from "@/lib/logger"
import { subscribeTodoChanges } from "@/lib/realtime/todosListener"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const heartbeatIntervalMs = 25_000
const reconnectDelayMs = 3_000
const encoder = new TextEncoder()

export function GET(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const userId = await getCurrentUserId()
    if (!userId) {
      return new Response("unauthorized", { status: 401 })
    }

    let unsubscribe: () => void = () => undefined
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let closed = false

    const cleanup = () => {
      closed = true
      unsubscribe()
      unsubscribe = () => undefined
      if (heartbeat) {
        clearInterval(heartbeat)
        heartbeat = undefined
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (chunk: string) => {
          if (closed) {
            return
          }
          try {
            controller.enqueue(encoder.encode(chunk))
          } catch {
            cleanup()
          }
        }

        const close = () => {
          if (closed) {
            return
          }
          cleanup()
          try {
            controller.close()
          } catch {
            return
          }
        }

        send(`retry: ${reconnectDelayMs}\n\n`)

        try {
          unsubscribe = await subscribeTodoChanges(userId, () => {
            send("event: todos\ndata: changed\n\n")
          })
        } catch (error) {
          logger.error({ err: error }, "could not subscribe to todo changes")
          close()
          return
        }

        if (request.signal.aborted) {
          close()
          return
        }

        heartbeat = setInterval(
          () => send(": heartbeat\n\n"),
          heartbeatIntervalMs,
        )

        request.signal.addEventListener("abort", close, { once: true })
      },
      cancel() {
        cleanup()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    })
  })
}
