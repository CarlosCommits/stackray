import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleMinus,
  CirclePlus,
  Info,
  Server,
} from "lucide-react";

import { CopyFingerprintButton } from "@/components/changes/copy-fingerprint-button";
import { ChangeTypeIcon, getChangeTitle, getChangeTypeIconSurfaceClass } from "@/components/changes/change-presentation";
import { ChangeTransition } from "@/components/changes/change-transition";
import { HeaderValueCell } from "@/components/changes/header-value-cell";
import { SetCookieEvidence } from "@/components/changes/set-cookie-evidence";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { LocalTime } from "@/components/ui/local-time";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ChangeCategory, ScanChangeItem, ScanComparison } from "@/lib/contracts/changes";
import { isIgnoredResponseHeader } from "@/lib/changes/response-headers";
import { getHttpResponseClass, getHttpStatusText } from "@/lib/http-status";
import { formatTargetForDisplay } from "@/lib/targets/display-target";
import { cn } from "@/lib/utils";

export const changeCategoryLabels: Record<ChangeCategory, string> = {
  availability: "Availability",
  content: "Content",
  infrastructure: "Infrastructure",
  tls: "TLS",
  technology: "Technology",
  discovery: "Discovery",
  security: "Security",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.flatMap((entry) => typeof entry === "string" ? [entry] : []) : [];
}

