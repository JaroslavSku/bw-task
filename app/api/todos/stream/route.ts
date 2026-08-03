import { getCurrentUserId } from "@/lib/auth/currentUser";
import { subscribeTodoChanges } from "@/lib/realtime/todosListener";

export const dynamic = "force-dynamic";

const heartbeatIntervalMs = 25_000;

export async function GET(request: Request): Promise<Response> {
    const userId = await getCurrentUserId();
    if (!userId) {
        return new Response("unauthorized", { status: 401 });
    }

    const encoder = new TextEncoder();
    let unsubscribe: () => void = () => undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const stream = new ReadableStream({
        async start(controller) {
            const send = (chunk: string) => {
                try {
                    controller.enqueue(encoder.encode(chunk));
                } catch {
                    return;
                }
            };

            send("retry: 3000\n\n");

            unsubscribe = await subscribeTodoChanges(changedUserId => {
                if (changedUserId === userId) {
                    send("event: todos\ndata: changed\n\n");
                }
            });

            heartbeat = setInterval(() => send(": heartbeat\n\n"), heartbeatIntervalMs);

            request.signal.addEventListener("abort", () => {
                unsubscribe();
                if (heartbeat) {
                    clearInterval(heartbeat);
                }
                try {
                    controller.close();
                } catch {
                    return;
                }
            });
        },
        cancel() {
            unsubscribe();
            if (heartbeat) {
                clearInterval(heartbeat);
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}
