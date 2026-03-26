type RedirectHopRecord = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseResponseTimeMs(value: unknown) {
  const numeric = asNumber(value);

  if (numeric !== undefined) {
    return Math.round(numeric);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.trim().match(/^(\d+(?:\.\d+)?)ms$/i);

  if (!match) {
    return undefined;
  }

  return Math.round(Number.parseFloat(match[1]!));
}

export function normalizeRedirectChainItems(items: unknown[], statusCodes: number[]) {
  return items.map((item, index) => {
    const record: RedirectHopRecord = item && typeof item === "object" ? (item as RedirectHopRecord) : {};

    return {
      url: asString(record.url) ?? asString(record.requestUrl) ?? asString(record["request-url"]),
      statusCode: asNumber(record.statusCode) ?? asNumber(record.status_code) ?? statusCodes[index],
      location: asString(record.location) ?? null,
      contentLength: asNumber(record.contentLength) ?? asNumber(record.content_length),
      responseTimeMs:
        parseResponseTimeMs(record.responseTimeMs) ??
        parseResponseTimeMs(record.response_time) ??
        parseResponseTimeMs(record["response-time"]),
    };
  });
}
