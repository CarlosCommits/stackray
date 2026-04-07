import { NextResponse } from "next/server";

import { requireAppSession } from "@/lib/session/app-session";
import { errorResponse } from "@/lib/server/http/error-response";
import { deleteApiToken } from "@/lib/server/tokens/service";

export async function DELETE(_: Request, context: { params: Promise<{ tokenId: string }> }) {
  try {
    const session = await requireAppSession();
    const { tokenId } = await context.params;
    const response = await deleteApiToken(session, tokenId);

    return NextResponse.json(response);
  } catch (error) {
    return errorResponse(403, "token_delete_failed", error instanceof Error ? error.message : "Unable to delete API token.");
  }
}
