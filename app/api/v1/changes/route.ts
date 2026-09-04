import { NextResponse } from "next/server";

import { changeCategorySchema, changeFeedQuerySchema } from "@/lib/contracts/changes";
import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { listChangeFeed } from "@/lib/server/changes/service";
import { errorResponse } from "@/lib/server/http/error-response";

export async function GET(request: Request) {
  try {
    const actor = await requireSessionOrBearerActor(request);
    const url = new URL(request.url);
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "30", 10);
    const rawCategory = changeCategorySchema.safeParse(url.searchParams.get("category"));
    const query = changeFeedQuerySchema.parse({
      cursor: url.searchParams.get("cursor"),
      limit: Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 30,
      category: rawCategory.success ? rawCategory.data : null,
      target: url.searchParams.get("target")?.trim() || null,
    });

    return NextResponse.json(await listChangeFeed(actor, query));
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(400, "changes_list_failed", error instanceof Error ? error.message : "Unable to list changes.");
  }
}
