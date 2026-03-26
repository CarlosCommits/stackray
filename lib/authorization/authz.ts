import type { ActorContext } from "@/lib/session/actor-context";
import { roleHasPermission, type AppPermission } from "@/lib/auth/permissions";

export function isAdmin(actor: ActorContext) {
  return roleHasPermission(actor.user.role, "users:assign-admin");
}

export function hasPermission(actor: ActorContext, permission: AppPermission) {
  return roleHasPermission(actor.user.role, permission);
}

export function canManageUsers(actor: ActorContext) {
  return hasPermission(actor, "users:manage");
}

export function canManageTokens(actor: ActorContext) {
  return hasPermission(actor, "tokens:manage");
}

export function canRunScans(actor: ActorContext) {
  return hasPermission(actor, "scans:create");
}

export function canViewScans(actor: ActorContext) {
  return hasPermission(actor, "scans:view");
}

export function canEditUserRole(actor: ActorContext, targetRole: ActorContext["user"]["role"]) {
  if (!canManageUsers(actor)) {
    return false;
  }

  if (targetRole === "admin") {
    return hasPermission(actor, "users:assign-admin");
  }

  return true;
}
