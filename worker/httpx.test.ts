// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  BROWSER_LIKE_HEADERS,
  buildHttpxArguments,
  CUSTOM_WAPPALYZER_FINGERPRINTS_PATH,
} from "./httpx.ts";

function scanWithOptions(optionsJson: Record<string, unknown>) {
  return { optionsJson } as typeof import("../drizzle/schema.ts").scans.$inferSelect;
}

const baseHttpxArgs = [
  "-silent",
  "-json",
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
  "md5,mmh3,sha256",
  "-extract-fqdn",
  "-include-chain",
];

describe("buildHttpxArguments exact CLI contract", () => {
  it("builds the baseline httpx argument array in scanner order", () => {
    expect(buildHttpxArguments(scanWithOptions({}))).toEqual([
      ...baseHttpxArgs,
      "-fr",
    ]);
  });

  it("appends raw response storage after redirect behavior", () => {
    expect(buildHttpxArguments(scanWithOptions({ includeRawResponse: true }))).toEqual([
      ...baseHttpxArgs,
      "-fr",
      "-sr",
    ]);
  });

  it("removes redirect following when disabled by scan options or request profile", () => {
    expect(buildHttpxArguments(scanWithOptions({ followRedirects: false }))).toEqual(baseHttpxArgs);

    expect(buildHttpxArguments(
      scanWithOptions({}),
      { browserLikeHeaders: false, followRedirects: false },
    )).toEqual(baseHttpxArgs);
  });

  it("appends browser-like headers as ordered -H pairs", () => {
    expect(buildHttpxArguments(
      scanWithOptions({}),
      { browserLikeHeaders: true, followRedirects: null },
    )).toEqual([
      ...baseHttpxArgs,
      "-fr",
      ...BROWSER_LIKE_HEADERS.flatMap((header) => ["-H", header]),
    ]);
  });
});
