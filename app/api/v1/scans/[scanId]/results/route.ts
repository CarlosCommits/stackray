import { NextResponse } from "next/server";

import { mockScanResults } from "@/lib/mocks/scans";

export async function GET(_: Request, context: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await context.params;

  return NextResponse.json({
    ...mockScanResults,
    items: mockScanResults.items.map((item) => ({
      ...item,
      resultId: item.resultId.replace("demo", scanId),
    })),
  });
}
