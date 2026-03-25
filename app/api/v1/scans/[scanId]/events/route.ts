import { requireAppSession } from "@/lib/auth/session";
import { errorResponse } from "@/lib/server/http/error-response";
import { listScanEvents } from "@/lib/server/scans/events-service";

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function GET(request: Request, context: { params: Promise<{ scanId: string }> }) {
  const session = await requireAppSession();
  const { scanId } = await context.params;
  const lastEventIdHeader = request.headers.get("last-event-id");
  const initialLastEventId = lastEventIdHeader ? Number.parseInt(lastEventIdHeader, 10) : 0;
  const existingEvents = await listScanEvents(session, scanId, 0);

  if (existingEvents === null) {
    return errorResponse(404, "scan_not_found", "The requested scan could not be found.");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastEventId = Number.isInteger(initialLastEventId) && initialLastEventId > 0 ? initialLastEventId : 0;
      let closed = false;

      request.signal.addEventListener("abort", () => {
        closed = true;
      });

      while (!closed) {
        const events = await listScanEvents(session, scanId, lastEventId);

        if (events === null) {
          controller.close();
          return;
        }

        for (const event of events) {
          lastEventId = event.id;
          controller.enqueue(
            encoder.encode(
              `id: ${event.id}\nevent: ${event.envelope.event}\ndata: ${JSON.stringify(event.envelope)}\n\n`,
            ),
          );

          if (event.terminal) {
            controller.close();
            return;
          }
        }

        await sleep(1000);
      }

      controller.close();
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
