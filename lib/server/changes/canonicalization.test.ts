import { describe, expect, it } from "vitest";

import {
  canonicalizeEndpoint,
  canonicalizeResponseHeaders,
  stableFingerprint,
  stableSerialize,
} from "@/lib/server/changes/canonicalization";

describe("canonicalizeEndpoint", () => {
  it("normalizes scheme, host, default port, path, and ignores query parameters", () => {
    expect(canonicalizeEndpoint({ url: "HTTPS://Example.COM:443/a/path?nonce=1#section" })).toBe(
      "https://example.com/a/path",
    );
    expect(canonicalizeEndpoint({ scheme: "http", host: "EXAMPLE.com.", port: "80", path: "health" })).toBe(
      "http://example.com/health",
    );
  });

  it("uses the probed URL rather than a redirect destination", () => {
    expect(
      canonicalizeEndpoint({
        url: "https://example.test/old",
        finalUrl: "https://example.test/new",
      }),
    ).toBe("https://example.test/old");
  });

  it("falls back to a final URL for legacy rows and rejects unusable rows", () => {
    expect(canonicalizeEndpoint({ finalUrl: "https://example.test/final" })).toBe("https://example.test/final");
    expect(canonicalizeEndpoint({ host: "example.test", path: "/" })).toBeNull();
  });
});

