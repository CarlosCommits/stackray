import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Activity,
  BadgeCheck,
  FileDiff,
  FileType2,
  Fingerprint,
  Gauge,
  Image,
  Layers,
  ListTree,
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
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";

import {
  CHANGE_TYPE_VISUALS,
  type ChangeTypeIconName,
} from "../lib/changes/change-visuals.ts";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = dirname(scriptDirectory);
const assetDirectory = join(rootDirectory, "public", "email-assets");
const iconDirectory = join(assetDirectory, "change-icons");

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

await mkdir(iconDirectory, { recursive: true });

await Promise.all([
  sharp(join(rootDirectory, "public", "stackray-logo-rendered.webp"))
    .resize(96, 96)
    .png({ compressionLevel: 9 })
    .toFile(join(assetDirectory, "stackray-mark.png")),
  copyFile(
    join(rootDirectory, "node_modules", "geist", "dist", "fonts", "geist-sans", "Geist-Regular.woff2"),
    join(assetDirectory, "geist-regular.woff2"),
  ),
  copyFile(
    join(rootDirectory, "node_modules", "geist", "dist", "fonts", "geist-sans", "Geist-SemiBold.woff2"),
    join(assetDirectory, "geist-semibold.woff2"),
  ),
]);

const visualsByIconName = new Map<ChangeTypeIconName, (typeof CHANGE_TYPE_VISUALS)[keyof typeof CHANGE_TYPE_VISUALS]>();
for (const visual of Object.values(CHANGE_TYPE_VISUALS)) {
  visualsByIconName.set(visual.iconName, visual);
}

await Promise.all(Array.from(visualsByIconName, async ([iconName, visual]) => {
  const Icon = iconByName[iconName];
  const iconMarkup = renderToStaticMarkup(createElement(Icon, {
    x: 16,
    y: 16,
    width: 32,
    height: 32,
    color: visual.emailColor,
    strokeWidth: 2,
  }));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${visual.emailSurface}"/>${iconMarkup}</svg>`;

  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(join(iconDirectory, `${iconName}.png`));
}));
