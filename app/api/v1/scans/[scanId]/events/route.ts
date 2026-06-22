import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { errorResponse } from "@/lib/server/http/error-response";
import { getLatestScanEventId, listScanEvents } from "@/lib/server/scans/events-service";

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function parsePositiveInteger(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed > 0 && String(parsed) === value ? parsed : null;
}

export async function GET(request: Request, context: { params: Promise<{ scanId: string }> }) {
  try {
    const actor = await requireSessionOrBearerActor(request);
    const { scanId } = await context.params;
    const url = new URL(request.url);
    const lastEventIdHeader = parsePositiveInteger(request.headers.get("last-event-id"));
    const afterEventId = parsePositiveInteger(url.searchParams.get("after"));
    const initialLastEventId = lastEventIdHeader ?? afterEventId ?? 0;
    const latestEventId = await getLatestScanEventId(actor, scanId);

    if (latestEventId === null) {
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
          const events = await listScanEvents(actor, scanId, lastEventId);

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
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}
