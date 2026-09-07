import type { ActorContext } from "../session/actor-context.ts";
import { roleHasPermission, type AppPermission } from "../auth/permissions.ts";

export function isAdmin(actor: ActorContext) {
  return roleHasPermission(actor.user.role, "users:assign-admin");
}

function hasPermission(actor: ActorContext, permission: AppPermission) {
  return roleHasPermission(actor.user.role, permission);
}

export function canManageUsers(actor: ActorContext) {
  return hasPermission(actor, "users:manage");
}

export function canAccessApiKeys(actor: ActorContext) {
  return isAdmin(actor) || actor.apiKeyAccessEnabled;
}

export function canManageAlerts(actor: ActorContext) {
  return hasPermission(actor, "alerts:manage");
}

export function canViewAlertDeliveries(actor: ActorContext) {
  return hasPermission(actor, "alerts:view-deliveries");
}

export function canManageBaselines(actor: ActorContext) {
  return hasPermission(actor, "baselines:manage");
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
