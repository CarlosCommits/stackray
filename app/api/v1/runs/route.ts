import { type NextRequest, NextResponse } from "next/server";

import { listRuns } from "@/lib/queries/runs";

export async function GET(request: NextRequest) {
  const response = await listRuns(request.nextUrl.searchParams);

  return NextResponse.json(response);
}
