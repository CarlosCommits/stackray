import { NextResponse } from "next/server";

import { createScanRequestSchema } from "@/lib/contracts/scans";
import { mockCreateScanResponse, mockScanList } from "@/lib/mocks/scans";

export async function GET() {
  return NextResponse.json(mockScanList);
}

export async function POST(request: Request) {
  const payload = await request.json();
  const parsed = createScanRequestSchema.parse(payload);

  return NextResponse.json({
    ...mockCreateScanResponse,
    submittedTargetCount: parsed.targets.length,
  });
}
