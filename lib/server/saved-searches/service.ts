import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { savedSearches } from "@/lib/db/schema";
import type { ActorContext } from "@/lib/server/actor-context";
import type { SavedSearchRow } from "@/components/saved-searches/types";

export interface SavedSearchDraft {
  name: string;
  queryDescription: string;
  pinned?: boolean;
}

function extractQueryDescription(query: Record<string, unknown>): string {
  return typeof query.description === "string" ? query.description : "";
}

function toSavedSearchRow(row: typeof savedSearches.$inferSelect): SavedSearchRow {
  return {
    id: row.id,
    name: row.name,
    pinned: row.pinned,
    queryDescription: extractQueryDescription(row.query),
  };
}

export async function listSavedSearches(actor: ActorContext): Promise<SavedSearchRow[]> {
  const rows = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.createdByUserId, actor.user.id))
    .orderBy(asc(savedSearches.name));

  return rows
    .map(toSavedSearchRow)
    .sort((left, right) => {
      if (left.pinned !== right.pinned) {
        return left.pinned ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}

export async function createSavedSearch(actor: ActorContext, draft: SavedSearchDraft): Promise<SavedSearchRow> {
  const [created] = await db
    .insert(savedSearches)
    .values({
      createdByUserId: actor.user.id,
      name: draft.name,
      pinned: draft.pinned ?? false,
      query: {
        description: draft.queryDescription,
      },
    })
    .returning();

  return toSavedSearchRow(created);
}

export async function updateSavedSearch(
  actor: ActorContext,
  savedSearchId: string,
  patch: Partial<SavedSearchDraft>,
): Promise<SavedSearchRow | null> {
  const existing = await db
    .select()
    .from(savedSearches)
    .where(and(eq(savedSearches.id, savedSearchId), eq(savedSearches.createdByUserId, actor.user.id)))
    .limit(1);

  const row = existing[0];

  if (!row) {
    return null;
  }

  const [updated] = await db
    .update(savedSearches)
    .set({
      name: patch.name ?? row.name,
      pinned: patch.pinned ?? row.pinned,
      query: {
        ...(row.query ?? {}),
        ...(patch.queryDescription ? { description: patch.queryDescription } : {}),
      },
      updatedAt: new Date(),
    })
    .where(eq(savedSearches.id, row.id))
    .returning();

  return toSavedSearchRow(updated);
}

export async function deleteSavedSearch(actor: ActorContext, savedSearchId: string): Promise<boolean> {
  const deleted = await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, savedSearchId), eq(savedSearches.createdByUserId, actor.user.id)))
    .returning({ id: savedSearches.id });

  return deleted.length > 0;
}
