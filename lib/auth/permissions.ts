import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";

export const authAccessControl = createAccessControl(defaultStatements);

export const authRoles = {
  admin: adminAc,
  user: userAc,
  viewer: userAc,
} as const;

export type AppRole = keyof typeof authRoles;

export type AppPermission =
  | "users:manage"
  | "users:assign-admin"
  | "api-keys:manage"
  | "scans:create"
  | "scans:view"
  | "settings:view";

const permissionsByRole: Record<AppRole, ReadonlySet<AppPermission>> = {
  admin: new Set<AppPermission>([
    "users:manage",
    "users:assign-admin",
    "api-keys:manage",
    "scans:create",
    "scans:view",
    "settings:view",
  ]),
  user: new Set<AppPermission>([
    "scans:create",
    "scans:view",
    "settings:view",
  ]),
  viewer: new Set<AppPermission>([
    "scans:view",
    "settings:view",
  ]),
};

export function roleHasPermission(role: AppRole, permission: AppPermission) {
  return permissionsByRole[role].has(permission);
}

export function isAdminRole(role: string | null | undefined): role is "admin" {
  return role === "admin";
}
