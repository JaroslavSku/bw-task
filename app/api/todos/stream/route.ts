import { getCurrentUserId } from "@/lib/auth/currentUser"
import { handleRoute } from "@/lib/http"
import { logger } from "@/lib/logger"
import { subscribeTodoChanges } from "@/lib/realtime/todosListener"

export const dynamic = "force-dynamic"

const heartbeatIntervalMs = 25_000

export function GET(request: Request): Promise<Response> {
  return handleRoute(async () => {
    const userId = await getCurrentUserId()
    if (!userId) {
      return new Response("unauthorized", { status: 401 })
    }

    const encoder = new TextEncoder()
    let unsubscribe: () => void = () => undefined
    let heartbeat: ReturnType<typeof setInterval> | undefined

    const cleanup = () => {
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
          try {
            controller.enqueue(encoder.encode(chunk))
          } catch {
            return
          }
        }

        const close = () => {
          cleanup()
          try {
            controller.close()
          } catch {
            return
          }
        }

        send("retry: 3000\n\n")

        try {
          unsubscribe = await subscribeTodoChanges((changedUserId) => {
            if (changedUserId === userId) {
              send("event: todos\ndata: changed\n\n")
            }
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

        request.signal.addEventListener("abort", close)
      },
      cancel() {
        cleanup()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    })
  })
}
