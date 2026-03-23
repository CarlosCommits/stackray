import { NextResponse } from "next/server";

import { mockScanDetail } from "@/lib/mocks/scans";

export async function GET(_: Request, context: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await context.params;

  return NextResponse.json({
    ...mockScanDetail,
    scanId,
  });
}
