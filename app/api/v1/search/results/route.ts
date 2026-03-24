import { type NextRequest, NextResponse } from "next/server";

import { getSearchResults } from "@/lib/queries/search";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const response = getSearchResults(searchParams);

  return NextResponse.json(response);
}
