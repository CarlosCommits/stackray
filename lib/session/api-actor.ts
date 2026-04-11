import type { NextRequest } from "next/server";

import { errorResponse } from "@/lib/server/http/error-response";
import { getActorContext, resolveBearerActor, type ActorContext, type SessionActorSource } from "@/lib/session/actor-context";

class ApiActorError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function parseBearerToken(authorizationHeader: string | null) {
  if (authorizationHeader === null) {
    return null;
  }

  const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token || rest.length > 0) {
    throw new ApiActorError(401, "invalid_authorization_header", "The Authorization header must use the Bearer scheme.");
  }

  return token;
}

export async function requireApiActor(
  request: Request | NextRequest,
  options: {
    sessionSource?: SessionActorSource;
    bearerSource?: SessionActorSource;
  } = {},
): Promise<ActorContext> {
  const bearerToken = parseBearerToken(request.headers.get("authorization"));

  if (bearerToken !== null) {
    const actor = await resolveBearerActor(bearerToken, options.bearerSource ?? "api");

    if (!actor) {
      throw new ApiActorError(401, "invalid_api_token", "The supplied API token is invalid or no longer active.");
    }

    return actor;
  }

  const actor = await getActorContext(options.sessionSource ?? "ui");

  if (!actor) {
    throw new ApiActorError(401, "unauthenticated", "Authentication is required.");
  }

  return actor;
}

export function apiActorErrorResponse(error: unknown) {
  if (!(error instanceof ApiActorError)) {
    return null;
  }

  return errorResponse(error.status, error.code, error.message);
}
