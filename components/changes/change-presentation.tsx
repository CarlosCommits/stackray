import {
  Activity,
  BadgeCheck,
  FileDiff,
  FileType2,
  Fingerprint,
  Gauge,
  Image,
  ListTree,
  Layers,
  LocateFixed,
  MapPin,
  Network,
  Route,
  Server,
  ShieldCheck,
  Signpost,
  Tags,
  TextCursorInput,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import type { ScanChangeItem } from "@/lib/contracts/changes";
import { getChangeTypeDefinition } from "@/lib/changes/change-types";
import {
  getChangeTypeVisual,
  type ChangeTypeIconName,
} from "@/lib/changes/change-visuals";
import { cn } from "@/lib/utils";

export {
  formatEndpointForDisplay,
  getChangePreview,
} from "@/lib/changes/change-preview";

const iconByName: Record<ChangeTypeIconName, LucideIcon> = {
  activity: Activity,
  "badge-check": BadgeCheck,
  "file-diff": FileDiff,
  "file-type-2": FileType2,
  fingerprint: Fingerprint,
  gauge: Gauge,
  image: Image,
  layers: Layers,
  "list-tree": ListTree,
  "locate-fixed": LocateFixed,
  "map-pin": MapPin,
  network: Network,
  route: Route,
  server: Server,
  "shield-check": ShieldCheck,
  signpost: Signpost,
  tags: Tags,
  "text-cursor-input": TextCursorInput,
  waypoints: Waypoints,
};

export function getChangeTitle(item: Pick<ScanChangeItem, "changeType" | "summary">) {
  return getChangeTypeDefinition(item.changeType)?.label ?? item.summary;
}

export function getChangeDescription(item: Pick<ScanChangeItem, "changeType">) {
  return getChangeTypeDefinition(item.changeType)?.description
    ?? "Persisted scan evidence differs from the selected baseline.";
}

export function ChangeTypeIcon({ changeType, className }: { changeType: string; className?: string }) {
  const visual = getChangeTypeVisual(changeType);
  const Icon = iconByName[visual.iconName];
  return <Icon className={cn(visual.textClass, className)} aria-hidden="true" />;
}

export function getChangeTypeIconSurfaceClass(changeType: string) {
  return getChangeTypeVisual(changeType).surfaceClass;
}
