import { type NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/session/app-session";
import { getTargetResults } from "@/lib/server/targets/service";

export async function GET(request: NextRequest) {
  const session = await requireAppSession();
  const response = await getTargetResults(session, request.nextUrl.searchParams);

  return NextResponse.json(response);
}
