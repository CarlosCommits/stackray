import {
  getActorContext,
  requireActorContext,
  type ActorContext,
  type SessionActorSource,
} from "@/lib/server/actor-context";

export type AppSession = ActorContext;

export async function getAppSession(): Promise<AppSession | null> {
  return getActorContext("ui");
}

export async function requireAppSession(): Promise<AppSession> {
  return requireActorContext("ui");
}