describe("canonicalizeResponseHeaders", () => {
  it("is insensitive to header casing, object order, repeated-value order, and whitespace", () => {
    const left = canonicalizeResponseHeaders({
      "Content-Type": " text/html;  charset=utf-8 ",
      Vary: ["Accept-Encoding", "Origin"],
    });
    const right = canonicalizeResponseHeaders({
      vary: ["Origin", "Accept-Encoding"],
      "content-type": "text/html; charset=utf-8",
    });

    expect(left.strict.fingerprint).toBe(right.strict.fingerprint);
    expect(left.semantic.fingerprint).toBe(right.semantic.fingerprint);
  });

  it("keeps volatile values in strict fingerprints but excludes them from semantic fingerprints", () => {
    const left = canonicalizeResponseHeaders({
      Date: "Wed, 01 Jan 2025 00:00:00 GMT",
      "X-Request-ID": "one",
      x_vercel_id: "iad1::one",
    });
    const right = canonicalizeResponseHeaders({
      date: "Wed, 01 Jan 2025 00:01:00 GMT",
      "x-request-id": "two",
      "x-vercel-id": "iad1::two",
    });

    expect(left.strict.fingerprint).not.toBe(right.strict.fingerprint);
    expect(left.semantic.fingerprint).toBe(right.semantic.fingerprint);
    expect(left.strict.names).toContain("x-vercel-id");
    expect(left.strict.names).not.toContain("x_vercel_id");
  });

  it("does not include cookie values or rotating expiry values in the semantic fingerprint", () => {
    const left = canonicalizeResponseHeaders({
      Set_Cookie: "session=secret-one; Secure; HttpOnly; Expires=Wed, 01 Jan 2025 00:00:00 GMT",
    });
    const right = canonicalizeResponseHeaders({
      "set-cookie": "session=secret-two; Expires=Thu, 02 Jan 2025 00:00:00 GMT; HttpOnly; Secure",
    });

    expect(left.strict.fingerprint).not.toBe(right.strict.fingerprint);
    expect(left.semantic.fingerprint).toBe(right.semantic.fingerprint);
    expect(left.semantic.fingerprintsByName["set-cookie"]).toBe(right.semantic.fingerprintsByName["set-cookie"]);
  });

  it("separates combined cookies before removing rotating values", () => {
    const left = canonicalizeResponseHeaders({
      set_cookie: "consent=yes; Path=/; Secure, anonymous=first; Path=/; Max-Age=60; SameSite=Lax",
    });
    const right = canonicalizeResponseHeaders({
      "set-cookie": "consent=no; Path=/; Secure, anonymous=second; Path=/; Max-Age=60; SameSite=Lax",
    });

    expect(left.strict.fingerprint).not.toBe(right.strict.fingerprint);
    expect(left.semantic.fingerprint).toBe(right.semantic.fingerprint);
    expect(left.semantic.fingerprintsByName["set-cookie"]).toBe(right.semantic.fingerprintsByName["set-cookie"]);
  });

  it("retains meaningful Max-Age policy changes", () => {
    const persistent = canonicalizeResponseHeaders({
      "set-cookie": "session=first; Path=/; Max-Age=86400",
    });
    const expired = canonicalizeResponseHeaders({
      "set-cookie": "session=second; Path=/; Max-Age=0",
    });

    expect(persistent.semantic.fingerprint).not.toBe(expired.semantic.fingerprint);
  });

  it("retains cookie policy changes across combined cookies", () => {
    const left = canonicalizeResponseHeaders({
      "set-cookie": "consent=yes; Path=/; Secure, anonymous=first; Path=/; SameSite=Lax",
    });
    const right = canonicalizeResponseHeaders({
      "set-cookie": "consent=no; Path=/; Secure, anonymous=second; Path=/; SameSite=Strict",
    });

    expect(left.semantic.fingerprint).not.toBe(right.semantic.fingerprint);
  });

  it("ignores CSP nonce and directive ordering while retaining source changes", () => {
    const left = canonicalizeResponseHeaders({
      "content-security-policy": "default-src 'self'; script-src 'nonce-first' https://cdn.example.com",
    });
    const rotated = canonicalizeResponseHeaders({
      "content-security-policy": "script-src https://cdn.example.com 'nonce-second'; default-src 'self'",
    });
    const changedSource = canonicalizeResponseHeaders({
      "content-security-policy": "script-src https://other.example.com 'nonce-third'; default-src 'self'",
    });

    expect(left.strict.fingerprint).not.toBe(rotated.strict.fingerprint);
    expect(left.semantic.fingerprint).toBe(rotated.semantic.fingerprint);
    expect(left.semantic.fingerprint).not.toBe(changedSource.semantic.fingerprint);
  });

  it("separates coalesced CSP policies before normalizing nonce rotation", () => {
    const before = canonicalizeResponseHeaders({
      "content-security-policy": "require-trusted-types-for 'script'; report-uri /recaptcha/cspreport, script-src 'nonce-before' 'unsafe-inline'; object-src 'none'; base-uri www.google.com; report-uri /_/cspreport",
    });
    const rotated = canonicalizeResponseHeaders({
      "content-security-policy": "require-trusted-types-for 'script'; report-uri /recaptcha/cspreport, script-src 'nonce-after' 'unsafe-inline'; object-src 'none'; base-uri www.google.com; report-uri /_/cspreport",
    });
    const changedSource = canonicalizeResponseHeaders({
      "content-security-policy": "require-trusted-types-for 'script'; report-uri /recaptcha/cspreport, script-src 'nonce-after' 'unsafe-inline' https://cdn.example.com; object-src 'none'; base-uri www.google.com; report-uri /_/cspreport",
    });

    expect(before.strict.fingerprint).not.toBe(rotated.strict.fingerprint);
    expect(before.semantic.fingerprint).toBe(rotated.semantic.fingerprint);
    expect(before.semantic.fingerprint).not.toBe(changedSource.semantic.fingerprint);
  });

  it("ignores one-for-one CSP hash rotation while retaining policy changes", () => {
    const sha256Before = `'sha256-${"A".repeat(43)}='`;
    const sha256After = `'sha256-${"B".repeat(43)}='`;
    const sha384Before = `'sha384-${"C".repeat(64)}'`;
    const sha384After = `'sha384-${"D".repeat(64)}'`;
    const before = canonicalizeResponseHeaders({
      "content-security-policy": `script-src 'self' ${sha256Before}; style-src ${sha384Before}`,
    });
    const rotated = canonicalizeResponseHeaders({
      "content-security-policy": `style-src ${sha384After}; script-src ${sha256After} 'self'`,
    });
    const addedHash = canonicalizeResponseHeaders({
      "content-security-policy": `script-src 'self' ${sha256After} 'sha256-${"E".repeat(43)}='; style-src ${sha384After}`,
    });
    const changedAlgorithm = canonicalizeResponseHeaders({
      "content-security-policy": `script-src 'self' 'sha384-${"F".repeat(64)}'; style-src ${sha384After}`,
    });
    const weakened = canonicalizeResponseHeaders({
      "content-security-policy": `script-src 'self' 'unsafe-inline' ${sha256After}; style-src ${sha384After}`,
    });

    expect(before.strict.fingerprint).not.toBe(rotated.strict.fingerprint);
    expect(before.semantic.fingerprint).toBe(rotated.semantic.fingerprint);
    expect(before.semantic.fingerprint).not.toBe(addedHash.semantic.fingerprint);
    expect(before.semantic.fingerprint).not.toBe(changedAlgorithm.semantic.fingerprint);
    expect(before.semantic.fingerprint).not.toBe(weakened.semantic.fingerprint);
  });

  it("does not normalize malformed CSP hash sources", () => {
    const left = canonicalizeResponseHeaders({
      "content-security-policy": "script-src 'sha256-too-short'",
    });
    const right = canonicalizeResponseHeaders({
      "content-security-policy": "script-src 'sha256-still-too-short'",
    });

    expect(left.semantic.fingerprint).not.toBe(right.semantic.fingerprint);
  });

  it("normalizes cache directives and token-set headers", () => {
    const left = canonicalizeResponseHeaders({
      "cache-control": "public, max-age=60",
      vary: "Accept-Encoding, Origin",
    });
    const right = canonicalizeResponseHeaders({
      "Cache-Control": "max-age=60, public",
      Vary: "origin, accept-encoding",
    });

    expect(left.strict.fingerprint).not.toBe(right.strict.fingerprint);
    expect(left.semantic.fingerprint).toBe(right.semantic.fingerprint);
  });

  it("treats positive cache lifetime drift as routine but retains cache-policy boundaries", () => {
    const shortLived = canonicalizeResponseHeaders({
      "cache-control": "public, max-age=12, s-maxage=30",
    });
    const longLived = canonicalizeResponseHeaders({
      "cache-control": "s-maxage=3600, max-age=92, public",
    });
    const immediatelyExpired = canonicalizeResponseHeaders({
      "cache-control": "public, max-age=0, s-maxage=3600",
    });
    const notStored = canonicalizeResponseHeaders({
      "cache-control": "public, max-age=92, s-maxage=3600, no-store",
    });

    expect(shortLived.semantic.fingerprint).toBe(longLived.semantic.fingerprint);
    expect(longLived.semantic.fingerprint).not.toBe(immediatelyExpired.semantic.fingerprint);
    expect(longLived.semantic.fingerprint).not.toBe(notStored.semantic.fingerprint);
  });

  it("compares Expires as a TTL and ignores it when Cache-Control overrides it", () => {
    const ttlLeft = canonicalizeResponseHeaders({
      date: "Wed, 01 Jan 2025 00:00:00 GMT",
      expires: "Wed, 01 Jan 2025 01:00:00 GMT",
    });
    const ttlRight = canonicalizeResponseHeaders({
      date: "Thu, 02 Jan 2025 00:00:00 GMT",
      expires: "Thu, 02 Jan 2025 01:00:00 GMT",
    });
    const overriddenLeft = canonicalizeResponseHeaders({
      "cache-control": "max-age=60",
      expires: "Wed, 01 Jan 2025 01:00:00 GMT",
    });
    const overriddenRight = canonicalizeResponseHeaders({
      "cache-control": "max-age=60",
      expires: "Thu, 02 Jan 2025 01:00:00 GMT",
    });

    expect(ttlLeft.semantic.fingerprint).toBe(ttlRight.semantic.fingerprint);
    expect(overriddenLeft.semantic.fingerprint).toBe(overriddenRight.semantic.fingerprint);
    expect(overriddenLeft.semantic.names).not.toContain("expires");
  });

  it("ignores Alt-Svc freshness while retaining service changes", () => {
    const left = canonicalizeResponseHeaders({ "alt-svc": 'h3=":443"; ma=3600' });
    const refreshed = canonicalizeResponseHeaders({ "alt-svc": 'h3=":443"; ma=86400' });
    const changedService = canonicalizeResponseHeaders({ "alt-svc": 'h2=":443"; ma=86400' });

    expect(left.semantic.fingerprint).toBe(refreshed.semantic.fingerprint);
    expect(left.semantic.fingerprint).not.toBe(changedService.semantic.fingerprint);
  });

  it("treats HTTP/3 draft Alt-Svc variants as aliases while retaining availability changes", () => {
    const stableAndDraft = canonicalizeResponseHeaders({
      "alt-svc": 'h3=":443"; ma=2592000, h3-29=":443"; ma=2592000',
    });
    const stableOnly = canonicalizeResponseHeaders({ "alt-svc": 'h3=":443"; ma=2592000' });
    const absent = canonicalizeResponseHeaders({});
    const otherAuthority = canonicalizeResponseHeaders({ "alt-svc": 'h3=":8443"; ma=2592000' });

    expect(stableAndDraft.semantic.fingerprint).toBe(stableOnly.semantic.fingerprint);
    expect(absent.semantic.fingerprint).not.toBe(stableOnly.semantic.fingerprint);
    expect(stableOnly.semantic.fingerprint).not.toBe(otherAuthority.semantic.fingerprint);
  });

  it("compares Content-Language by primary language while retaining language changes", () => {
    const generalEnglish = canonicalizeResponseHeaders({ "content-language": "en" });
    const regionalEnglish = canonicalizeResponseHeaders({ "content-language": "en-US" });
    const britishAndFrench = canonicalizeResponseHeaders({ "content-language": "en-GB, fr-FR" });
    const englishAndFrench = canonicalizeResponseHeaders({ "content-language": "fr, en" });
    const french = canonicalizeResponseHeaders({ "content-language": "fr" });

    expect(generalEnglish.semantic.fingerprint).toBe(regionalEnglish.semantic.fingerprint);
    expect(britishAndFrench.semantic.fingerprint).toBe(englishAndFrench.semantic.fingerprint);
    expect(generalEnglish.semantic.fingerprint).not.toBe(french.semantic.fingerprint);
  });

  it("keeps representation validators in strict evidence but excludes them from semantic changes", () => {
    const left = canonicalizeResponseHeaders({ etag: 'W/"before"', "content-length": "100" });
    const right = canonicalizeResponseHeaders({ etag: 'W/"after"', "content-length": "200" });

    expect(left.strict.fingerprint).not.toBe(right.strict.fingerprint);
    expect(left.semantic.fingerprint).toBe(right.semantic.fingerprint);
    expect(left.strict.names).toEqual(["content-length", "etag"]);
    expect(left.semantic.names).toEqual([]);
  });

  it("treats a bare inline content disposition like an absent header", () => {
    const absent = canonicalizeResponseHeaders({ "content-type": "text/html" });
    const inline = canonicalizeResponseHeaders({
      "content-type": "text/html",
      "content-disposition": "Inline",
    });
    const namedInline = canonicalizeResponseHeaders({
      "content-type": "text/html",
      "content-disposition": 'inline; filename="index.html"',
    });
    const attachment = canonicalizeResponseHeaders({
      "content-type": "text/html",
      "content-disposition": "attachment",
    });

    expect(absent.strict.fingerprint).not.toBe(inline.strict.fingerprint);
    expect(absent.semantic.fingerprint).toBe(inline.semantic.fingerprint);
    expect(absent.semantic.fingerprint).not.toBe(namedInline.semantic.fingerprint);
    expect(absent.semantic.fingerprint).not.toBe(attachment.semantic.fingerprint);
  });

  it("merges underscore and hyphen spellings of the same header", () => {
    const headers = canonicalizeResponseHeaders({
      content_type: "text/html",
      "content-type": "application/json",
    });

    expect(headers.strict.names).toEqual(["content-type"]);
  });

  it("ignores Report-To JSON order and rotating signed endpoint tokens", () => {
    const left = canonicalizeResponseHeaders({
      "report-to": JSON.stringify({
        group: "page-errors",
        max_age: 86_400,
        endpoints: [{ url: "https://reports.example.com/csp?t=abcdefghijklmnopqrstuvwxyz.123456789" }],
      }),
    });
    const right = canonicalizeResponseHeaders({
      "Report-To": JSON.stringify({
        endpoints: [{ url: "https://reports.example.com/csp?t=zyxwvutsrqponmlkjihgfedcba.987654321" }],
        max_age: 86_400,
        group: "page-errors",
      }),
    });

    expect(left.strict.fingerprint).not.toBe(right.strict.fingerprint);
    expect(left.semantic.fingerprint).toBe(right.semantic.fingerprint);
  });

  it("keeps meaningful Report-To destination changes", () => {
    const left = canonicalizeResponseHeaders({
      "report-to": '{"group":"page-errors","endpoints":[{"url":"https://reports.example.com/csp?t=abcdefghijklmnopqrstuvwxyz"}]}',
    });
    const right = canonicalizeResponseHeaders({
      "report-to": '{"group":"page-errors","endpoints":[{"url":"https://other.example.com/csp?t=zyxwvutsrqponmlkjihgfedcba"}]}',
    });

    expect(left.semantic.fingerprint).not.toBe(right.semantic.fingerprint);
  });

  it("ignores Cloudflare NEL s-token rotation without ignoring s globally", () => {
    const baseline = canonicalizeResponseHeaders({
      "report-to": JSON.stringify({
        group: "cf-nel",
        max_age: 604_800,
        endpoints: [{
          url: "https://a.nel.cloudflare.com/report/v4?s=O27fPabR6HfMflpYakVvC%2BWnIdZVTV%2F2yaSDpABPu8FTn6CfhXdEpSyiNzJNdLzaxw%3D",
        }],
      }),
    });
    const rotated = canonicalizeResponseHeaders({
      "report-to": JSON.stringify({
        group: "cf-nel",
        max_age: 604_800,
        endpoints: [{
          url: "https://a.nel.cloudflare.com/report/v4?s=as1hKUB79lNIWns1xe3USCQiR7KQQqM7k9xDvtHOVlyTb9W8j50lA5hRXLgQBJm8dgEtBUClrqoC3%2FZr3lSg%3D",
        }],
      }),
    });
    const otherCollector = canonicalizeResponseHeaders({
      "report-to": JSON.stringify({
        group: "cf-nel",
        max_age: 604_800,
        endpoints: [{
          url: "https://reports.example.com/report/v4?s=as1hKUB79lNIWns1xe3USCQiR7KQQqM7k9xDvtHOVlyTb9W8j50lA5hRXLgQBJm8dgEtBUClrqoC3%2FZr3lSg%3D",
        }],
      }),
    });

    expect(baseline.strict.fingerprint).not.toBe(rotated.strict.fingerprint);
    expect(baseline.semantic.fingerprint).toBe(rotated.semantic.fingerprint);
    expect(baseline.semantic.fingerprint).not.toBe(otherCollector.semantic.fingerprint);
  });

  it("normalizes Reporting-Endpoints dictionary order and rotating tokens", () => {
    const left = canonicalizeResponseHeaders({
      "reporting-endpoints": 'default="https://reports.example.com/default", csp="/csp?t=abcdefghijklmnopqrstuvwxyz.123456789"',
    });
    const right = canonicalizeResponseHeaders({
      "reporting-endpoints": 'csp="/csp?t=zyxwvutsrqponmlkjihgfedcba.987654321", default="https://reports.example.com/default"',
    });

    expect(left.strict.fingerprint).not.toBe(right.strict.fingerprint);
    expect(left.semantic.fingerprint).toBe(right.semantic.fingerprint);
  });

  it("normalizes opaque Stripe collector values with generic query names", () => {
    const left = canonicalizeResponseHeaders({
      "reporting-endpoints": 'default="https://q.stripe.com/reports?q=Fe-YfA9P2mQu5VR7D8yxEw%3D%3D&s=16Fhm3sNbMqvY7GzX9Q2Dg%3D%3D"',
    });
    const rotated = canonicalizeResponseHeaders({
      "reporting-endpoints": 'default="https://q.stripe.com/reports?q=Uf3XzQ8HaB7sL1mV9R4pKg%3D%3D&s=89Bpq7Vc2Xs6Nw1Gd4LmTQ%3D%3D"',
    });
    const rerouted = canonicalizeResponseHeaders({
      "reporting-endpoints": 'default="https://q.stripe.com/other?q=Uf3XzQ8HaB7sL1mV9R4pKg%3D%3D&s=89Bpq7Vc2Xs6Nw1Gd4LmTQ%3D%3D"',
    });

    expect(left.strict.fingerprint).not.toBe(rotated.strict.fingerprint);
    expect(left.semantic.fingerprint).toBe(rotated.semantic.fingerprint);
    expect(left.semantic.fingerprint).not.toBe(rerouted.semantic.fingerprint);
  });

  it("normalizes long Instagram reporting IDs without hiding stable configuration values", () => {
    const left = canonicalizeResponseHeaders({
      "reporting-endpoints": 'default="https://www.instagram.com/security/report?brsid=7681079488214372901&st=1788390022846&cv=1046617997"',
    });
    const rotated = canonicalizeResponseHeaders({
      "reporting-endpoints": 'default="https://www.instagram.com/security/report?brsid=9864127700398854123&st=1788396688123&cv=1046617997"',
    });
    const reconfigured = canonicalizeResponseHeaders({
      "reporting-endpoints": 'default="https://www.instagram.com/security/report?brsid=9864127700398854123&st=1788396688123&cv=1046618001"',
    });

    expect(left.semantic.fingerprint).toBe(rotated.semantic.fingerprint);
    expect(left.semantic.fingerprint).not.toBe(reconfigured.semantic.fingerprint);
  });

  it("keeps Reporting-Endpoints names, hosts, paths, and stable query values", () => {
    const baseline = canonicalizeResponseHeaders({
      "reporting-endpoints": 'csp="https://reports.example.com/csp?environment=production&t=abcdefghijklmnopqrstuvwxyz"',
    });
    const renamed = canonicalizeResponseHeaders({
      "reporting-endpoints": 'errors="https://reports.example.com/csp?environment=production&t=zyxwvutsrqponmlkjihgfedcba"',
    });
    const rerouted = canonicalizeResponseHeaders({
      "reporting-endpoints": 'csp="https://reports.example.com/other?environment=production&t=zyxwvutsrqponmlkjihgfedcba"',
    });
    const reconfigured = canonicalizeResponseHeaders({
      "reporting-endpoints": 'csp="https://reports.example.com/csp?environment=staging&t=zyxwvutsrqponmlkjihgfedcba"',
    });

    expect(baseline.semantic.fingerprint).not.toBe(renamed.semantic.fingerprint);
    expect(baseline.semantic.fingerprint).not.toBe(rerouted.semantic.fingerprint);
    expect(baseline.semantic.fingerprint).not.toBe(reconfigured.semantic.fingerprint);
  });

  it("ignores rotating report-uri tokens while retaining CSP policy changes", () => {
    const left = canonicalizeResponseHeaders({
      "content-security-policy-report-only": "script-src 'none'; report-uri /csp?t=abcdefghijklmnopqrstuvwxyz.123456789; report-to page-errors",
    });
    const rotated = canonicalizeResponseHeaders({
      "content-security-policy-report-only": "script-src 'none'; report-uri /csp?t=zyxwvutsrqponmlkjihgfedcba.987654321; report-to page-errors",
    });
    const changedPolicy = canonicalizeResponseHeaders({
      "content-security-policy-report-only": "script-src 'self'; report-uri /csp?t=zyxwvutsrqponmlkjihgfedcba.987654321; report-to page-errors",
    });

    expect(left.strict.fingerprint).not.toBe(rotated.strict.fingerprint);
    expect(left.semantic.fingerprint).toBe(rotated.semantic.fingerprint);
    expect(left.semantic.fingerprint).not.toBe(changedPolicy.semantic.fingerprint);
  });

  it("falls back to exact values for malformed reporting headers", () => {
    const left = canonicalizeResponseHeaders({
      "report-to": "{not-json-one}",
      "reporting-endpoints": 'csp="unterminated',
    });
    const right = canonicalizeResponseHeaders({
      "report-to": "{not-json-two}",
      "reporting-endpoints": 'csp="still-unterminated',
    });

    expect(left.semantic.fingerprint).not.toBe(right.semantic.fingerprint);
  });
});

describe("stable serialization", () => {
  it("produces the same fingerprint for objects with different key order", () => {
    expect(stableSerialize({ z: 1, nested: { b: 2, a: 1 } })).toBe('{"nested":{"a":1,"b":2},"z":1}');
    expect(stableFingerprint({ a: 1, b: 2 })).toBe(stableFingerprint({ b: 2, a: 1 }));
  });
});
