import { NextRequest } from "next/server";
import { subscribeChatDeletions, subscribeChatMessages } from "@/lib/chat-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function frame(event: string, value: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
}

export async function GET(req: NextRequest) {
  let cleanup = () => {};
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const unsubscribe = subscribeChatMessages((message) => {
        try { controller.enqueue(frame("chat", message)); } catch { /* cliente fechou */ }
      });
      const unsubscribeDelete = subscribeChatDeletions((message) => {
        try { controller.enqueue(frame("chat-delete", message)); } catch { /* cliente fechou */ }
      });

      keepalive = setInterval(() => {
        try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { /* cliente fechou */ }
      }, 25_000);

      cleanup = () => {
        unsubscribe();
        unsubscribeDelete();
        if (keepalive) clearInterval(keepalive);
        keepalive = null;
        try { controller.close(); } catch { /* noop */ }
      };

      req.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
