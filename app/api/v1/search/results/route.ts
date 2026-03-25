import { type NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/auth/session";
import { getSearchResults } from "@/lib/server/search/service";

export async function GET(request: NextRequest) {
  const session = await requireAppSession();
  const response = await getSearchResults(session, request.nextUrl.searchParams);

  return NextResponse.json(response);
}
