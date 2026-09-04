"use client";

import { useState, type Ref } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import {
  ChangeTypeIcon,
  getChangeDescription,
  getChangePreview,
  getChangeTitle,
} from "@/components/changes/change-presentation";
import { ChangeEvidence } from "@/components/changes/change-summary";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ScanComparison } from "@/lib/contracts/changes";

function initialItemIndex(comparison: ScanComparison, initialItemId?: string | null) {
  if (!initialItemId) return 0;
  const index = comparison.items.findIndex((item) => item.id === initialItemId);
  return index >= 0 ? index : 0;
}

const ADDED_REMOVED_CHANGE_TYPES = new Set([
  "dns.a_changed",
  "dns.aaaa_changed",
  "dns.cname_changed",
  "technology.changed",
  "cpe.changed",
]);

const DESCRIPTION_IS_SUBTITLE_CHANGE_TYPES = new Set([
  ...ADDED_REMOVED_CHANGE_TYPES,
  "body_fingerprint.changed",
  "favicon.changed",
  "favicon_location.changed",
  "metadata.capabilities_changed",
  "metadata.content_type_changed",
  "tls.certificate_changed",
  "tls.jarm_changed",
]);

function stringCount(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string").length
    : 0;
}

function addedRemovedSubtitle(item: ScanComparison["items"][number]) {
  const before = item.before && typeof item.before === "object" && !Array.isArray(item.before)
    ? item.before as Record<string, unknown>
    : {};
  const after = item.after && typeof item.after === "object" && !Array.isArray(item.after)
    ? item.after as Record<string, unknown>
    : {};

  return `${stringCount(after.added)} added · ${stringCount(before.removed)} removed`;
}

function inspectorSubtitle(item: ScanComparison["items"][number], target: string) {
  if (ADDED_REMOVED_CHANGE_TYPES.has(item.changeType)) {
    return addedRemovedSubtitle(item);
  }

  if (item.changeType === "tls.jarm_changed") {
    return getChangeDescription(item);
  }

  return getChangePreview(item, target);
}

export function ChangeInspector({
  comparison,
  initialItemId,
  headingRef,
}: {
  comparison: ScanComparison;
  initialItemId?: string | null;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const [selectedIndex, setSelectedIndex] = useState(() => initialItemIndex(comparison, initialItemId));
  const selectedItem = comparison.items[selectedIndex];

  if (!selectedItem) return null;

  const preview = inspectorSubtitle(selectedItem, comparison.currentScan.target);
  const descriptionIsSubtitle = DESCRIPTION_IS_SUBTITLE_CHANGE_TYPES.has(selectedItem.changeType);
  const hasPrevious = selectedIndex > 0;
  const hasNext = selectedIndex < comparison.items.length - 1;

  return (
    <article className="flex min-h-0 flex-1 flex-col bg-card" aria-labelledby={`change-detail-${selectedItem.id}`}>
      <header className="border-b border-border/35 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start gap-4 sm:gap-5">
          <ChangeTypeIcon changeType={selectedItem.changeType} className="mt-0.5 size-11 shrink-0 sm:size-14" />
          <div className="min-w-0 flex-1">
            <h3
              ref={headingRef}
              id={`change-detail-${selectedItem.id}`}
              tabIndex={-1}
              className="rounded-sm font-heading text-lg font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              {getChangeTitle(selectedItem)}
            </h3>
            {preview ? <p className="mt-1 break-words text-sm text-muted-foreground">{preview}</p> : null}
          </div>
        </div>
        {!descriptionIsSubtitle ? (
          <p className="mt-4 max-w-3xl text-xs leading-5 text-muted-foreground">
            {getChangeDescription(selectedItem)}
          </p>
        ) : null}
      </header>

      <ScrollArea
        key={selectedItem.id}
        className="min-h-0 flex-1"
        viewportClassName="focus-visible:ring-inset"
        scrollBarClassName="w-3"
        scrollThumbClassName="bg-muted-foreground/45"
      >
        <div className="p-4 sm:p-6">
          <ChangeEvidence item={selectedItem} />
        </div>
      </ScrollArea>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3 sm:px-6">
        <p className="font-mono text-[10px] text-muted-foreground">
          {selectedIndex + 1} of {comparison.items.length}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasPrevious}
            aria-label="Previous change"
            onClick={() => setSelectedIndex((index) => Math.max(0, index - 1))}
          >
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasNext}
            aria-label="Next change"
            onClick={() => setSelectedIndex((index) => Math.min(comparison.items.length - 1, index + 1))}
          >
            Next
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        </div>
      </footer>
    </article>
  );
}
