import { describe, expect, it } from "vitest";

import {
  collectChangedIpRecordAddresses,
  compareScanResults,
  type CompareScanResultsInput,
  type ComparableScanResult,
} from "@/lib/server/changes/compare-scan-results";

function result(overrides: Partial<ComparableScanResult> = {}): ComparableScanResult {
  return {
    id: "result-default",
    url: "https://example.test/",
    finalUrl: "https://example.test/",
    statusCode: 200,
    title: "Example",
    webServer: "nginx",
    contentType: "text/html",
    contentLength: 1_000,
    location: null,
    redirectChainStatusCodes: [],
    redirectChainJson: [],
    responseHeadersJson: { "content-type": "text/html", date: "one" },
    hashesJson: { body_md5: "body-one", body_mmh3: "100", body_sha256: "sha-one", body_simhash: "9000" },
    faviconMd5: "favicon-one",
    faviconMmh3: "200",
    faviconUrl: "https://example.test/favicon.ico",
    hostIp: "192.0.2.1",
    dnsARecords: ["192.0.2.1"],
    dnsAaaaRecords: [],
    dnsCnameRecords: [],
    tlsJson: { subject_cn: "example.test", issuer_cn: "Example CA" },
    jarmHash: "jarm-one",
    technologies: ["nginx"],
    technologyDetections: [],
    cpe: ["cpe:2.3:a:nginx:nginx:1.0:*:*:*:*:*:*:*"],
    cdn: false,
    cdnName: null,
    cdnType: null,
    http2: true,
    pipeline: false,
    websocket: false,
    vhost: false,
    ...overrides,
  };
}

function compare(
  before: ComparableScanResult,
  after: ComparableScanResult,
  options: Pick<CompareScanResultsInput, "ipNetworkIdentities" | "maxChangeItems"> = {},
) {
  return compareScanResults({
    baseline: { results: [before] },
    current: { results: [after] },
    ...options,
  });
}