function humanizeKey(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function EvidenceValue({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground">Not present</span>;
  }

  if (typeof value === "boolean") {
    return <span>{value ? "Enabled" : "Disabled"}</span>;
  }

  if (typeof value === "string" || typeof value === "number") {
    return <code className="break-all font-mono text-xs text-foreground">{String(value)}</code>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">None</span>;
    }

    return (
      <ul className="flex flex-col gap-1">
        {value.map((entry, index) => (
          <li key={`${String(entry)}-${index}`} className="break-all font-mono text-xs text-foreground">
            {typeof entry === "object" ? <EvidenceValue value={entry} /> : String(entry)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <dl className="flex flex-col gap-2">
      {Object.entries(value).map(([key, entry]) => (
        <div key={key} className="grid gap-0.5 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
          <dt className="text-xs text-muted-foreground">{humanizeKey(key)}</dt>
          <dd className="min-w-0"><EvidenceValue value={entry} /></dd>
        </div>
      ))}
    </dl>
  );
}

function EvidencePair({ before, after }: Pick<ScanChangeItem, "before" | "after">) {
  return (
    <div className="grid overflow-hidden rounded-lg bg-muted/25 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
      <div className="min-w-0 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Before</p>
        <EvidenceValue value={before} />
      </div>
      <Separator className="md:hidden" />
      <Separator orientation="vertical" className="hidden md:block" />
      <div className="min-w-0 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">After</p>
        <EvidenceValue value={after} />
      </div>
    </div>
  );
}

function FingerprintEvidence({ item }: { item: ScanChangeItem }) {
  const before = isRecord(item.before) ? item.before : null;
  const after = isRecord(item.after) ? item.after : null;
  const algorithm = typeof after?.algorithm === "string"
    ? after.algorithm
    : typeof before?.algorithm === "string" ? before.algorithm : "stored";
  const beforeValue = item.changeType === "body_fingerprint.changed" ? before?.hashes : before?.value;
  const afterValue = item.changeType === "body_fingerprint.changed" ? after?.hashes : after?.value;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid overflow-hidden rounded-lg bg-muted/25 sm:grid-cols-2 sm:divide-x sm:divide-border">
        <div className="p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Before {algorithm}</p>
          <EvidenceValue value={beforeValue ?? item.before} />
        </div>
        <div className="border-t border-border p-3 sm:border-t-0">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">After {algorithm}</p>
          <EvidenceValue value={afterValue ?? item.after} />
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Stackray stores the fingerprint used for comparison, not the response body itself.
      </p>
    </div>
  );
}

const BODY_FINGERPRINT_DEFINITIONS = [
  { key: "simhash", label: "SimHash" },
] as const;

function fingerprintRecord(value: unknown) {
  if (!isRecord(value)) return new Map<string, string>();

  return new Map(Object.entries(value).flatMap(([key, entry]) => (
    typeof entry === "string" && entry.length > 0
      ? [[key.toLowerCase().replace(/[^a-z0-9]/g, ""), entry] as const]
      : []
  )));
}

function fingerprintValue(values: ReadonlyMap<string, string>, key: string) {
  return values.get(`body${key}`) ?? values.get(key) ?? null;
}

function shortenFingerprint(value: string) {
  if (value.length <= 25) return value;
  return `${value.slice(0, 14)}…${value.slice(-10)}`;
}

function FingerprintCell({
  value,
  label,
  current = false,
  currentTone = "violet",
  missingLabel = "Not present",
}: {
  value: string | null;
  label: string;
  current?: boolean;
  currentTone?: FingerprintTone;
  missingLabel?: string;
}) {
  if (!value) {
    return <span className="text-xs text-muted-foreground">{missingLabel}</span>;
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <code
        className={cn(
          "min-w-0 flex-1 truncate font-mono text-xs",
          current ? fingerprintToneClass(currentTone) : "text-muted-foreground",
        )}
        title={value}
      >
        {shortenFingerprint(value)}
      </code>
      <CopyFingerprintButton value={value} label={label} />
    </div>
  );
}

type FingerprintTone = "emerald" | "orange" | "pink" | "purple" | "violet";

function fingerprintToneClass(tone: FingerprintTone) {
  if (tone === "emerald") return "text-emerald-400";
  if (tone === "orange") return "text-orange-400";
  if (tone === "pink") return "text-pink-400";
  if (tone === "purple") return "text-purple-400";
  return "text-violet-400";
}

type FingerprintComparisonRow = {
  key: string;
  label: string;
  baseline: string | null;
  current: string | null;
  copyLabel: string;
  currentTone?: FingerprintTone;
};

function FingerprintComparisonTable({
  rows,
  firstColumnLabel = "Fingerprint",
}: {
  rows: readonly FingerprintComparisonRow[];
  firstColumnLabel?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead
              className="w-[26%] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:w-[18%] sm:px-4"
            >
              {firstColumnLabel}
            </TableHead>
            <TableHead className="w-[37%] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:w-[41%] sm:px-4">Before</TableHead>
            <TableHead className="w-[37%] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:w-[41%] sm:px-4">After</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} className="h-14 hover:bg-transparent sm:h-16">
              <TableCell className="px-3 font-medium text-foreground sm:px-4">{row.label}</TableCell>
              <TableCell className="min-w-0 px-3 sm:px-4">
                <FingerprintCell value={row.baseline} label={`before ${row.copyLabel}`} />
              </TableCell>
              <TableCell className="min-w-0 px-3 sm:px-4">
                <FingerprintCell
                  value={row.current}
                  label={`after ${row.copyLabel}`}
                  current={row.baseline !== row.current}
                  currentTone={row.currentTone}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const FAVICON_FINGERPRINT_DEFINITIONS = [
  { key: "md5", label: "MD5" },
  { key: "mmh3", label: "MMH3" },
] as const;

function faviconFingerprintRecord(value: unknown) {
  if (!isRecord(value)) return new Map<string, string>();

  const hashes = fingerprintRecord(value.hashes);
  const algorithm = typeof value.algorithm === "string" ? value.algorithm.toLowerCase() : null;
  const fingerprint = typeof value.value === "string" ? value.value : null;

  if (algorithm && fingerprint && !hashes.has(algorithm)) {
    hashes.set(algorithm, fingerprint);
  }

  return hashes;
}

function faviconLocation(value: unknown) {
  if (!isRecord(value) || typeof value.location !== "string" || value.location.length === 0) return null;
  return value.location;
}

function FaviconFingerprintEvidence({ item }: { item: ScanChangeItem }) {
  const before = faviconFingerprintRecord(item.before);
  const after = faviconFingerprintRecord(item.after);
  const rows = FAVICON_FINGERPRINT_DEFINITIONS.flatMap(({ key, label }) => {
    const baseline = before.get(key) ?? null;
    const current = after.get(key) ?? null;
    return baseline || current ? [{
      key,
      label,
      baseline,
      current,
      copyLabel: `favicon ${label}`,
      currentTone: "pink" as const,
    }] : [];
  });

  if (rows.length === 0) {
    return <FingerprintEvidence item={item} />;
  }

  const changedCount = rows.filter((row) => row.baseline !== row.current).length;
  const previousLocation = faviconLocation(item.before);
  const currentLocation = faviconLocation(item.after);
  const location = currentLocation ?? previousLocation;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-medium text-foreground">
        {changedCount} {changedCount === 1 ? "fingerprint changed" : "fingerprints changed"}
      </p>
      <FingerprintComparisonTable rows={rows} firstColumnLabel="Algorithm" />
      {location ? (
        <dl className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start sm:gap-3">
          <dt className="text-sm text-muted-foreground">Location</dt>
          <dd className="min-w-0 break-all font-mono text-sm text-foreground">{location}</dd>
        </dl>
      ) : null}
      <Alert variant="plain">
        <Info aria-hidden="true" />
        <AlertDescription>
          Stackray stores fingerprints for comparison. Historical favicon images are not retained.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function splitFaviconLocations(before: string, after: string) {
  try {
    const baselineUrl = new URL(before);
    const currentUrl = new URL(after);

    if (
      (baselineUrl.protocol === "http:" || baselineUrl.protocol === "https:")
      && baselineUrl.origin === currentUrl.origin
    ) {
      return {
        baseline: `${baselineUrl.pathname}${baselineUrl.search}${baselineUrl.hash}`,
        current: `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      };
    }
  } catch {
    // Relative paths and non-URL evidence are still useful as stored.
  }

  return { baseline: before, current: after };
}

function FaviconLocationEvidence({ item }: { item: ScanChangeItem }) {
  if (typeof item.before !== "string" || typeof item.after !== "string") {
    return <EvidencePair before={item.before} after={item.after} />;
  }

  const locations = splitFaviconLocations(item.before, item.after);

  return (
    <section className="flex flex-col gap-7" aria-label="Favicon location transition">
      <p className="text-sm text-muted-foreground">Fingerprint unchanged</p>
      <ChangeTransition
        ariaLabel="Favicon location comparison"
        className="sm:gap-12"
        before={(
          <div className="min-w-0 sm:text-right">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Before</h4>
            <code className="mt-3 block break-all font-mono text-base text-foreground">{locations.baseline}</code>
          </div>
        )}
        after={(
          <div className="min-w-0">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">After</h4>
            <code className="mt-3 block break-all font-mono text-base text-sky-400">{locations.current}</code>
          </div>
        )}
      />
    </section>
  );
}

function BodyFingerprintEvidence({ item }: { item: ScanChangeItem }) {
  const before = isRecord(item.before) ? fingerprintRecord(item.before.hashes) : new Map<string, string>();
  const after = isRecord(item.after) ? fingerprintRecord(item.after.hashes) : new Map<string, string>();
  const rows = BODY_FINGERPRINT_DEFINITIONS.flatMap(({ key, label }) => {
    const baseline = fingerprintValue(before, key);
    const current = fingerprintValue(after, key);
    return baseline || current ? [{
      key,
      label,
      baseline,
      current,
      copyLabel: label,
      currentTone: "violet" as const,
    }] : [];
  });

  if (rows.length === 0) {
    return <FingerprintEvidence item={item} />;
  }

  const changedCount = rows.filter((row) => row.baseline !== row.current).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-foreground">
        {changedCount} fingerprint {changedCount === 1 ? "signal" : "signals"} changed
      </p>
      <FingerprintComparisonTable rows={rows} />
    </div>
  );
}

function headerValueRecord(value: unknown) {
  if (!isRecord(value)) return new Map<string, string[]>();

  return new Map(Object.entries(value).flatMap(([name, entry]) => {
    const values = Array.isArray(entry)
      ? entry.flatMap((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean" ? [String(item)] : [])
      : typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" ? [String(entry)] : [];

    return values.length > 0 ? [[name, values] as const] : [];
  }));
}

type ClassifiedHeaderChange = {
  disposition: "meaningful" | "representation" | "routine" | "unknown";
  kind: "Added" | "Modified" | "Removed";
};

const HEADER_DISPOSITIONS = ["meaningful", "unknown", "routine", "representation"] as const;

function classifiedHeaderChanges(after: Record<string, unknown>) {
  if (after.mode !== "classified" || !isRecord(after.changesByDisposition)) {
    return null;
  }

  const changes = new Map<string, ClassifiedHeaderChange>();

  for (const disposition of HEADER_DISPOSITIONS) {
    const group = after.changesByDisposition[disposition];
    if (!isRecord(group)) continue;

    for (const name of asStringArray(group.added)) {
      changes.set(name, { disposition, kind: "Added" });
    }
    for (const name of asStringArray(group.removed)) {
      changes.set(name, { disposition, kind: "Removed" });
    }
    for (const name of asStringArray(group.changed)) {
      changes.set(name, { disposition, kind: "Modified" });
    }
  }

  return changes;
}

function classifiedHeaderKindLabel(change: ClassifiedHeaderChange) {
  if (change.disposition === "meaningful") return change.kind;
  if (change.disposition === "routine") return `${change.kind} · Routine`;
  if (change.disposition === "representation") return `${change.kind} · Representation evidence`;
  return `${change.kind} · Other`;
}

function HeaderEvidence({ item }: { item: ScanChangeItem }) {
  const before = isRecord(item.before) ? item.before : {};
  const after = isRecord(item.after) ? item.after : {};
  const classified = classifiedHeaderChanges(after);
  const added = classified
    ? [...classified.entries()].flatMap(([name, change]) => change.kind === "Added" ? [name] : [])
    : asStringArray(after.added).filter((name) => !isIgnoredResponseHeader(name));
  const removed = classified
    ? [...classified.entries()].flatMap(([name, change]) => change.kind === "Removed" ? [name] : [])
    : asStringArray(after.removed).filter((name) => !isIgnoredResponseHeader(name));
  const changed = after.mode === "both" ? asStringArray(after.semanticChanged) : asStringArray(after.changed);
  const modified = classified
    ? [...classified.entries()].flatMap(([name, change]) => change.kind === "Modified" ? [name] : [])
    : changed.filter((name) => !isIgnoredResponseHeader(name));
  const addedSet = new Set(added);
  const removedSet = new Set(removed);
  const modifiedSet = new Set(modified);
  const names = [...new Set([...added, ...removed, ...modified])].toSorted();
  const showsSetCookie = names.includes("set-cookie");
  const standardNames = names.filter((name) => name !== "set-cookie");
  const beforeValues = headerValueRecord(before.valuesByName);
  const afterValues = headerValueRecord(after.valuesByName);

  return (
    <div className="flex flex-col gap-4">
      {standardNames.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table className="table-fixed">
            <TableHeader className="hidden sm:table-header-group">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[30%] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:px-4">Header</TableHead>
                <TableHead className="w-[35%] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:px-4">Before</TableHead>
                <TableHead className="w-[35%] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:px-4">After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standardNames.map((name) => {
                const classifiedChange = classified?.get(name);
                const kind = classifiedChange
                  ? classifiedHeaderKindLabel(classifiedChange)
                  : addedSet.has(name) ? "Added" : removedSet.has(name) ? "Removed" : modifiedSet.has(name) ? "Modified" : null;
                const baseline = beforeValues.get(name) ?? null;
                const current = afterValues.get(name) ?? null;

                return (
                  <TableRow key={name} className="grid grid-cols-2 hover:bg-transparent sm:table-row sm:h-16">
                    <TableCell className="col-span-2 border-b border-border/60 px-3 py-3 sm:table-cell sm:border-b-0 sm:px-4">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <code className="truncate font-mono text-sm font-medium text-foreground" title={name}>{name}</code>
                        {kind ? <span className="text-xs text-muted-foreground">{kind}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 border-r border-border/60 px-3 py-3 align-top sm:table-cell sm:border-r-0 sm:px-4 sm:py-2 sm:align-middle">
                      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:hidden">Before</span>
                      <HeaderValueCell
                        values={baseline}
                        label={`before ${name}`}
                        missingLabel={addedSet.has(name) ? "Not present" : "Value unavailable"}
                      />
                    </TableCell>
                    <TableCell className="min-w-0 px-3 py-3 align-top sm:table-cell sm:px-4 sm:py-2 sm:align-middle">
                      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:hidden">After</span>
                      <HeaderValueCell
                        values={current}
                        label={`after ${name}`}
                        current
                        missingLabel={removedSet.has(name) ? "Not present" : "Value unavailable"}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : !showsSetCookie ? (
        <p className="text-sm text-muted-foreground">
          This historical comparison contains only headers that Stackray no longer reports as standalone changes.
        </p>
      ) : null}
      {showsSetCookie ? (
        <SetCookieEvidence
          beforeValues={beforeValues.get("set-cookie") ?? []}
          afterValues={afterValues.get("set-cookie") ?? []}
        />
      ) : null}
    </div>
  );
}

type AttributeComparisonTone = "cyan" | "orange" | "teal";

type AttributeComparisonRow = {
  key: string;
  label: string;
  before: ReactNode;
  after: ReactNode;
  changed: boolean;
};

function attributeComparisonToneClass(tone: AttributeComparisonTone) {
  if (tone === "orange") return "text-orange-400";
  if (tone === "teal") return "text-teal-400";
  return "text-cyan-400";
}

function AttributeComparisonTable({
  rows,
  firstColumnLabel,
  afterTone,
  monospaceValues = false,
}: {
  rows: readonly AttributeComparisonRow[];
  firstColumnLabel: string;
  afterTone: AttributeComparisonTone;
  monospaceValues?: boolean;
}) {
  const changedCount = rows.filter((row) => row.changed).length;
  const unchangedCount = rows.length - changedCount;
  const valueClassName = monospaceValues ? "break-words font-mono text-xs sm:text-sm" : "break-words";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {changedCount} changed <span aria-hidden="true">·</span> {unchangedCount} unchanged
      </p>
      <div className="overflow-hidden rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[38%] px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{firstColumnLabel}</TableHead>
              <TableHead className="w-[31%] px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Before</TableHead>
              <TableHead className="w-[31%] px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">After</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key} className="h-14 hover:bg-transparent sm:h-16">
                <TableCell className={cn("whitespace-normal px-4 font-medium", row.changed ? "text-foreground" : "text-muted-foreground")}>{row.label}</TableCell>
                <TableCell className={cn("min-w-0 whitespace-normal px-4", valueClassName, row.changed ? "text-foreground" : "text-muted-foreground")}>{row.before}</TableCell>
                <TableCell className={cn(
                  "min-w-0 whitespace-normal px-4",
                  valueClassName,
                  row.changed ? cn("font-medium", attributeComparisonToneClass(afterTone)) : "text-muted-foreground",
                )}>
                  {row.after}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const HTTP_CAPABILITIES = [
  { key: "http2", label: "HTTP/2" },
  { key: "vhost", label: "Virtual host" },
  { key: "pipeline", label: "HTTP pipelining" },
  { key: "websocket", label: "WebSocket" },
] as const;

function capabilityState(value: unknown) {
  if (typeof value !== "boolean") return "Not observed";
  return value ? "Enabled" : "Disabled";
}

function CapabilitiesEvidence({ item }: { item: ScanChangeItem }) {
  const before = isRecord(item.before) ? item.before : {};
  const after = isRecord(item.after) ? item.after : {};
  const rows = HTTP_CAPABILITIES.flatMap(({ key, label }) => (
    typeof before[key] === "boolean" || typeof after[key] === "boolean"
      ? [{
          key,
          label,
          before: capabilityState(before[key]),
          after: capabilityState(after[key]),
          changed: before[key] !== after[key],
        }]
      : []
  ));

  return (
    <AttributeComparisonTable
      rows={rows}
      firstColumnLabel="Capability"
      afterTone="cyan"
    />
  );
}

type ContentTypeValue = {
  mediaType: string;
  parameters: Map<string, string>;
};

function splitContentType(value: string) {
  const parts: string[] = [];
  let current = "";
  let quote: "\"" | "'" | null = null;
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\" && quote !== null) {
      current += character;
      escaped = true;
      continue;
    }

    if (character === "\"" || character === "'") {
      quote = quote === character ? null : quote ?? character;
      current += character;
      continue;
    }

    if (character === ";" && quote === null) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  parts.push(current.trim());
  return parts;
}

function unwrapQuotedValue(value: string) {
  const first = value.at(0);
  const last = value.at(-1);
  return value.length >= 2 && (first === "\"" || first === "'") && last === first
    ? value.slice(1, -1)
    : value;
}

function parseContentType(value: unknown): ContentTypeValue | null {
  if (typeof value !== "string") return null;

  const [mediaType = "", ...rawParameters] = splitContentType(value);
  const normalizedMediaType = mediaType.trim().toLowerCase();
  if (normalizedMediaType.length === 0) return null;

  const parameters = new Map<string, string>();
  for (const rawParameter of rawParameters) {
    const separator = rawParameter.indexOf("=");
    if (separator < 1) continue;

    const name = rawParameter.slice(0, separator).trim().toLowerCase();
    const parameterValue = unwrapQuotedValue(rawParameter.slice(separator + 1).trim());
    if (name.length > 0) parameters.set(name, parameterValue);
  }

  return { mediaType: normalizedMediaType, parameters };
}

function ContentTypeEvidence({ item }: { item: ScanChangeItem }) {
  const before = parseContentType(item.before);
  const after = parseContentType(item.after);
  if (!before || !after) {
    return <EvidencePair before={item.before} after={item.after} />;
  }

  const parameterNames = new Set([...before.parameters.keys(), ...after.parameters.keys()]);
  const rows = [
    {
      key: "media-type",
      label: "Media type",
      before: before.mediaType,
      after: after.mediaType,
      changed: before.mediaType !== after.mediaType,
    },
    ...[...parameterNames].toSorted().map((name) => ({
      key: `parameter-${name}`,
      label: humanizeKey(name),
      before: before.parameters.get(name) ?? "Not present",
      after: after.parameters.get(name) ?? "Not present",
      changed: before.parameters.get(name) !== after.parameters.get(name),
    })),
  ];

  return (
    <section aria-label="Content type comparison">
      <AttributeComparisonTable
        rows={rows}
        firstColumnLabel="Attribute"
        afterTone="teal"
        monospaceValues
      />
    </section>
  );
}

function PageTitleValue({
  label,
  value,
  current,
}: {
  label: string;
  value: string;
  current: boolean;
}) {
  return (
    <section className="min-w-0" aria-label={`${label} page title`}>
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </h4>
      <p
        className={cn(
          "mt-5 text-pretty break-words font-heading text-xl font-medium leading-snug tracking-tight sm:text-2xl",
          current ? "text-sky-400" : "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </section>
  );
}

function PageTitleEvidence({ item }: { item: ScanChangeItem }) {
  if (typeof item.before !== "string" || typeof item.after !== "string") {
    return <EvidencePair before={item.before} after={item.after} />;
  }

  return (
    <ChangeTransition
      ariaLabel="Page title transition"
      className="py-5 sm:gap-10 sm:py-9"
      before={<PageTitleValue label="Before" value={item.before} current={false} />}
      after={<PageTitleValue label="After" value={item.after} current />}
    />
  );
}

function ServerIdentityNode({
  label,
  value,
  current,
}: {
  label: string;
  value: string;
  current: boolean;
}) {
  return (
    <section className="flex min-w-0 flex-col items-center text-center" aria-label={`${label} web server identity`}>
      <h4 className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.14em]",
        current ? "text-indigo-400" : "text-muted-foreground",
      )}>
        {label}
      </h4>
      <Server
        className={cn("mt-6 size-16", current ? "text-indigo-400" : "text-muted-foreground")}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <p className="mt-5 break-words text-base font-semibold text-foreground">{value}</p>
    </section>
  );
}

function ServerIdentityEvidence({ item }: { item: ScanChangeItem }) {
  if (typeof item.before !== "string" || typeof item.after !== "string") {
    return <EvidencePair before={item.before} after={item.after} />;
  }

  return (
    <ChangeTransition
      ariaLabel="Web server identity transition"
      className="py-5 sm:py-9"
      before={<ServerIdentityNode label="Before" value={item.before} current={false} />}
      after={<ServerIdentityNode label="After" value={item.after} current />}
    />
  );
}

const CDN_ATTRIBUTES = [
  { key: "name", label: "Provider" },
  { key: "type", label: "Role" },
  { key: "enabled", label: "State" },
] as const;

function cdnAttributeValue(key: typeof CDN_ATTRIBUTES[number]["key"], value: unknown) {
  if (key === "enabled") {
    if (typeof value !== "boolean") return "Not observed";
    return value ? "Enabled" : "Disabled";
  }

  if (typeof value !== "string" || value.length === 0) return "Not observed";
  return key === "type" ? value.toUpperCase() : value;
}

function CdnEvidence({ item }: { item: ScanChangeItem }) {
  const before = isRecord(item.before) ? item.before : {};
  const after = isRecord(item.after) ? item.after : {};
  const rows = CDN_ATTRIBUTES.map(({ key, label }) => ({
    key,
    label,
    before: cdnAttributeValue(key, before[key]),
    after: cdnAttributeValue(key, after[key]),
    changed: before[key] !== after[key],
  }));

  return (
    <AttributeComparisonTable
      rows={rows}
      firstColumnLabel="Attribute"
      afterTone="orange"
    />
  );
}

function normalizeRedirectUrl(value: string, baseUrl: string | null) {
  try {
    return new URL(value, baseUrl ?? undefined).toString();
  } catch {
    return value;
  }
}

function redirectChain(value: unknown, endpointIdentity: string | null) {
  if (!isRecord(value)) return [];

  const directChain = asStringArray(value.chain);
  const itemChain = Array.isArray(value.items)
    ? value.items.flatMap((entry) => isRecord(entry) && typeof entry.url === "string" ? [entry.url] : [])
    : [];
  const sourceChain = directChain.length > 0 ? directChain : itemChain;
  const baseUrl = endpointIdentity ?? sourceChain[0] ?? null;
  const normalized = sourceChain.map((entry) => normalizeRedirectUrl(entry, baseUrl));
  const finalUrl = typeof value.finalUrl === "string"
    ? normalizeRedirectUrl(value.finalUrl, baseUrl)
    : null;
  const location = typeof value.location === "string"
    ? normalizeRedirectUrl(value.location, baseUrl)
    : null;

  if (normalized.length === 0 && endpointIdentity) {
    normalized.push(normalizeRedirectUrl(endpointIdentity, endpointIdentity));
  }

  const destination = finalUrl ?? location;
  if (destination && normalized.at(-1) !== destination) {
    normalized.push(destination);
  }

  return normalized.filter((entry, index) => index === 0 || entry !== normalized[index - 1]);
}

function redirectNodeLabel(value: string, origin: string | undefined, index: number) {
  try {
    const url = new URL(value);
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (index === 0) return path === "/" ? url.host : `${url.host}${path}`;

    if (origin) {
      const originUrl = new URL(origin);
      if (url.host === originUrl.host) return path;
    }

    return `${url.host}${path}`;
  } catch {
    return value;
  }
}

function RedirectTimeline({
  label,
  chain,
  baselineChain,
  current,
}: {
  label: string;
  chain: readonly string[];
  baselineChain: readonly string[];
  current: boolean;
}) {
  const baselineValues = new Set(baselineChain);

  return (
    <section className="min-w-0" aria-label={`${label} redirect chain`}>
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</h4>
      <ol className="mt-5" aria-label={`${label} redirect steps`}>
        {chain.map((value, index) => {
          const last = index === chain.length - 1;
          const added = current && !baselineValues.has(value);
          const newHop = added && !last;

          return (
            <li key={`${value}-${index}`} className={cn("flex gap-4", last ? "min-h-0" : "min-h-20")}>
              <div className="flex w-4 shrink-0 flex-col items-center" aria-hidden="true">
                <span className={cn(
                  "size-4 shrink-0 rounded-full border-2 bg-background",
                  added ? "border-amber-400" : "border-muted-foreground",
                )} />
                {!last ? (
                  <span className={cn("w-px flex-1", current && added ? "bg-amber-400" : "bg-border")} />
                ) : null}
              </div>
              <div className={cn("-mt-1 min-w-0", last ? null : "pb-6")}>
                <p className={cn("break-all text-sm font-medium", added ? "text-amber-400" : "text-foreground")}>
                  {redirectNodeLabel(value, chain[0], index)}
                </p>
                {newHop ? <p className="mt-1 text-xs text-amber-400">New hop</p> : null}
                {last ? <p className="mt-1 text-xs text-muted-foreground">Final destination</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RedirectEvidence({ item }: { item: ScanChangeItem }) {
  const baselineChain = redirectChain(item.before, item.endpointIdentity);
  const currentChain = redirectChain(item.after, item.endpointIdentity);

  if (baselineChain.length === 0 || currentChain.length === 0) {
    return <EvidencePair before={item.before} after={item.after} />;
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-8">
      <RedirectTimeline label="Before" chain={baselineChain} baselineChain={baselineChain} current={false} />
      <Separator className="sm:hidden" />
      <Separator orientation="vertical" className="hidden h-auto sm:block" />
      <RedirectTimeline label="After" chain={currentChain} baselineChain={baselineChain} current />
    </div>
  );
}

function httpStatusTone(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) return "text-emerald-400";
  if (statusCode >= 300 && statusCode < 400) return "text-amber-400";
  if (statusCode >= 400 && statusCode < 600) return "text-orange-400";
  return "text-cyan-400";
}

function StatusValue({ statusCode, label }: { statusCode: number; label: string }) {
  const tone = httpStatusTone(statusCode);

  return (
    <section className="min-w-0 text-center" aria-label={`${label} HTTP status`}>
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</h4>
      <p className={cn("mt-6 font-heading text-6xl font-semibold leading-none tracking-tight tabular-nums sm:text-7xl", tone)}>
        {statusCode}
      </p>
      <p className={cn("mt-4 text-lg font-semibold", tone)}>{getHttpStatusText(statusCode)}</p>
      <p className="mt-2 text-sm text-muted-foreground">{getHttpResponseClass(statusCode)}</p>
    </section>
  );
}

function StatusEvidence({ item }: { item: ScanChangeItem }) {
  if (typeof item.before !== "number" || typeof item.after !== "number") {
    return <EvidencePair before={item.before} after={item.after} />;
  }

  return (
    <ChangeTransition
      ariaLabel="HTTP status transition"
      className="py-4 sm:py-6"
      before={<StatusValue statusCode={item.before} label="Before" />}
      after={<StatusValue statusCode={item.after} label="After" />}
    />
  );
}

function AddedRemovedGroup({
  kind,
  values,
  singularLabel,
  pluralLabel,
  groupLabel = pluralLabel,
  monospace = false,
}: {
  kind: "added" | "removed";
  values: readonly string[];
  singularLabel: string;
  pluralLabel: string;
  groupLabel?: string;
  monospace?: boolean;
}) {
  const added = kind === "added";
  const label = added ? "Added" : "Removed";
  const countLabel = values.length === 1 ? singularLabel : pluralLabel;

  return (
    <section className="min-w-0 p-4 sm:p-0" aria-label={`${label} ${groupLabel}`}>
      <div className="flex items-center gap-3">
        {added ? (
          <CirclePlus className="size-5 shrink-0 text-emerald-400 sm:size-6" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <CircleMinus className="size-5 shrink-0 text-red-400 sm:size-6" strokeWidth={1.75} aria-hidden="true" />
        )}
        <h4
          aria-label={`${label}, ${values.length} ${countLabel}`}
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.14em]",
            added ? "text-emerald-400" : "text-red-400",
          )}
        >
          {label} <span aria-hidden="true">· {values.length}</span>
        </h4>
      </div>
      <Separator className="my-5 hidden bg-border/60 sm:block" />
      {values.length > 0 ? (
        <ul
          className="mt-3 flex flex-col gap-2 pl-8 sm:mt-0 sm:gap-3 sm:pl-0"
          aria-label={`${label} ${singularLabel} values`}
        >
          {values.map((value) => (
            <li key={value}>
              {monospace ? (
                <code className="break-words font-mono text-base font-medium text-foreground sm:text-lg">{value}</code>
              ) : (
                <span className="break-words text-base font-medium text-foreground sm:text-lg">{value}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 pl-8 text-sm text-muted-foreground sm:mt-0 sm:pl-0">No {pluralLabel}</p>
      )}
    </section>
  );
}

function AddedRemovedEvidence({
  item,
  singularLabel,
  pluralLabel,
  groupLabel,
  monospace = false,
}: {
  item: ScanChangeItem;
  singularLabel: string;
  pluralLabel: string;
  groupLabel?: string;
  monospace?: boolean;
}) {
  const before = isRecord(item.before) ? item.before : {};
  const after = isRecord(item.after) ? item.after : {};
  const removed = asStringArray(before.removed);
  const added = asStringArray(after.added);

  if (removed.length === 0 && added.length === 0) {
    return <EvidencePair before={item.before} after={item.after} />;
  }

  return (
    <div
      data-slot="added-removed-evidence"
      className="grid overflow-hidden rounded-lg border border-border/60 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-10 sm:overflow-visible sm:rounded-none sm:border-0 sm:px-4 sm:py-4"
    >
      <AddedRemovedGroup
        kind="removed"
        values={removed}
        singularLabel={singularLabel}
        pluralLabel={pluralLabel}
        groupLabel={groupLabel}
        monospace={monospace}
      />
      <Separator className="bg-border/60 sm:hidden" />
      <Separator orientation="vertical" className="hidden h-auto bg-border/60 sm:block" />
      <AddedRemovedGroup
        kind="added"
        values={added}
        singularLabel={singularLabel}
        pluralLabel={pluralLabel}
        groupLabel={groupLabel}
        monospace={monospace}
      />
    </div>
  );
}

function DnsRecordEvidence({ item }: { item: ScanChangeItem }) {
  return (
    <AddedRemovedEvidence
      item={item}
      singularLabel="record"
      pluralLabel="records"
      groupLabel="DNS records"
      monospace
    />
  );
}

function CnameRecordNode({
  label,
  value,
  current,
}: {
  label: string;
  value: string;
  current: boolean;
}) {
  return (
    <section className="min-w-0 text-center" aria-label={`${label} CNAME record`}>
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</h4>
      <code className={cn(
        "mt-5 block break-all font-mono text-base font-semibold sm:text-lg",
        current ? "text-teal-400" : "text-muted-foreground",
      )}>
        {value}
      </code>
    </section>
  );
}

function CnameRecordEvidence({ item }: { item: ScanChangeItem }) {
  const before = isRecord(item.before) ? item.before : {};
  const after = isRecord(item.after) ? item.after : {};
  const removed = asStringArray(before.removed);
  const added = asStringArray(after.added);

  if (removed.length !== 1 || added.length !== 1) {
    return (
      <AddedRemovedEvidence
        item={item}
        singularLabel="CNAME record"
        pluralLabel="CNAME records"
        monospace
      />
    );
  }

  return (
    <div className="flex flex-col gap-8 py-3 sm:px-4 sm:py-6">
      <ChangeTransition
        ariaLabel="CNAME record transition"
        before={<CnameRecordNode label="Before" value={removed[0]} current={false} />}
        after={<CnameRecordNode label="After" value={added[0]} current />}
      />
      {item.endpointIdentity ? (
        <p className="text-center text-sm text-muted-foreground">
          Alias for <code className="font-mono text-foreground">{formatTargetForDisplay(item.endpointIdentity)}</code>
        </p>
      ) : null}
    </div>
  );
}

function TransitionValueNode({
  label,
  value,
  current,
}: {
  label: string;
  value: string;
  current: boolean;
}) {
  return (
    <section className="min-w-0 text-center" aria-label={`${label} value`}>
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</h4>
      <div className="mt-5 flex min-w-0 items-center justify-center gap-1.5">
        <code
          className={cn(
            "min-w-0 break-all font-mono text-base font-semibold sm:text-lg",
            current ? "text-cyan-400" : "text-muted-foreground",
          )}
          title={value}
        >
          {value}
        </code>
      </div>
    </section>
  );
}

function transitionScalar(value: unknown, key?: string) {
  if (typeof value === "string" && value.length > 0) return value;
  if (!key || !isRecord(value)) return null;
  const nested = value[key];
  return typeof nested === "string" && nested.length > 0 ? nested : null;
}

function ScalarTransitionEvidence({
  item,
  ariaLabel,
}: {
  item: ScanChangeItem;
  ariaLabel: string;
}) {
  const before = transitionScalar(item.before);
  const after = transitionScalar(item.after);

  if (!before || !after) {
    return <EvidencePair before={item.before} after={item.after} />;
  }

  return (
    <ChangeTransition
      ariaLabel={ariaLabel}
      className="py-3 sm:px-4 sm:py-6"
      before={(
        <TransitionValueNode
          label="Before"
          value={before}
          current={false}
        />
      )}
      after={(
        <TransitionValueNode
          label="After"
          value={after}
          current
        />
      )}
    />
  );
}

function SingleFingerprintEvidence({
  item,
  label,
  copyLabel,
  currentTone,
  evidenceKey,
}: {
  item: ScanChangeItem;
  label: string;
  copyLabel: string;
  currentTone: FingerprintTone;
  evidenceKey?: string;
}) {
  const baseline = transitionScalar(item.before, evidenceKey);
  const current = transitionScalar(item.after, evidenceKey);

  if (!baseline || !current) {
    return <EvidencePair before={item.before} after={item.after} />;
  }

  return (
    <FingerprintComparisonTable
      rows={[{
        key: label.toLowerCase(),
        label,
        baseline,
        current,
        copyLabel,
        currentTone,
      }]}
    />
  );
}

export function ChangeEvidence({ item }: { item: ScanChangeItem }) {
  if (item.changeType === "body_fingerprint.changed") {
    return <BodyFingerprintEvidence item={item} />;
  }

  if (item.changeType === "favicon.changed") {
    return <FaviconFingerprintEvidence item={item} />;
  }

  if (item.changeType === "favicon_location.changed") {
    return <FaviconLocationEvidence item={item} />;
  }

  if (item.changeType === "response_headers.changed") {
    return <HeaderEvidence item={item} />;
  }

  if (item.changeType === "metadata.capabilities_changed") {
    return <CapabilitiesEvidence item={item} />;
  }

  if (item.changeType === "metadata.content_type_changed") {
    return <ContentTypeEvidence item={item} />;
  }

  if (item.changeType === "metadata.title_changed") {
    return <PageTitleEvidence item={item} />;
  }

  if (item.changeType === "metadata.server_changed") {
    return <ServerIdentityEvidence item={item} />;
  }

  if (item.changeType === "metadata.cdn_changed") {
    return <CdnEvidence item={item} />;
  }

  if (item.changeType === "redirect.changed") {
    return <RedirectEvidence item={item} />;
  }

  if (item.changeType === "status.changed") {
    return <StatusEvidence item={item} />;
  }

  if (
    item.changeType === "dns.a_changed"
    || item.changeType === "dns.aaaa_changed"
  ) {
    return <DnsRecordEvidence item={item} />;
  }

  if (item.changeType === "dns.cname_changed") {
    return <CnameRecordEvidence item={item} />;
  }

  if (item.changeType === "dns.host_ip_changed") {
    return (
      <ScalarTransitionEvidence
        item={item}
        ariaLabel="Resolved IP transition"
      />
    );
  }

  if (item.changeType === "tls.certificate_changed") {
    return (
      <SingleFingerprintEvidence
        item={item}
        label="Certificate"
        copyLabel="certificate"
        evidenceKey="fingerprint"
        currentTone="emerald"
      />
    );
  }

  if (item.changeType === "tls.jarm_changed") {
    return (
      <SingleFingerprintEvidence
        item={item}
        label="JARM"
        copyLabel="JARM"
        currentTone="purple"
      />
    );
  }

  if (item.changeType === "technology.changed") {
    return (
      <AddedRemovedEvidence
        item={item}
        singularLabel="technology"
        pluralLabel="technologies"
      />
    );
  }

  if (item.changeType === "cpe.changed") {
    return (
      <AddedRemovedEvidence
        item={item}
        singularLabel="CPE identifier"
        pluralLabel="CPE identifiers"
        monospace
      />
    );
  }

  return <EvidencePair before={item.before} after={item.after} />;
}

export function ChangeItemsPanel({ items }: { items: readonly ScanChangeItem[] }) {
  if (items.length === 0) {
    return (
      <Empty className="min-h-32 border">
        <EmptyHeader>
          <EmptyMedia variant="icon"><CheckCircle2 aria-hidden="true" /></EmptyMedia>
          <EmptyTitle>No changes detected</EmptyTitle>
          <EmptyDescription>The comparable evidence matches this baseline.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="divide-y divide-border/60 [&>article:first-child]:pt-0 [&>article:last-child]:pb-0">
      {items.map((item) => (
        <article key={item.id} className="py-4">
          <div className="flex items-start gap-3">
            <span className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              getChangeTypeIconSurfaceClass(item.changeType),
            )}>
              <ChangeTypeIcon changeType={item.changeType} className="size-5.5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-sm font-semibold text-foreground">{getChangeTitle(item)}</h3>
              {item.endpointIdentity ? (
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{item.endpointIdentity}</p>
              ) : null}
            </div>
          </div>

          {item.before !== undefined || item.after !== undefined ? (
            <div className="mt-3">
              <ChangeEvidence item={item} />
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function ChangeComparisonCard({ comparison, expanded = false }: { comparison: ScanComparison; expanded?: boolean }) {
  const target = formatTargetForDisplay(comparison.currentScan.target);
  const visibleItems = expanded ? comparison.items : comparison.items.slice(0, 4);
  const remainingCount = Math.max(0, comparison.counts.total - visibleItems.length);

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="truncate font-mono">{target}</CardTitle>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <LocalTime value={comparison.currentScan.completedAt} preset="fullDateTimeWithZone" />
              <span aria-hidden="true">·</span>
              <span>{comparison.baselineMode === "pinned" ? "Pinned baseline" : comparison.baselineMode === "ad_hoc" ? "Ad hoc comparison" : "Previous scan"}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="outline">{comparison.counts.total} total</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChangeItemsPanel items={visibleItems} />
        {!expanded ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Compared with <LocalTime value={comparison.baselineScan.completedAt} preset="fullDateTimeWithZone" />
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={`/scans/${comparison.currentScan.id}?section=changes`}>
                {remainingCount > 0 ? `View all ${comparison.counts.total}` : "Open comparison"}
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
