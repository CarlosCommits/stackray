import { mockScanEvents } from "@/lib/mocks/scans";

export async function GET(_: Request, context: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await context.params;

  const stream = new ReadableStream({
    start(controller) {
      for (const event of mockScanEvents) {
        const payload = JSON.stringify({
          ...event,
          data: {
            ...event.data,
            scanId,
          },
        });

        controller.enqueue(new TextEncoder().encode(`event: ${event.event}\ndata: ${payload}\n\n`));
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
