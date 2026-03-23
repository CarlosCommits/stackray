import { NextResponse } from "next/server";

import { mockSearchResults } from "@/lib/mocks/scans";

export async function GET() {
  return NextResponse.json(mockSearchResults);
}
