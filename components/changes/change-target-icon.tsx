"use client";

import { useState } from "react";
import { Globe2 } from "lucide-react";

import { resolveFaviconPreviewSrc } from "@/lib/favicon";

export function ChangeTargetIcon({
  faviconUrl,
  size = "default",
}: {
  faviconUrl: string | null;
  size?: "default" | "large";
}) {
  const [faviconHidden, setFaviconHidden] = useState(false);
  const faviconPreviewSrc = faviconHidden ? null : resolveFaviconPreviewSrc(faviconUrl);
  const containerClassName = size === "large" ? "size-12" : "size-7";
  const imageClassName = size === "large" ? "size-8" : "size-4";
  const fallbackClassName = size === "large" ? "size-6" : "size-3.5";

  return (
    <span className={`flex ${containerClassName} shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted`}>
      {faviconPreviewSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews intentionally use the shared proxy/fallback behavior
        <img
          src={faviconPreviewSrc}
          alt=""
          className={`${imageClassName} object-contain`}
          onError={() => setFaviconHidden(true)}
        />
      ) : (
        <Globe2 className={`${fallbackClassName} text-[var(--accent)]`} aria-hidden="true" />
      )}
    </span>
  );
}
