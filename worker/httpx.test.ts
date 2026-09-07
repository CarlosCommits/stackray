// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  BROWSER_LIKE_ADDITIONAL_HEADERS,
  BROWSER_LIKE_HEADERS,
  buildHttpxArguments,
  CUSTOM_WAPPALYZER_FINGERPRINTS_PATH,
  STABLE_HTTP_USER_AGENT_HEADER,
} from "./httpx.ts";

function scanWithOptions(optionsJson: Record<string, unknown>) {
  return { optionsJson } as typeof import("../drizzle/schema.ts").scans.$inferSelect;
}

const baseHttpxArgs = [
  "-silent",
  "-json",
  "-irh",
  "-stream",
  "-td",
  "-cff",
  CUSTOM_WAPPALYZER_FINGERPRINTS_PATH,
  "-title",
  "-sc",
  "-cl",
  "-ct",
  "-rt",
  "-location",
  "-server",
  "-wp",
  "-cpe",
  "-favicon",
  "-jarm",
  "-cdn",
  "-ip",
  "-cname",
  "-asn",
  "-tls-grab",
  "-hash",
  "md5,mmh3,sha256,simhash",
  "-extract-fqdn",
  "-include-chain",
];

describe("buildHttpxArguments exact CLI contract", () => {
  it("builds the baseline httpx argument array in scanner order", () => {
    expect(buildHttpxArguments(scanWithOptions({}))).toEqual([
      ...baseHttpxArgs,
      "-fr",
      "-random-agent=false",
      "-H",
      STABLE_HTTP_USER_AGENT_HEADER,
    ]);
  });

  it("appends raw response storage after redirect behavior", () => {
    expect(buildHttpxArguments(scanWithOptions({ includeRawResponse: true }))).toEqual([
      ...baseHttpxArgs,
      "-fr",
      "-sr",
      "-random-agent=false",
      "-H",
      STABLE_HTTP_USER_AGENT_HEADER,
    ]);
  });

  it("removes redirect following when disabled by scan options or request profile", () => {
    expect(buildHttpxArguments(scanWithOptions({ followRedirects: false }))).toEqual([
      ...baseHttpxArgs,
      "-random-agent=false",
      "-H",
      STABLE_HTTP_USER_AGENT_HEADER,
    ]);

    expect(buildHttpxArguments(
      scanWithOptions({}),
      { browserLikeHeaders: false, followRedirects: false },
    )).toEqual([
      ...baseHttpxArgs,
      "-random-agent=false",
      "-H",
      STABLE_HTTP_USER_AGENT_HEADER,
    ]);
  });

  it("appends browser-like headers as ordered -H pairs", () => {
    expect(buildHttpxArguments(
      scanWithOptions({}),
      { browserLikeHeaders: true, followRedirects: null },
    )).toEqual([
      ...baseHttpxArgs,
      "-fr",
      "-random-agent=false",
      "-H",
      STABLE_HTTP_USER_AGENT_HEADER,
      ...BROWSER_LIKE_ADDITIONAL_HEADERS.flatMap((header) => ["-H", header]),
    ]);
  });

  it("keeps the full browser header profile on one shared stable user agent", () => {
    expect(BROWSER_LIKE_HEADERS).toEqual([
      STABLE_HTTP_USER_AGENT_HEADER,
      ...BROWSER_LIKE_ADDITIONAL_HEADERS,
    ]);
  });
});
