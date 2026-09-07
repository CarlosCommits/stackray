import type { KnownChangeType } from "./change-types.ts";

export type ChangeTypeIconName =
  | "activity"
  | "badge-check"
  | "file-diff"
  | "file-type-2"
  | "fingerprint"
  | "gauge"
  | "image"
  | "layers"
  | "list-tree"
  | "locate-fixed"
  | "map-pin"
  | "network"
  | "route"
  | "server"
  | "shield-check"
  | "signpost"
  | "tags"
  | "text-cursor-input"
  | "waypoints";

export type ChangeTypeVisual = {
  iconName: ChangeTypeIconName;
  textClass: string;
  surfaceClass: string;
  emailColor: string;
  emailSurface: string;
};

const DEFAULT_CHANGE_TYPE_VISUAL = {
  iconName: "file-diff",
  textClass: "text-muted-foreground",
  surfaceClass: "bg-muted/40",
  emailColor: "#596170",
  emailSurface: "#f3f4f6",
} as const satisfies ChangeTypeVisual;

export const CHANGE_TYPE_VISUALS = {
  "status.changed": {
    iconName: "activity",
    textClass: "text-orange-400",
    surfaceClass: "bg-orange-400/10",
    emailColor: "#c2410c",
    emailSurface: "#fff4e8",
  },
  "redirect.changed": {
    iconName: "route",
    textClass: "text-amber-400",
    surfaceClass: "bg-amber-400/10",
    emailColor: "#a16207",
    emailSurface: "#fff8e1",
  },
  "body_fingerprint.changed": {
    iconName: "file-diff",
    textClass: "text-violet-400",
    surfaceClass: "bg-violet-400/10",
    emailColor: "#7c3aed",
    emailSurface: "#f5f3ff",
  },
  "response_headers.changed": {
    iconName: "list-tree",
    textClass: "text-orange-400",
    surfaceClass: "bg-orange-400/10",
    emailColor: "#c2410c",
    emailSurface: "#fff4e8",
  },
  "favicon.changed": {
    iconName: "image",
    textClass: "text-pink-400",
    surfaceClass: "bg-pink-400/10",
    emailColor: "#be185d",
    emailSurface: "#fdf2f8",
  },
  "favicon_location.changed": {
    iconName: "map-pin",
    textClass: "text-sky-400",
    surfaceClass: "bg-sky-400/10",
    emailColor: "#0369a1",
    emailSurface: "#f0f9ff",
  },
  "dns.host_ip_changed": {
    iconName: "locate-fixed",
    textClass: "text-cyan-400",
    surfaceClass: "bg-cyan-400/10",
    emailColor: "#0e7490",
    emailSurface: "#ecfeff",
  },
  "dns.a_changed": {
    iconName: "network",
    textClass: "text-blue-400",
    surfaceClass: "bg-blue-400/10",
    emailColor: "#1d4ed8",
    emailSurface: "#eff6ff",
  },
  "dns.aaaa_changed": {
    iconName: "waypoints",
    textClass: "text-indigo-400",
    surfaceClass: "bg-indigo-400/10",
    emailColor: "#4338ca",
    emailSurface: "#eef2ff",
  },
  "dns.cname_changed": {
    iconName: "signpost",
    textClass: "text-teal-400",
    surfaceClass: "bg-teal-400/10",
    emailColor: "#0f766e",
    emailSurface: "#f0fdfa",
  },
  "tls.certificate_changed": {
    iconName: "badge-check",
    textClass: "text-emerald-400",
    surfaceClass: "bg-emerald-400/10",
    emailColor: "#047857",
    emailSurface: "#ecfdf5",
  },
  "tls.jarm_changed": {
    iconName: "fingerprint",
    textClass: "text-purple-400",
    surfaceClass: "bg-purple-400/10",
    emailColor: "#7e22ce",
    emailSurface: "#faf5ff",
  },
  "technology.changed": {
    iconName: "layers",
    textClass: "text-fuchsia-400",
    surfaceClass: "bg-fuchsia-400/10",
    emailColor: "#a21caf",
    emailSurface: "#fdf4ff",
  },
  "cpe.changed": {
    iconName: "tags",
    textClass: "text-violet-400",
    surfaceClass: "bg-violet-400/10",
    emailColor: "#7c3aed",
    emailSurface: "#f5f3ff",
  },
  "metadata.title_changed": {
    iconName: "text-cursor-input",
    textClass: "text-sky-400",
    surfaceClass: "bg-sky-400/10",
    emailColor: "#0369a1",
    emailSurface: "#f0f9ff",
  },
  "metadata.server_changed": {
    iconName: "server",
    textClass: "text-indigo-400",
    surfaceClass: "bg-indigo-400/10",
    emailColor: "#4338ca",
    emailSurface: "#eef2ff",
  },
  "metadata.content_type_changed": {
    iconName: "file-type-2",
    textClass: "text-teal-400",
    surfaceClass: "bg-teal-400/10",
    emailColor: "#0f766e",
    emailSurface: "#f0fdfa",
  },
  "metadata.cdn_changed": {
    iconName: "shield-check",
    textClass: "text-orange-400",
    surfaceClass: "bg-orange-400/10",
    emailColor: "#c2410c",
    emailSurface: "#fff4e8",
  },
  "metadata.capabilities_changed": {
    iconName: "gauge",
    textClass: "text-cyan-400",
    surfaceClass: "bg-cyan-400/10",
    emailColor: "#0e7490",
    emailSurface: "#ecfeff",
  },
} as const satisfies Record<KnownChangeType, ChangeTypeVisual>;

export function getChangeTypeVisual(changeType: string): ChangeTypeVisual {
  return CHANGE_TYPE_VISUALS[changeType as KnownChangeType]
    ?? DEFAULT_CHANGE_TYPE_VISUAL;
}

export function getEmailChangeIconFilename(changeType: string) {
  return `${getChangeTypeVisual(changeType).iconName}.png`;
}