describe("compareScanResults", () => {
  it("collects changed IPv4 and IPv6 addresses without enriching stable endpoints", () => {
    const unchanged = result({
      id: "stable-before",
      url: "https://stable.example/",
      dnsARecords: ["192.0.2.10"],
      dnsAaaaRecords: ["2001:db8::10"],
    });
    const before = result({
      id: "changed-before",
      url: "https://changed.example/",
      dnsARecords: ["64.239.109.1"],
      dnsAaaaRecords: ["2600:9000:2509:1600:2:d4d8:1880:93a1"],
    });
    const after = result({
      id: "changed-after",
      url: "https://changed.example/",
      dnsARecords: ["64.239.123.1"],
      dnsAaaaRecords: ["2600:9000:2509:2000:2:d4d8:1880:93a1"],
    });

    expect(collectChangedIpRecordAddresses(
      { results: [unchanged, before] },
      { results: [{ ...unchanged, id: "stable-after" }, after] },
    )).toEqual([
      "2600:9000:2509:1600:2:d4d8:1880:93a1",
      "2600:9000:2509:2000:2:d4d8:1880:93a1",
      "64.239.109.1",
      "64.239.123.1",
    ]);
  });

  it("uses only SimHash to detect response body changes", () => {
    const output = compare(
      result(),
      result({
        hashesJson: { body_md5: "body-two", body_mmh3: "101", body_sha256: "sha-two", body_simhash: "8999" },
      }),
    );
    const bodyItems = output.items.filter((item) => item.type === "body_fingerprint.changed");

    expect(bodyItems).toHaveLength(1);
    expect(bodyItems[0]).toMatchObject({
      alertEligible: true,
      before: { algorithm: "simhash", hashes: { body_simhash: "9000" } },
      after: { algorithm: "simhash", hashes: { body_simhash: "8999" } },
    });
  });

  it("ignores near-identical response bodies within HTTPX's SimHash distance", () => {
    const output = compare(
      result({ hashesJson: { body_sha256: "one", body_simhash: "9000" } }),
      result({ hashesJson: { body_sha256: "two", body_simhash: "9001" } }),
    );

    expect(output.items.map((item) => item.type)).not.toContain("body_fingerprint.changed");
  });

  it("ignores exact hash churn when SimHash is stable", () => {
    const output = compare(
      result({ hashesJson: { body_sha256: "one", body_simhash: "9000" } }),
      result({ hashesJson: { body_sha256: "two", body_simhash: "9000" } }),
    );

    expect(output.items.map((item) => item.type)).not.toContain("body_fingerprint.changed");
  });

  it("waits for comparable SimHashes instead of falling back to exact hashes", () => {
    expect(compare(
      result({ hashesJson: { body_sha256: "one" } }),
      result({ hashesJson: { body_sha256: "two", body_simhash: "9001" } }),
    ).items.map((item) => item.type)).not.toContain("body_fingerprint.changed");
  });

  it("records strict-only header changes without making them alert eligible", () => {
    const strictOnly = compare(
      result({ responseHeadersJson: { date: "one", "x-request-id": "secret-one" } }),
      result({ responseHeadersJson: { date: "two", "x-request-id": "secret-two" } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const semantic = compare(
      result({ responseHeadersJson: { "content-security-policy": "default-src 'self'" } }),
      result({ responseHeadersJson: { "content-security-policy": "default-src https:" } }),
    ).items.find((item) => item.type === "response_headers.changed");

    expect(strictOnly).toMatchObject({
      alertEligible: false,
      after: {
        mode: "classified",
        changesByDisposition: {
          routine: { added: [], changed: ["date", "x-request-id"], removed: [] },
        },
      },
    });
    expect(semantic).toMatchObject({
      alertEligible: true,
      before: {
        mode: "classified",
        names: ["content-security-policy"],
        fingerprintsByName: { "content-security-policy": expect.any(String) },
      },
      after: {
        mode: "classified",
        names: ["content-security-policy"],
        fingerprintsByName: { "content-security-policy": expect.any(String) },
        changed: ["content-security-policy"],
      },
    });
    expect(JSON.stringify(semantic)).not.toContain("default-src");
  });

  it("keeps compatible Content-Language precision changes routine", () => {
    const precisionChange = compare(
      result({ responseHeadersJson: { "content-language": "en-US" } }),
      result({ responseHeadersJson: { "content-language": "en" } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const languageChange = compare(
      result({ responseHeadersJson: { "content-language": "en" } }),
      result({ responseHeadersJson: { "content-language": "fr" } }),
    ).items.find((item) => item.type === "response_headers.changed");

    expect(precisionChange).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          routine: { added: [], changed: ["content-language"], removed: [] },
        },
      },
    });
    expect(languageChange).toMatchObject({
      alertEligible: true,
      after: {
        changesByDisposition: {
          meaningful: { added: [], changed: ["content-language"], removed: [] },
        },
      },
    });
  });

  it("keeps Alt-Svc availability toggles routine while retaining service changes", () => {
    const added = compare(
      result({ responseHeadersJson: {} }),
      result({ responseHeadersJson: { "alt-svc": 'h3=":443"; ma=86400' } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const removed = compare(
      result({ responseHeadersJson: { "alt-svc": 'h3=":443"; ma=86400' } }),
      result({ responseHeadersJson: {} }),
    ).items.find((item) => item.type === "response_headers.changed");
    const changedService = compare(
      result({ responseHeadersJson: { "alt-svc": 'h3=":443"; ma=86400' } }),
      result({ responseHeadersJson: { "alt-svc": 'h3=":8443"; ma=86400' } }),
    ).items.find((item) => item.type === "response_headers.changed");

    expect(added).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          routine: { added: ["alt-svc"], changed: [], removed: [] },
        },
      },
    });
    expect(removed).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          routine: { added: [], changed: [], removed: ["alt-svc"] },
        },
      },
    });
    expect(changedService).toMatchObject({
      alertEligible: true,
      after: {
        changesByDisposition: {
          meaningful: { added: [], changed: ["alt-svc"], removed: [] },
        },
      },
    });
  });

  it("keeps CSP build-hash rotation in the feed without making it alert eligible", () => {
    const beforeHash = `'sha256-${"A".repeat(43)}='`;
    const afterHash = `'sha256-${"B".repeat(43)}='`;
    const rotation = compare(
      result({ responseHeadersJson: { "content-security-policy": `script-src 'self' ${beforeHash}` } }),
      result({ responseHeadersJson: { "content-security-policy": `script-src 'self' ${afterHash}` } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const weakened = compare(
      result({ responseHeadersJson: { "content-security-policy": `script-src 'self' ${beforeHash}` } }),
      result({ responseHeadersJson: { "content-security-policy": `script-src 'self' 'unsafe-inline' ${afterHash}` } }),
    ).items.find((item) => item.type === "response_headers.changed");

    expect(rotation).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          routine: { added: [], changed: ["content-security-policy"], removed: [] },
        },
      },
    });
    expect(weakened).toMatchObject({
      alertEligible: true,
      after: {
        changesByDisposition: {
          meaningful: { added: [], changed: ["content-security-policy"], removed: [] },
        },
      },
    });
  });

  it("keeps nonce rotation in coalesced CSP policies routine", () => {
    const before = "require-trusted-types-for 'script'; report-uri /recaptcha/cspreport, script-src 'nonce-before' 'unsafe-inline'; object-src 'none'; base-uri www.google.com; report-uri /_/cspreport";
    const after = "require-trusted-types-for 'script'; report-uri /recaptcha/cspreport, script-src 'nonce-after' 'unsafe-inline'; object-src 'none'; base-uri www.google.com; report-uri /_/cspreport";
    const rotation = compare(
      result({ responseHeadersJson: { "content-security-policy": before } }),
      result({ responseHeadersJson: { "content-security-policy": after } }),
    ).items.find((item) => item.type === "response_headers.changed");

    expect(rotation).toMatchObject({
      alertEligible: false,
      after: { changesByDisposition: { routine: { changed: ["content-security-policy"] } } },
    });
  });

  it("keeps short opaque CSP reporting token rotation routine without hiding destination changes", () => {
    const beforeCollector = "https://csp.canva.com/_cspreport?source=web2&requestId=a3524b139c1c3529&app=anon_home&policyHash=a8c55c26";
    const afterCollector = "https://csp.canva.com/_cspreport?source=web2&requestId=a352699d1dfd20be&app=anon_home&policyHash=2a3488c9";
    const rotation = compare(
      result({ responseHeadersJson: { "content-security-policy": `default-src 'self'; report-uri ${beforeCollector}` } }),
      result({ responseHeadersJson: { "content-security-policy": `report-uri ${afterCollector}; default-src 'self'` } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const rerouted = compare(
      result({ responseHeadersJson: { "content-security-policy": `default-src 'self'; report-uri ${beforeCollector}` } }),
      result({ responseHeadersJson: { "content-security-policy": `default-src 'self'; report-uri https://other.example/_cspreport?source=web2&requestId=a352699d1dfd20be&app=anon_home&policyHash=2a3488c9` } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const stableConfigurationChanged = compare(
      result({ responseHeadersJson: { "content-security-policy": `default-src 'self'; report-uri ${beforeCollector}` } }),
      result({ responseHeadersJson: { "content-security-policy": `default-src 'self'; report-uri https://csp.canva.com/_cspreport?source=web3&requestId=a352699d1dfd20be&app=anon_home&policyHash=2a3488c9` } }),
    ).items.find((item) => item.type === "response_headers.changed");

    expect(rotation).toMatchObject({
      alertEligible: false,
      after: { changesByDisposition: { routine: { changed: ["content-security-policy"] } } },
    });
    expect(rerouted?.alertEligible).toBe(true);
    expect(stableConfigurationChanged?.alertEligible).toBe(true);
  });

  it("keeps positive Cache-Control lifetime drift routine and alerts on policy boundaries", () => {
    const lifetimeDrift = compare(
      result({ responseHeadersJson: { "cache-control": "public, max-age=12" } }),
      result({ responseHeadersJson: { "cache-control": "max-age=92, public" } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const expiresImmediately = compare(
      result({ responseHeadersJson: { "cache-control": "public, max-age=92" } }),
      result({ responseHeadersJson: { "cache-control": "public, max-age=0" } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const storagePolicyChanged = compare(
      result({ responseHeadersJson: { "cache-control": "public, max-age=92" } }),
      result({ responseHeadersJson: { "cache-control": "private, no-store, max-age=92" } }),
    ).items.find((item) => item.type === "response_headers.changed");

    expect(lifetimeDrift).toMatchObject({
      alertEligible: false,
      after: { changesByDisposition: { routine: { changed: ["cache-control"] } } },
    });
    expect(expiresImmediately?.alertEligible).toBe(true);
    expect(storagePolicyChanged?.alertEligible).toBe(true);
  });

  it("records rotating cookie values as routine but alerts on cookie policy changes", () => {
    const rotation = compare(
      result({ responseHeadersJson: { set_cookie: "session=one; Path=/; Secure; HttpOnly; Max-Age=60; Expires=Wed, 02 Sep 2026 20:00:00 GMT" } }),
      result({ responseHeadersJson: { "set-cookie": "session=two; Path=/; Secure; HttpOnly; Max-Age=60; Expires=Wed, 02 Sep 2026 21:00:00 GMT" } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const policyChange = compare(
      result({ responseHeadersJson: { "set-cookie": "session=one; Path=/; Secure; HttpOnly" } }),
      result({ responseHeadersJson: { "set-cookie": "session=two; Path=/; Secure; HttpOnly; SameSite=Strict" } }),
    ).items.find((item) => item.type === "response_headers.changed");

    expect(rotation).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          routine: { added: [], changed: ["set-cookie"], removed: [] },
        },
      },
    });
    expect(policyChange).toMatchObject({
      alertEligible: true,
      after: { changed: ["set-cookie"] },
    });
    expect(JSON.stringify(policyChange)).not.toContain("session=two");
  });

  it("alerts when a cookie Max-Age policy changes", () => {
    const oneSecondDrift = compare(
      result({ responseHeadersJson: { "set-cookie": "session=one; Path=/; Max-Age=14400" } }),
      result({ responseHeadersJson: { "set-cookie": "session=two; Path=/; Max-Age=14399" } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const shortened = compare(
      result({ responseHeadersJson: { "set-cookie": "session=one; Path=/; Max-Age=86400" } }),
      result({ responseHeadersJson: { "set-cookie": "session=two; Path=/; Max-Age=3600" } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const expired = compare(
      result({ responseHeadersJson: { "set-cookie": "session=one; Path=/; Max-Age=86400" } }),
      result({ responseHeadersJson: { "set-cookie": "session=two; Path=/; Max-Age=0" } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const rotatingExpired = compare(
      result({ responseHeadersJson: { "set-cookie": "session=one; Path=/; Max-Age=-100" } }),
      result({ responseHeadersJson: { "set-cookie": "session=two; Path=/; Max-Age=-200" } }),
    ).items.find((item) => item.type === "response_headers.changed");

    expect(oneSecondDrift).toMatchObject({
      alertEligible: false,
      after: { changesByDisposition: { routine: { changed: ["set-cookie"] } } },
    });
    expect(shortened?.alertEligible).toBe(true);
    expect(expired?.alertEligible).toBe(true);
    expect(rotatingExpired?.alertEligible).toBe(false);
  });

  it("records rotating reporting collector tokens without alerting", () => {
    const beforeToken = "eyJlIjoxNzg4NDYxMzg4LCJkIjoiYmVmb3JlIn0.abcdefghijklmnopqrstuvwxyz123456";
    const afterToken = "eyJlIjoxNzg4NDYzNzU5LCJkIjoiYWZ0ZXIifQ.zyxwvutsrqponmlkjihgfedcba654321";
    const comparison = compare(
      result({
        responseHeadersJson: {
          "content-security-policy-report-only": `script-src 'none'; report-uri /csp-report?t=${beforeToken}; report-to page-errors`,
          "report-to": JSON.stringify({
            group: "page-errors",
            max_age: 86_400,
            endpoints: [{ url: `https://example.test/csp-report?t=${beforeToken}` }],
          }),
          "reporting-endpoints": `page-errors="https://example.test/csp-report?t=${beforeToken}"`,
        },
      }),
      result({
        responseHeadersJson: {
          "content-security-policy-report-only": `script-src 'none'; report-uri /csp-report?t=${afterToken}; report-to page-errors`,
          "report-to": JSON.stringify({
            endpoints: [{ url: `https://example.test/csp-report?t=${afterToken}` }],
            max_age: 86_400,
            group: "page-errors",
          }),
          "reporting-endpoints": `page-errors="https://example.test/csp-report?t=${afterToken}"`,
        },
      }),
    );

    expect(comparison.items.find((item) => item.type === "response_headers.changed")).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          routine: {
            changed: ["content-security-policy-report-only", "report-to", "reporting-endpoints"],
          },
        },
      },
    });
  });

  it("shows reporting-only policy changes without making them alert eligible", () => {
    const reportOnly = compare(
      result({
        responseHeadersJson: {
          "content-security-policy-report-only": "script-src 'none'; report-to old-errors",
          "report-to": JSON.stringify({
            group: "old-errors",
            max_age: 86_400,
            endpoints: [{ url: "https://old.example.test/report" }],
          }),
        },
      }),
      result({
        responseHeadersJson: {
          "content-security-policy-report-only": "script-src 'self'; report-to new-errors",
          "report-to": JSON.stringify({
            group: "new-errors",
            max_age: 86_400,
            endpoints: [{ url: "https://new.example.test/report" }],
          }),
        },
      }),
    ).items.find((item) => item.type === "response_headers.changed");
    const enforcingPolicy = compare(
      result({ responseHeadersJson: { "content-security-policy": "default-src 'self'" } }),
      result({ responseHeadersJson: { "content-security-policy": "default-src https:" } }),
    ).items.find((item) => item.type === "response_headers.changed");

    expect(reportOnly).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          meaningful: {
            changed: ["content-security-policy-report-only", "report-to"],
          },
        },
      },
    });
    expect(enforcingPolicy?.alertEligible).toBe(true);
  });

  it("still alerts when an enforcing policy changes beside reporting plumbing", () => {
    const comparison = compare(
      result({
        responseHeadersJson: {
          "cross-origin-opener-policy": "same-origin; report-to=old-errors",
          "reporting-endpoints": 'old-errors="https://example.test/old"',
        },
      }),
      result({
        responseHeadersJson: {
          "cross-origin-opener-policy": "unsafe-none; report-to=new-errors",
          "reporting-endpoints": 'new-errors="https://example.test/new"',
        },
      }),
    ).items.find((item) => item.type === "response_headers.changed");

    expect(comparison).toMatchObject({
      alertEligible: true,
      after: {
        changesByDisposition: {
          meaningful: {
            changed: ["cross-origin-opener-policy", "reporting-endpoints"],
          },
        },
      },
    });
  });

  it("records rotating Cloudflare NEL tokens without alerting", () => {
    const beforeToken = "O27fPabR6HfMflpYakVvC%2BWnIdZVTV%2F2yaSDpABPu8FTn6CfhXdEpSyiNzJNdLzaxw%3D";
    const afterToken = "as1hKUB79lNIWns1xe3USCQiR7KQQqM7k9xDvtHOVlyTb9W8j50lA5hRXLgQBJm8dgEtBUClrqoC3%2FZr3lSg%3D";
    const reportTo = (token: string) => JSON.stringify({
      group: "cf-nel",
      max_age: 604_800,
      endpoints: [{ url: `https://a.nel.cloudflare.com/report/v4?s=${token}` }],
    });
    const comparison = compare(
      result({ responseHeadersJson: { "report-to": reportTo(beforeToken) } }),
      result({ responseHeadersJson: { "report-to": reportTo(afterToken) } }),
    );

    expect(comparison.items.find((item) => item.type === "response_headers.changed")).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          routine: { added: [], changed: ["report-to"], removed: [] },
        },
      },
    });
  });

  it("keeps representation-derived header changes as non-alerting evidence", () => {
    const comparison = compare(
      result({ responseHeadersJson: { etag: 'W/"one"', "content-length": "100" } }),
      result({ responseHeadersJson: { etag: 'W/"two"', "content-length": "200" } }),
    );

    expect(comparison.items.find((item) => item.type === "response_headers.changed")).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          representation: { added: [], changed: ["content-length", "etag"], removed: [] },
        },
      },
    });
  });

  it("records bare inline disposition removal and internal matched-path changes as routine", () => {
    const comparison = compare(
      result({
        responseHeadersJson: {
          "content-disposition": "inline",
          "x-matched-path": "/precomputed/opaque-before",
        },
      }),
      result({
        responseHeadersJson: {
          "x-matched-path": "/precomputed/opaque-after",
        },
      }),
    );

    expect(comparison.items.find((item) => item.type === "response_headers.changed")).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          meaningful: { added: [], changed: [], removed: [] },
          routine: { added: [], changed: ["x-matched-path"], removed: ["content-disposition"] },
        },
      },
    });
  });

  it("treats an Accept-Encoding-only Vary change from a cache-path transition as routine", () => {
    const cacheTransition = compare(
      result({
        responseHeadersJson: { vary: "Accept", "x-cache": "MISS" },
      }),
      result({
        responseHeadersJson: { vary: "Accept, accept-encoding", age: "685", "x-cache": "HIT" },
      }),
    ).items.find((item) => item.type === "response_headers.changed");
    const noCacheEvidence = compare(
      result({ responseHeadersJson: { vary: "Accept" } }),
      result({ responseHeadersJson: { vary: "Accept, accept-encoding" } }),
    ).items.find((item) => item.type === "response_headers.changed");
    const changedResponseShape = compare(
      result({
        contentLength: 1_000,
        responseHeadersJson: { vary: "Accept", "x-cache": "MISS" },
      }),
      result({
        contentLength: 1_100,
        responseHeadersJson: { vary: "Accept, accept-encoding", age: "685", "x-cache": "HIT" },
      }),
    ).items.find((item) => item.type === "response_headers.changed");
    const otherVaryToken = compare(
      result({ responseHeadersJson: { vary: "Accept", "x-cache": "MISS" } }),
      result({ responseHeadersJson: { vary: "Accept, Origin", age: "685", "x-cache": "HIT" } }),
    ).items.find((item) => item.type === "response_headers.changed");

    expect(cacheTransition).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          routine: {
            added: ["age"],
            changed: ["vary", "x-cache"],
            removed: [],
          },
        },
      },
    });
    expect(noCacheEvidence).toMatchObject({
      alertEligible: true,
      after: { changesByDisposition: { meaningful: { changed: ["vary"] } } },
    });
    expect(changedResponseShape).toMatchObject({
      alertEligible: true,
      after: { changesByDisposition: { meaningful: { changed: ["vary"] } } },
    });
    expect(otherVaryToken).toMatchObject({
      alertEligible: true,
      after: { changesByDisposition: { meaningful: { changed: ["vary"] } } },
    });
  });

  it("classifies volatile headers when scanner output uses underscores", () => {
    const comparison = compare(
      result({ responseHeadersJson: { x_vercel_id: "iad1::one" } }),
      result({ responseHeadersJson: { x_vercel_id: "iad1::two" } }),
    );

    expect(comparison.items.find((item) => item.type === "response_headers.changed")).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          routine: { added: [], changed: ["x-vercel-id"], removed: [] },
        },
      },
    });
  });

  it("keeps unknown header changes visible without alerting", () => {
    const comparison = compare(
      result({ responseHeadersJson: { "x-example-release": "one" } }),
      result({ responseHeadersJson: { "x-example-release": "two" } }),
    );

    expect(comparison.items.find((item) => item.type === "response_headers.changed")).toMatchObject({
      alertEligible: false,
      after: {
        changesByDisposition: {
          unknown: { added: [], changed: ["x-example-release"], removed: [] },
        },
      },
    });
  });

  it("uses favicon MD5 first and retains every comparable favicon fingerprint", () => {
    const items = compare(
      result({ faviconMd5: "old", faviconMmh3: "1" }),
      result({ faviconMd5: "new", faviconMmh3: "2" }),
    ).items.filter((item) => item.type.startsWith("favicon"));

    expect(items).toEqual([
      expect.objectContaining({
        type: "favicon.changed",
        before: {
          algorithm: "md5",
          value: "old",
          hashes: { md5: "old", mmh3: "1" },
          location: "https://example.test/favicon.ico",
        },
        after: {
          algorithm: "md5",
          value: "new",
          hashes: { md5: "new", mmh3: "2" },
          location: "https://example.test/favicon.ico",
        },
      }),
    ]);
  });

  it("reports a favicon location move only when the known asset fingerprint is unchanged", () => {
    const unchanged = compare(
      result({ faviconMd5: "same", faviconUrl: "https://example.test/old.ico" }),
      result({ faviconMd5: "same", faviconUrl: "https://example.test/new.ico" }),
    );
    const unknown = compare(
      result({ faviconMd5: null, faviconMmh3: null, faviconUrl: "https://example.test/old.ico" }),
      result({ faviconMd5: null, faviconMmh3: null, faviconUrl: "https://example.test/new.ico" }),
    );

    expect(unchanged.items).toEqual(expect.arrayContaining([expect.objectContaining({ type: "favicon_location.changed" })]));
    expect(unknown.items.some((item) => item.type === "favicon_location.changed")).toBe(false);
  });

  it("compares redirect behavior without raw records or status codes", () => {
    const baseline = result({
      url: "https://anthropic.com",
      finalUrl: "https://www.anthropic.com/",
      redirectChainStatusCodes: [301, 200],
      redirectChainJson: [
        {
          "request-url": "https://anthropic.com",
          location: "https://www.anthropic.com/",
          request: "User-Agent: Chrome",
          response: "Date: one\r\nCF-Ray: one",
          status_code: 301,
        },
        {
          "request-url": "https://www.anthropic.com/",
          request: "User-Agent: Chrome",
          response: "Date: one\r\nSet-Cookie: one",
          status_code: 200,
        },
      ],
    });
    const volatileOnly = result({
      url: "https://anthropic.com/",
      finalUrl: "https://www.anthropic.com/",
      redirectChainStatusCodes: [302, 200],
      redirectChainJson: [
        {
          "request-url": "https://anthropic.com/",
          location: "https://www.anthropic.com/",
          request: "User-Agent: Firefox",
          response: "Date: two\r\nCF-Ray: two",
          status_code: 302,
        },
        {
          "request-url": "https://www.anthropic.com/",
          request: "User-Agent: Firefox",
          response: "Date: two\r\nSet-Cookie: two",
          status_code: 200,
        },
      ],
    });
    const changedRoute = result({
      ...volatileOnly,
      finalUrl: "https://www.anthropic.com/news/",
      redirectChainJson: [
        { "request-url": "https://anthropic.com/", status_code: 302 },
        { "request-url": "https://www.anthropic.com/news/", status_code: 200 },
      ],
    });

    expect(compare(baseline, volatileOnly).items.some((item) => item.type === "redirect.changed")).toBe(false);
    expect(compare(baseline, changedRoute).items.find((item) => item.type === "redirect.changed")).toMatchObject({
      alertEligible: true,
      before: {
        chain: ["https://anthropic.com/", "https://www.anthropic.com/"],
        finalUrl: "https://www.anthropic.com/",
      },
      after: {
        chain: ["https://anthropic.com/", "https://www.anthropic.com/news/"],
        finalUrl: "https://www.anthropic.com/news/",
      },
    });
  });

  it("compares routing, DNS, TLS, technologies, CPE, and core metadata as structured items", () => {
    const output = compare(
      result(),
      result({
        statusCode: 503,
        finalUrl: "https://example.test/login",
        location: "/login",
        redirectChainStatusCodes: [302, 503],
        hostIp: "192.0.2.2",
        dnsARecords: ["192.0.2.2"],
        dnsCnameRecords: ["edge.example.test"],
        tlsJson: { subject_cn: "example.test", issuer_cn: "New CA" },
        jarmHash: "jarm-two",
        technologies: ["Caddy"],
        cpe: ["cpe:2.3:a:caddyserver:caddy:2.0:*:*:*:*:*:*:*"],
        title: "Unavailable",
        webServer: "caddy",
        contentType: "text/plain",
        cdn: true,
        cdnName: "Cloudflare",
        http2: false,
      }),
    );
    const types = output.items.map((item) => item.type);

    expect(types).toEqual(
      expect.arrayContaining([
        "status.changed",
        "redirect.changed",
        "dns.host_ip_changed",
        "dns.a_changed",
        "dns.cname_changed",
        "tls.certificate_changed",
        "tls.jarm_changed",
        "technology.changed",
        "cpe.changed",
        "metadata.title_changed",
        "metadata.server_changed",
        "metadata.content_type_changed",
        "metadata.cdn_changed",
        "metadata.capabilities_changed",
      ]),
    );
    expect(output.items.find((item) => item.type === "status.changed")?.alertEligible).toBe(true);
  });

  it("does not classify missing field evidence as a removal", () => {
    const output = compare(
      result(),
      result({
        hashesJson: null,
        responseHeadersJson: null,
        faviconMd5: null,
        faviconMmh3: null,
        dnsARecords: null,
        tlsJson: null,
        jarmHash: null,
        technologies: null,
        technologyDetections: null,
        cpe: null,
      }),
    );

    expect(output.items.map((item) => item.type)).not.toEqual(
      expect.arrayContaining([
        "body_fingerprint.changed",
        "response_headers.changed",
        "favicon.changed",
        "dns.a_changed",
        "tls.certificate_changed",
        "tls.jarm_changed",
        "technology.changed",
        "cpe.changed",
      ]),
    );
  });

  it("suppresses same-owner IPv4 rotation when service identity stays stable", () => {
    const ipNetworkIdentities = new Map([
      ["64.239.109.1", { registrantId: "ZEITI", registrantName: "Vercel, Inc", originAsn: "AS16509" }],
      ["64.239.123.1", { registrantId: "ZEITI", registrantName: "Vercel, Inc", originAsn: "AS16509" }],
    ]);
    const output = compare(
      result({ hostIp: "64.239.109.1", dnsARecords: ["64.239.109.1"] }),
      result({ hostIp: "64.239.123.1", dnsARecords: ["64.239.123.1"] }),
      { ipNetworkIdentities },
    );

    expect(output.items.map((item) => item.type)).not.toContain("dns.host_ip_changed");
    expect(output.items.find((item) => item.type === "dns.a_changed")?.alertEligible).toBe(false);
  });

  it("suppresses same-owner IPv6 rotation when service identity stays stable", () => {
    const beforeAddress = "2600:9000:2509:1600:2:d4d8:1880:93a1";
    const afterAddress = "2600:9000:2509:2000:2:d4d8:1880:93a1";
    const ipNetworkIdentities = new Map([
      [beforeAddress, { registrantId: "AT-88-Z", registrantName: "Amazon.com, Inc.", originAsn: "AS16509" }],
      [afterAddress, { registrantId: "AT-88-Z", registrantName: "Amazon.com, Inc.", originAsn: "AS16509" }],
    ]);
    const output = compare(
      result({ dnsAaaaRecords: [beforeAddress] }),
      result({ dnsAaaaRecords: [afterAddress] }),
      { ipNetworkIdentities },
    );

    expect(output.items.find((item) => item.type === "dns.aaaa_changed")?.alertEligible).toBe(false);
  });

  it("uses provider identity when RDAP handles differ", () => {
    const beforeAddress = "23.32.238.96";
    const afterAddress = "23.62.33.75";
    const output = compare(
      result({ hostIp: beforeAddress, dnsARecords: [beforeAddress] }),
      result({ hostIp: afterAddress, dnsARecords: [afterAddress] }),
      {
        ipNetworkIdentities: new Map([
          [beforeAddress, {
            registrantId: "AIB-17",
            registrantName: "Akamai International B.V.",
            providerName: "AKAMAI-ASN1 - Akamai International B.V.",
            originAsn: "AS20940",
          }],
          [afterAddress, {
            registrantId: "AKAMAI",
            registrantName: "Akamai Technologies, Inc.",
            providerName: "AKAMAI-ASN1 - Akamai International B.V.",
            originAsn: "AS20940",
          }],
        ]),
      },
    );

    expect(output.items.map((item) => item.type)).not.toContain("dns.host_ip_changed");
    expect(output.items.find((item) => item.type === "dns.a_changed")?.alertEligible).toBe(false);
  });

  it("tolerates limited missing enrichment when known network identities agree", () => {
    const beforeAddresses = ["2001:db8::1", "2001:db8::2", "2001:db8::3", "2001:db8::4"];
    const afterAddresses = ["2001:db8::5", "2001:db8::6", "2001:db8::7", "2001:db8::8"];
    const knownIdentity = { registrantId: "GOGL", providerName: "Google LLC", originAsn: "AS15169" };
    const identities = new Map([
      ...beforeAddresses.map((address) => [address, knownIdentity] as const),
      [afterAddresses[0], knownIdentity] as const,
      [afterAddresses[1], knownIdentity] as const,
    ]);
    const output = compare(
      result({ dnsAaaaRecords: beforeAddresses }),
      result({ dnsAaaaRecords: afterAddresses }),
      { ipNetworkIdentities: identities },
    );

    expect(output.items.find((item) => item.type === "dns.aaaa_changed")?.alertEligible).toBe(false);
  });

  it("treats a non-empty same-network record contraction as routine", () => {
    const retainedAddress = "2600:1406:3a00:481::366e";
    const removedAddress = "2600:1406:3a00:488::366e";
    const identity = { registrantId: "AKAMAI", providerName: "Akamai International B.V.", originAsn: "AS20940" };
    const output = compare(
      result({ dnsAaaaRecords: [retainedAddress, removedAddress] }),
      result({ dnsAaaaRecords: [retainedAddress] }),
      { ipNetworkIdentities: new Map([[retainedAddress, identity], [removedAddress, identity]]) },
    );

    expect(output.items.find((item) => item.type === "dns.aaaa_changed")?.alertEligible).toBe(false);
  });

  it("keeps complete record disappearance alert eligible", () => {
    const address = "2600:1406:3a00:481::366e";
    const output = compare(
      result({ dnsAaaaRecords: [address] }),
      result({ dnsAaaaRecords: [] }),
      {
        ipNetworkIdentities: new Map([[
          address,
          { registrantId: "AKAMAI", providerName: "Akamai International B.V.", originAsn: "AS20940" },
        ]]),
      },
    );

    expect(output.items.find((item) => item.type === "dns.aaaa_changed")?.alertEligible).toBe(true);
  });

  it("keeps IPv6 additions and ownership changes alert eligible", () => {
    const firstAddress = "2607:f8b0:4004:c29::66";
    const additionalAddress = "2607:f8b0:4004:c29::67";
    const movedAddress = "2a03:2880:f203:e5:face:b00c:0:4420";
    const identities = new Map([
      [firstAddress, { registrantId: "GOGL", originAsn: "AS15169" }],
      [additionalAddress, { registrantId: "GOGL", originAsn: "AS15169" }],
      [movedAddress, { registrantId: "RIPE-META", originAsn: "AS32934" }],
    ]);
    const addition = compare(
      result({ dnsAaaaRecords: [firstAddress] }),
      result({ dnsAaaaRecords: [firstAddress, additionalAddress] }),
      { ipNetworkIdentities: identities },
    );
    const ownerChange = compare(
      result({ dnsAaaaRecords: [firstAddress] }),
      result({ dnsAaaaRecords: [movedAddress] }),
      { ipNetworkIdentities: identities },
    );

    expect(addition.items.find((item) => item.type === "dns.aaaa_changed")?.alertEligible).toBe(true);
    expect(ownerChange.items.find((item) => item.type === "dns.aaaa_changed")?.alertEligible).toBe(true);
  });

  it("keeps IPv4 changes when ownership changes or enrichment is incomplete", () => {
    const changedOwner = compare(
      result({ hostIp: "64.239.109.1", dnsARecords: ["64.239.109.1"] }),
      result({ hostIp: "203.0.113.10", dnsARecords: ["203.0.113.10"] }),
      {
        ipNetworkIdentities: new Map([
          ["64.239.109.1", { registrantId: "ZEITI", originAsn: "AS16509" }],
          ["203.0.113.10", { registrantId: "OTHER", originAsn: "AS64500" }],
        ]),
      },
    );
    const incomplete = compare(
      result({ hostIp: "64.239.109.1", dnsARecords: ["64.239.109.1"] }),
      result({ hostIp: "64.239.123.1", dnsARecords: ["64.239.123.1"] }),
      {
        ipNetworkIdentities: new Map([
          ["64.239.109.1", { registrantId: "ZEITI", originAsn: "AS16509" }],
        ]),
      },
    );

    expect(changedOwner.items.map((item) => item.type)).toContain("dns.a_changed");
    expect(incomplete.items.map((item) => item.type)).toContain("dns.a_changed");
  });

  it("keeps same-owner IPv4 changes when TLS identity changes", () => {
    const output = compare(
      result({ hostIp: "64.239.109.1", dnsARecords: ["64.239.109.1"] }),
      result({
        hostIp: "64.239.123.1",
        dnsARecords: ["64.239.123.1"],
        tlsJson: { subject_cn: "unexpected.example", issuer_cn: "Other CA" },
      }),
      {
        ipNetworkIdentities: new Map([
          ["64.239.109.1", { registrantId: "ZEITI", originAsn: "AS16509" }],
          ["64.239.123.1", { registrantId: "ZEITI", originAsn: "AS16509" }],
        ]),
      },
    );

    expect(output.items.map((item) => item.type)).toContain("dns.a_changed");
  });

  it("compares certificate identity without TLS connection metadata", () => {
    const sameCertificate = {
      serial: "01:23",
      issuer_cn: "Example CA",
      subject_cn: "example.test",
      fingerprint_hash: { sha256: "ABCDEF" },
    };
    const connectionOnly = compare(
      result({ tlsJson: { ...sameCertificate, sni: "www.example.test", host: "www.example.test", cipher: "TLS_AES_128_GCM_SHA256" } }),
      result({ tlsJson: { ...sameCertificate, sni: "m.example.test", host: "m.example.test", cipher: "TLS_AES_256_GCM_SHA384" } }),
    );
    const certificateChanged = compare(
      result({ tlsJson: sameCertificate }),
      result({ tlsJson: { ...sameCertificate, fingerprint_hash: { sha256: "123456" } } }),
    );

    expect(connectionOnly.items.map((item) => item.type)).not.toContain("tls.certificate_changed");
    expect(certificateChanged.items.find((item) => item.type === "tls.certificate_changed")).toMatchObject({
      alertEligible: true,
      before: { fingerprint: "abcdef" },
      after: { fingerprint: "123456" },
    });
  });

  it("does not report a different selected host when the A-record set is unchanged", () => {
    const output = compare(
      result({ hostIp: "192.0.2.1", dnsARecords: ["192.0.2.1", "192.0.2.2"] }),
      result({ hostIp: "192.0.2.2", dnsARecords: ["192.0.2.1", "192.0.2.2"] }),
    );

    expect(output.items.map((item) => item.type)).not.toContain("dns.host_ip_changed");
  });

  it("ignores unmatched results instead of reporting endpoint inventory changes", () => {
    const baseline = [result({ url: "https://example.test/a" }), result({ id: "b", url: "https://example.test/b" })];
    const current = [result({ url: "https://example.test/a" })];

    expect(
      compareScanResults({
        baseline: { results: baseline },
        current: { results: current },
      }).items,
    ).toEqual([]);
  });

  it("returns stable endpoint/type ordering regardless of input order", () => {
    const baseline = [
      result({ id: "b1", url: "https://example.test/b", statusCode: 200 }),
      result({ id: "a1", url: "https://example.test/a", statusCode: 200 }),
    ];
    const current = [
      result({ id: "a2", url: "https://example.test/a", statusCode: 404 }),
      result({ id: "b2", url: "https://example.test/b", statusCode: 500 }),
    ];

    const output = compareScanResults({
      baseline: { results: baseline },
      current: { results: current },
    });

    expect(output.items.map((item) => item.endpointKey)).toEqual([
      "https://example.test/a",
      "https://example.test/b",
    ]);
  });

  it("skips duplicate endpoint rows instead of selecting an arbitrary result", () => {
    const output = compareScanResults({
      baseline: {
        results: [
          result({ id: "one", url: "https://example.test/", statusCode: 200 }),
          result({ id: "two", url: "https://example.test/", statusCode: 404 }),
        ],
      },
      current: { results: [result({ id: "three", statusCode: 500 })] },
    });

    expect(output.items).toEqual([]);
    expect(output.comparedEndpointCount).toBe(0);
    expect(output.skippedResultCount).toBe(3);
  });

  it("bounds persisted items while reporting omitted changes and rejects unbounded input", () => {
    const output = compare(result(), result({ statusCode: 503, title: "Changed", webServer: "caddy" }), {
      maxChangeItems: 2,
    });

    expect(output.items).toHaveLength(2);
    expect(output.totalChangeCount).toBeGreaterThan(2);
    expect(output.omittedChangeCount).toBe(output.totalChangeCount - 2);
    expect(output.truncated).toBe(true);
    expect(() =>
      compareScanResults({
        baseline: { results: [result(), result({ id: "two" })] },
        current: { results: [] },
        maxEndpoints: 1,
      }),
    ).toThrow(/endpoint limit/);
  });
});
