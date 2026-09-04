import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  canonicalizeSetCookieForComparison,
  parseSetCookieHeaderValues,
  type ParsedSetCookie,
} from "@/lib/changes/set-cookie"
import { cn } from "@/lib/utils"

const COOKIE_ATTRIBUTE_ORDER = [
  "domain",
  "path",
  "samesite",
  "secure",
  "httponly",
  "partitioned",
  "max-age",
  "expires",
  "priority",
] as const

const COOKIE_FLAG_ATTRIBUTES = new Set(["secure", "httponly", "partitioned"])
const COOKIE_ATTRIBUTE_LABELS: Record<string, string> = {
  domain: "Domain",
  path: "Path",
  samesite: "SameSite",
  secure: "Secure",
  httponly: "HttpOnly",
  partitioned: "Partitioned",
  "max-age": "Max-Age",
  expires: "Expires",
  priority: "Priority",
}

type CookiePair = {
  key: string
  name: string
  before: ParsedSetCookie | null
  after: ParsedSetCookie | null
}

function cookieSortKey(cookie: ParsedSetCookie) {
  return [cookie.attributes.domain ?? "", cookie.attributes.path ?? ""].join("\u0000")
}

function groupCookiesByName(cookies: readonly ParsedSetCookie[]) {
  const groups = new Map<string, ParsedSetCookie[]>()

  for (const cookie of cookies) {
    groups.set(cookie.name, [...(groups.get(cookie.name) ?? []), cookie])
  }

  return groups
}

function pairChangedCookies(beforeValues: readonly string[], afterValues: readonly string[]) {
  const beforeGroups = groupCookiesByName(parseSetCookieHeaderValues(beforeValues))
  const afterGroups = groupCookiesByName(parseSetCookieHeaderValues(afterValues))
  const names = [...new Set([...beforeGroups.keys(), ...afterGroups.keys()])].toSorted()

  return names.flatMap((name) => {
    const before = (beforeGroups.get(name) ?? []).toSorted((left, right) => cookieSortKey(left).localeCompare(cookieSortKey(right)))
    const after = (afterGroups.get(name) ?? []).toSorted((left, right) => cookieSortKey(left).localeCompare(cookieSortKey(right)))
    const pairCount = Math.max(before.length, after.length)

    return Array.from({ length: pairCount }, (_, index): CookiePair => ({
      key: `${name}:${index}`,
      name,
      before: before[index] ?? null,
      after: after[index] ?? null,
    })).filter((pair) => pair.before?.raw !== pair.after?.raw)
  })
}

function cookieChangeLabel(pair: CookiePair) {
  if (!pair.before) return "Added"
  if (!pair.after) return "Removed"

  if (canonicalizeSetCookieForComparison(pair.before.raw) === canonicalizeSetCookieForComparison(pair.after.raw)) {
    return "Routine rotation"
  }

  return "Modified"
}

function cookieAttributeKeys(pair: CookiePair) {
  const keys = new Set<string>([
    "domain",
    "path",
    "samesite",
    "secure",
    "httponly",
    "partitioned",
    ...Object.keys(pair.before?.attributes ?? {}),
    ...Object.keys(pair.after?.attributes ?? {}),
  ])
  const order = new Map<string, number>(COOKIE_ATTRIBUTE_ORDER.map((name, index) => [name, index]))

  return [...keys].toSorted((left, right) => {
    const leftOrder = order.get(left) ?? COOKIE_ATTRIBUTE_ORDER.length
    const rightOrder = order.get(right) ?? COOKIE_ATTRIBUTE_ORDER.length
    return leftOrder - rightOrder || left.localeCompare(right)
  })
}

function formatMaxAge(value: string) {
  const seconds = Number.parseInt(value, 10)
  if (!Number.isFinite(seconds) || String(seconds) !== value) return value

  const units = [
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"],
  ] as const
  const matchingUnit = units.find(([unitSeconds]) => seconds !== 0 && seconds % unitSeconds === 0)

  if (!matchingUnit) return `${seconds} seconds`
  const [unitSeconds, label] = matchingUnit
  const amount = seconds / unitSeconds
  return `${amount} ${label}${Math.abs(amount) === 1 ? "" : "s"}`
}

