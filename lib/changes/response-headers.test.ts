import { describe, expect, it } from "vitest";

import {
  getResponseHeaderRule,
  isIgnoredResponseHeader,
  isVolatileResponseHeader,
  normalizeResponseHeaderName,
} from "./response-headers";

describe("response header registry", () => {
  it("normalizes scanner underscore spellings", () => {
    expect(normalizeResponseHeaderName(" X_Vercel_ID ")).toBe("x-vercel-id");
    expect(getResponseHeaderRule("X_Vercel_ID")).toMatchObject({
      disposition: "routine",
      alertBehavior: "never",
    });
  });

  it("assigns semantic comparators to meaningful policy headers", () => {
    expect(getResponseHeaderRule("Content-Security-Policy")).toMatchObject({
      family: "security",
      comparator: "content-security-policy",
      disposition: "meaningful",
      alertBehavior: "semantic",
    });
    expect(getResponseHeaderRule("Set-Cookie")).toMatchObject({
      family: "cookie",
      comparator: "set-cookie",
      disposition: "meaningful",
    });
    expect(getResponseHeaderRule("Accept-CH")).toMatchObject({
      family: "content",
      comparator: "token-set",
      disposition: "meaningful",
      alertBehavior: "semantic",
    });
  });

  it("keeps reporting-only plumbing visible but non-alerting", () => {
    for (const name of [
      "Content-Security-Policy-Report-Only",
      "Report-To",
      "Reporting-Endpoints",
      "NEL",
    ]) {
      expect(getResponseHeaderRule(name)).toMatchObject({
        disposition: "meaningful",
        alertBehavior: "never",
      });
    }
  });

  it("classifies operational identifier patterns as routine", () => {
    expect(getResponseHeaderRule("x-provider-request-id").disposition).toBe("routine");
    expect(getResponseHeaderRule("x-edge-ray").disposition).toBe("routine");
    expect(isVolatileResponseHeader("x-provider-trace-id")).toBe(true);
  });

  it("keeps representation metadata and unknown fields non-alerting", () => {
    expect(getResponseHeaderRule("ETag").disposition).toBe("representation");
    expect(getResponseHeaderRule("x-example-release")).toMatchObject({
      family: "unknown",
      disposition: "unknown",
      alertBehavior: "never",
    });
    expect(isIgnoredResponseHeader("etag")).toBe(true);
  });

  it("classifies observed provider diagnostics and server aliases", () => {
    for (const name of [
      "x-fb-debug",
      "x-fb-connection-quality",
      "shopify-complexity-score",
      "shopify-complexity-score-v2",
      "x-stripe-server-rpc-duration-micros",
      "x-vercel-challenge-token",
      "x-slack-unique-id",
      "x-contextid",
      "x-cm-cache-status",
      "x-uber-edge",
    ]) {
      expect(getResponseHeaderRule(name)).toMatchObject({
        disposition: "routine",
        alertBehavior: "never",
      });
    }

    expect(getResponseHeaderRule("x-server")).toMatchObject({
      disposition: "representation",
      alertBehavior: "never",
    });
  });
});
