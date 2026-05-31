import type { NextRequest } from "next/server";

import { errorResponse } from "@/lib/server/http/error-response";
import { getActorContext, resolveBearerActor, type ActorContext, type SessionActorSource } from "@/lib/session/actor-context";

class ActorAuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function parseBearerApiKey(authorizationHeader: string | null) {
  if (authorizationHeader === null) {
    return null;
  }

  const [scheme, apiKey, ...rest] = authorizationHeader.trim().split(/\s+/);

  if (scheme !== "Bearer" || !apiKey || rest.length > 0) {
    throw new ActorAuthError(401, "invalid_authorization_header", "The Authorization header must use the Bearer scheme.");
  }

  return apiKey;
}

export async function requireSessionOrBearerActor(
  request: Request | NextRequest,
  options: {
    sessionSource?: SessionActorSource;
    bearerSource?: SessionActorSource;
  } = {},
): Promise<ActorContext> {
  const bearerApiKey = parseBearerApiKey(request.headers.get("authorization"));

  if (bearerApiKey !== null) {
    const actor = await resolveBearerActor(bearerApiKey, options.bearerSource ?? "api");

    if (!actor) {
      throw new ActorAuthError(401, "invalid_api_key", "The supplied API key is invalid or no longer active.");
    }

    return actor;
  }

  const actor = await getActorContext(options.sessionSource ?? "ui");

  if (!actor) {
    throw new ActorAuthError(401, "unauthenticated", "Authentication is required.");
  }

  return actor;
}

export function actorAuthErrorResponse(error: unknown) {
  if (!(error instanceof ActorAuthError)) {
    return null;
  }

  return errorResponse(error.status, error.code, error.message);
}