function cookieAttributeValue(cookie: ParsedSetCookie | null, name: string) {
  if (!cookie) return "Not present"

  const value = cookie.attributes[name]
  if (COOKIE_FLAG_ATTRIBUTES.has(name)) return value === true ? "Enabled" : "Disabled"
  if (value === undefined) return "Not set"
  if (value === true) return "Enabled"
  return name === "max-age" ? formatMaxAge(value) : value
}

function cookieValue(cookie: ParsedSetCookie | null) {
  if (!cookie) return "Not present"
  return cookie.value || "Empty value"
}

function CookieCard({ pair }: { pair: CookiePair }) {
  const attributes = cookieAttributeKeys(pair).map((name) => {
    const before = cookieAttributeValue(pair.before, name)
    const after = cookieAttributeValue(pair.after, name)
    return {
      name,
      label: COOKIE_ATTRIBUTE_LABELS[name] ?? name,
      before,
      after,
      changed: before !== after,
    }
  })
  const changeLabel = cookieChangeLabel(pair)
  const beforeValue = cookieValue(pair.before)
  const afterValue = cookieValue(pair.after)
  const valueChanged = beforeValue !== afterValue

  return (
    <article className="overflow-hidden rounded-lg border border-border" aria-labelledby={`cookie-${pair.key}`}>
      <header className="flex items-center justify-between gap-4 border-b border-border/60 px-3 py-4 sm:px-4 sm:py-5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Cookie
          </span>
          <h5 id={`cookie-${pair.key}`} className="min-w-0 truncate text-sm font-semibold text-foreground">
            <code className="font-mono">{pair.name}</code>
          </h5>
        </div>
        <Badge variant="outline">
          {changeLabel}
        </Badge>
      </header>

      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[30%] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:px-4">Attribute</TableHead>
            <TableHead className="w-[35%] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:px-4">Before</TableHead>
            <TableHead className="w-[35%] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:px-4">After</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="h-11 hover:bg-transparent">
            <TableCell className="px-3 text-xs font-medium whitespace-normal text-foreground sm:px-4">
              Value
            </TableCell>
            <TableCell className="px-3 font-mono text-xs whitespace-normal text-muted-foreground sm:px-4">
              <code
                className="block min-w-0 max-w-full truncate font-mono sm:overflow-visible sm:whitespace-normal sm:text-clip sm:break-all"
                title={beforeValue}
              >
                {beforeValue}
              </code>
            </TableCell>
            <TableCell className={cn(
              "px-3 font-mono text-xs whitespace-normal sm:px-4",
              valueChanged ? "font-medium text-orange-400" : "text-muted-foreground",
            )}>
              <code
                className="block min-w-0 max-w-full truncate font-mono sm:overflow-visible sm:whitespace-normal sm:text-clip sm:break-all"
                title={afterValue}
              >
                {afterValue}
              </code>
            </TableCell>
          </TableRow>
          {attributes.map((attribute) => (
            <TableRow key={attribute.name} className="h-11 hover:bg-transparent">
              <TableCell className="break-words px-3 text-xs font-medium whitespace-normal text-foreground sm:px-4">
                {attribute.label}
              </TableCell>
              <TableCell className="break-words px-3 font-mono text-xs whitespace-normal text-muted-foreground sm:px-4">
                {attribute.before}
              </TableCell>
              <TableCell className={cn(
                "break-words px-3 font-mono text-xs whitespace-normal sm:px-4",
                attribute.changed ? "font-medium text-orange-400" : "text-muted-foreground",
              )}>
                {attribute.after}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

    </article>
  )
}

export function SetCookieEvidence({
  beforeValues,
  afterValues,
}: {
  beforeValues: readonly string[]
  afterValues: readonly string[]
}) {
  const pairs = pairChangedCookies(beforeValues, afterValues)

  return (
    <section className="flex flex-col gap-3 border-t border-border/60 pt-4" aria-labelledby="set-cookie-heading">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h4 id="set-cookie-heading" className="font-mono text-sm font-semibold text-foreground">Set-Cookie</h4>
          <span className="text-xs text-muted-foreground">
            {pairs.length} {pairs.length === 1 ? "cookie" : "cookies"} changed
          </span>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Only changed cookies are shown. Values and attributes are compared individually.
        </p>
      </div>

      {pairs.length > 0 ? (
        <div className="flex flex-col gap-3">
          {pairs.map((pair) => <CookieCard key={pair.key} pair={pair} />)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          The stored cookie headers could not be parsed.
        </p>
      )}
    </section>
  )
}
