import { type NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/auth/session";
import { getWorkspaceSearchResults } from "@/lib/server/search/service";

export async function GET(request: NextRequest) {
  const session = await requireAppSession();
  const response = await getWorkspaceSearchResults(session, request.nextUrl.searchParams);

  return NextResponse.json(response);
}
