const SET_COOKIE_BOUNDARY = /,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/g
const MAX_AGE_CLOCK_SKEW_SECONDS = 5

export type ParsedSetCookie = {
  name: string
  value: string
  attributes: Record<string, string | true>
  raw: string
}

export function splitCombinedSetCookieHeader(value: string) {
  return value
    .split(SET_COOKIE_BOUNDARY)
    .map((cookie) => cookie.trim())
    .filter(Boolean)
}

export function parseSetCookie(value: string): ParsedSetCookie | null {
  const [cookiePair = "", ...rawAttributes] = value.split(";")
  const separator = cookiePair.indexOf("=")
  const name = separator === -1 ? "" : cookiePair.slice(0, separator).trim()

  if (!name) return null

  const attributes: Record<string, string | true> = {}
  for (const rawAttribute of rawAttributes) {
    const [rawName, ...rawValue] = rawAttribute.trim().split("=")
    const attributeName = rawName?.trim().toLowerCase()
    if (!attributeName) continue

    const attributeValue = rawValue.join("=").trim()
    attributes[attributeName] = attributeValue || true
  }

  return {
    name,
    value: cookiePair.slice(separator + 1).trim(),
    attributes,
    raw: value.trim(),
  }
}

export function parseSetCookieHeaderValues(values: readonly string[]) {
  return values.flatMap((value) =>
    splitCombinedSetCookieHeader(value).flatMap((cookie) => {
      const parsed = parseSetCookie(cookie)
      return parsed ? [parsed] : []
    }),
  )
}

export function canonicalizeSetCookieForComparison(value: string) {
  const parsed = parseSetCookie(value)
  if (!parsed) return value.trim()

  const attributes = Object.entries(parsed.attributes).map(([name, rawValue]) => {
    if (name === "expires") return name
    if (name === "max-age") {
      if (rawValue === true) return name

      const normalizedValue = rawValue.trim()
      if (/^[+-]?\d+$/.test(normalizedValue)) {
        const seconds = Number(normalizedValue)
        if (Number.isSafeInteger(seconds)) {
          return `${name}=${seconds <= 0 ? "expired" : seconds}`
        }
      }

      return `${name}=${normalizedValue}`
    }
    if (rawValue === true) return name

    const normalizedValue = name === "domain" || name === "samesite"
      ? rawValue.toLowerCase()
      : rawValue
    return `${name}=${normalizedValue}`
  })

  return [parsed.name, ...attributes.toSorted()].join(";")
}

function comparableAttributeValue(name: string, value: string | true) {
  if (value === true) return true

  return name === "domain" || name === "samesite"
    ? value.toLowerCase()
    : value
}

function maxAgeValuesMatch(before: string | true | undefined, after: string | true | undefined) {
  if (before === undefined || after === undefined) return before === after
  if (before === true || after === true) return before === after

  const beforeSeconds = /^[+-]?\d+$/.test(before.trim()) ? Number(before) : Number.NaN
  const afterSeconds = /^[+-]?\d+$/.test(after.trim()) ? Number(after) : Number.NaN

  if (!Number.isSafeInteger(beforeSeconds) || !Number.isSafeInteger(afterSeconds)) {
    return before.trim() === after.trim()
  }

  if (beforeSeconds <= 0 || afterSeconds <= 0) {
    return beforeSeconds <= 0 && afterSeconds <= 0
  }

  return Math.abs(beforeSeconds - afterSeconds) <= MAX_AGE_CLOCK_SKEW_SECONDS
}

function parsedCookiesMatch(before: ParsedSetCookie, after: ParsedSetCookie) {
  if (before.name !== after.name) return false

  const beforeAttributeNames = Object.keys(before.attributes)
    .filter((name) => name !== "expires")
    .toSorted()
  const afterAttributeNames = Object.keys(after.attributes)
    .filter((name) => name !== "expires")
    .toSorted()

  if (beforeAttributeNames.join("\0") !== afterAttributeNames.join("\0")) return false

  return beforeAttributeNames.every((name) => {
    const beforeValue = before.attributes[name]
    const afterValue = after.attributes[name]

    if (name === "max-age") return maxAgeValuesMatch(beforeValue, afterValue)

    return beforeValue !== undefined
      && afterValue !== undefined
      && comparableAttributeValue(name, beforeValue) === comparableAttributeValue(name, afterValue)
  })
}

export function setCookieHeaderValuesMatch(
  beforeValues: readonly string[],
  afterValues: readonly string[],
) {
  const beforeCookies = beforeValues.flatMap(splitCombinedSetCookieHeader).map(parseSetCookie)
  const afterCookies = afterValues.flatMap(splitCombinedSetCookieHeader).map(parseSetCookie)

  if (
    beforeCookies.length !== afterCookies.length
    || beforeCookies.some((cookie) => cookie === null)
    || afterCookies.some((cookie) => cookie === null)
  ) {
    return false
  }

  const unmatched = new Set(afterCookies.map((_, index) => index))
  for (const beforeCookie of beforeCookies) {
    if (!beforeCookie) return false

    const match = [...unmatched].find((index) => {
      const afterCookie = afterCookies[index]
      return afterCookie !== null && parsedCookiesMatch(beforeCookie, afterCookie)
    })

    if (match === undefined) return false
    unmatched.delete(match)
  }

  return true
}
