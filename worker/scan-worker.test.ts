// @vitest-environment node

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  buildAttemptFallbackDecision,
  buildRetryTargets,
  buildNucleiExecutionPhases,
  buildHttpxArguments,
  buildHttpxHeadlessEnrichmentArguments,
  buildNucleiTechnologyDetectionRows,
  buildScreenshotTechnologyDetectionRows,
  buildStoredResultSearchDocument,
  extractFaviconFields,
  getHttpxBehaviorOptionsForProfile,
  getNextHttpxRequestProfile,
  isMissingScanQueueSchemaError,
  selectNucleiTargets,
  runHttpxCli,
} from "@/worker/scan-worker";

class FakeHttpxProcess extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();

  killed = false;
  readonly killSignals: Array<NodeJS.Signals | number | undefined> = [];
  readonly stdinChunks: string[] = [];

  private closed = false;

  constructor() {
    super();
    this.stdin.setEncoding("utf8");
    this.stdin.on("data", (chunk) => {
      this.stdinChunks.push(String(chunk));
    });
  }

  kill(signal?: NodeJS.Signals | number) {
    this.killed = true;
    this.killSignals.push(signal);
    this.stdout.end();
    this.stderr.end();
    queueMicrotask(() => {
      this.finishClose(null);
    });
    return true;
  }

  emitJson(payload: Record<string, unknown>) {
    this.stdout.write(`${JSON.stringify(payload)}\n`);
  }

  emitStdoutLine(line: string) {
    this.stdout.write(`${line}\n`);
  }

  complete(code = 0) {
    this.stdout.end();
    this.stderr.end();
    queueMicrotask(() => {
      this.finishClose(code);
    });
  }

  fail(message: string, code = 1) {
    this.stderr.write(message);
    this.complete(code);
  }

  get stdinText() {
    return this.stdinChunks.join("");
  }

  private finishClose(code: number | null) {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.emit("close", code);
  }
}

describe("runHttpxCli", () => {
  it("streams targets to stdin and parses JSONL output", async () => {
    const process = new FakeHttpxProcess();
    const observedPayloads: Array<Record<string, unknown>> = [];

    const promise = runHttpxCli({
      command: "httpx",
      args: ["-json"],
      targets: ["https://example.com", "https://example.org"],
      timeoutMs: 1_000,
      spawnProcess: () => process,
      onJsonLine: async (payload) => {
        observedPayloads.push(payload);
      },
    });

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    process.emitJson({ input: "https://example.com", status_code: 200 });
    process.emitJson({ input: "https://example.org", status_code: 404 });
    process.complete();

    const result = await promise;

    expect(result).toEqual({
      status: "completed",
      exitCode: 0,
      stderr: "",
    });
    expect(process.stdinText).toBe("https://example.com\nhttps://example.org\n");
    expect(observedPayloads).toEqual([
      { input: "https://example.com", status_code: 200 },
      { input: "https://example.org", status_code: 404 },
    ]);
  });

  it("kills httpx and returns cancelled when cancellation is requested", async () => {
    const process = new FakeHttpxProcess();
    let cancelled = false;

    const promise = runHttpxCli({
      command: "httpx",
      args: ["-json"],
      targets: ["https://example.com"],
      timeoutMs: 1_000,
      cancellationPollIntervalMs: 5,
      shouldCancel: () => cancelled,
      spawnProcess: () => process,
      onJsonLine: async () => {},
    });

    cancelled = true;

    const result = await promise;

    expect(result.status).toBe("cancelled");
    expect(process.killSignals).toContain("SIGTERM");
  });

  it("kills httpx and returns timed_out when the scan exceeds the timeout", async () => {
    const process = new FakeHttpxProcess();

    const result = await runHttpxCli({
      command: "httpx",
      args: ["-json"],
      targets: ["https://example.com"],
      timeoutMs: 5,
      spawnProcess: () => process,
      onJsonLine: async () => {},
    });

    expect(result.status).toBe("timed_out");
    expect(process.killSignals).toContain("SIGTERM");
  });

  it("kills httpx and returns aborted when the worker signal is aborted", async () => {
    const process = new FakeHttpxProcess();
    const controller = new AbortController();

    const promise = runHttpxCli({
      command: "httpx",
      args: ["-json"],
      targets: ["https://example.com"],
      timeoutMs: 1_000,
      signal: controller.signal,
      spawnProcess: () => process,
      onJsonLine: async () => {},
    });

    controller.abort();

    const result = await promise;

    expect(result.status).toBe("aborted");
    expect(process.killSignals).toContain("SIGTERM");
  });

  it("returns a failed result with stderr when httpx exits non-zero", async () => {
    const process = new FakeHttpxProcess();

    const promise = runHttpxCli({
      command: "httpx",
      args: ["-json"],
      targets: ["https://example.com"],
      timeoutMs: 1_000,
      spawnProcess: () => process,
      onJsonLine: async () => {},
    });

    process.fail("dial tcp timeout", 7);

    const result = await promise;

    expect(result).toEqual({
      status: "failed",
      exitCode: 7,
      stderr: "dial tcp timeout",
    });
  });

  it("tolerates non-json stdout lines when explicitly allowed", async () => {
    const process = new FakeHttpxProcess();

    const promise = runHttpxCli({
      command: "httpx",
      args: ["-json", "-screenshot"],
      targets: ["https://example.com"],
      timeoutMs: 1_000,
      allowNonJsonStdout: true,
      spawnProcess: () => process,
      onJsonLine: async () => {},
    });

    process.emitStdoutLine("[launcher.Browser] Failed to launch the browser");
    process.complete(1);

    const result = await promise;

    expect(result).toEqual({
      status: "failed",
      exitCode: 1,
      stderr: "[launcher.Browser] Failed to launch the browser",
    });
  });

  it("passes every JSONL payload to the caller for screenshot enrichment", async () => {
    const process = new FakeHttpxProcess();
    const observedPayloads: Array<Record<string, unknown>> = [];

    const promise = runHttpxCli({
      command: "httpx",
      args: ["-json", "-td", "-screenshot"],
      targets: ["https://example.com"],
      timeoutMs: 1_000,
      spawnProcess: () => process,
      onJsonLine: async (payload) => {
        observedPayloads.push(payload);
      },
    });

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    process.emitJson({ input: "https://example.com", screenshot_path: "example.webp" });
    process.emitJson({ input: "https://example.com", tech: ["Stripe"] });
    process.complete();

    const result = await promise;

    expect(result.status).toBe("completed");
    expect(observedPayloads).toEqual([
      { input: "https://example.com", screenshot_path: "example.webp" },
      { input: "https://example.com", tech: ["Stripe"] },
    ]);
  });
});

describe("extractFaviconFields", () => {
  it("maps favicon hash and favicon_url into the correct persisted fields", () => {
    expect(
      extractFaviconFields({
        favicon: "-1830687435",
        favicon_url: "https://www.path-target.example.test/wp-content/uploads/2024/02/sample-favicon-150x150.png",
        favicon_path: "https://www.path-target.example.test/wp-content/uploads/2024/02/sample-favicon-150x150.png",
        favicon_md5: "c4a5b58b9454b49b47a9ce9d1ca02b05",
      }),
    ).toEqual({
      faviconMmh3: "-1830687435",
      faviconMd5: "c4a5b58b9454b49b47a9ce9d1ca02b05",
      faviconUrl: "https://www.path-target.example.test/wp-content/uploads/2024/02/sample-favicon-150x150.png",
      faviconPath: "https://www.path-target.example.test/wp-content/uploads/2024/02/sample-favicon-150x150.png",
    });
  });
});

function createErrorWithCode(message: string, code: string) {
  return Object.assign(new Error(message), { code });
}

describe("isMissingScanQueueSchemaError", () => {
  it("recognizes missing scan queue relations through nested drizzle causes", () => {
    const missingScansCause = createErrorWithCode('relation "scans" does not exist', "42P01");
    const wrappedMissingScansError = Object.assign(new Error("Failed query: select ..."), {
      cause: missingScansCause,
    });

    expect(isMissingScanQueueSchemaError(wrappedMissingScansError)).toBe(true);
  });

  it("recognizes direct missing scan queue relation messages", () => {
    expect(isMissingScanQueueSchemaError(new Error('relation "public.scans" does not exist'))).toBe(true);
    expect(isMissingScanQueueSchemaError(new Error('relation "scan_events" does not exist'))).toBe(true);
  });

  it("does not swallow unrelated errors", () => {
    expect(isMissingScanQueueSchemaError(createErrorWithCode("duplicate key value violates unique constraint", "23505"))).toBe(false);
    expect(isMissingScanQueueSchemaError(createErrorWithCode('relation "users" does not exist', "42P01"))).toBe(false);
    expect(
      isMissingScanQueueSchemaError(
        Object.assign(new Error("Failed query: select ..."), {
          cause: createErrorWithCode('relation "users" does not exist', "42P01"),
        }),
      ),
    ).toBe(false);
    expect(isMissingScanQueueSchemaError("not an error")).toBe(false);
  });
});

describe("buildHttpxArguments", () => {
  it("includes stream mode so stdin targets are processed immediately", () => {
    const args = buildHttpxArguments({
      optionsJson: {},
    } as typeof import("@/lib/db/schema").scans.$inferSelect);

    expect(args).toContain("-stream");
    expect(args[0]).toBe("-silent");
    expect(args[1]).toBe("-json");
    expect(args).toContain("-cff");
    expect(args[args.indexOf("-cff") + 1]).toContain("custom-wappalyzer-fingerprints.json");
    expect(args).not.toContain("-tlsi");
    expect(args).not.toContain("-H");
  });

  it("adds browser-like headers when enabled", () => {
    const args = buildHttpxArguments(
      {
        optionsJson: {},
      } as typeof import("@/lib/db/schema").scans.$inferSelect,
      {
        browserLikeHeaders: true,
        tlsImpersonate: false,
        followRedirects: null,
      },
    );

    expect(args).toContain("-H");
    expect(args).toContain(
      "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    expect(args).toContain('Sec-Ch-Ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"');
    expect(args).not.toContain("-tlsi");
  });

  it("adds tls impersonation without browser headers when enabled", () => {
    const args = buildHttpxArguments(
      {
        optionsJson: {},
      } as typeof import("@/lib/db/schema").scans.$inferSelect,
      {
        browserLikeHeaders: false,
        tlsImpersonate: true,
        followRedirects: false,
      },
    );

    expect(args).toContain("-tlsi");
    expect(args).not.toContain("-H");
    expect(args).not.toContain("-fr");
  });

  it("keeps redirects enabled for browser-headers fallback", () => {
    const args = buildHttpxArguments(
      {
        optionsJson: {},
      } as typeof import("@/lib/db/schema").scans.$inferSelect,
      {
        browserLikeHeaders: true,
        tlsImpersonate: false,
        followRedirects: null,
      },
    );

    expect(args).toContain("-fr");
    expect(args.filter((value) => value === "-H")).toHaveLength(10);
  });
});

describe("buildHttpxHeadlessEnrichmentArguments", () => {
  it("runs headless tech detection with browser headers and screenshot capture enabled", () => {
    const args = buildHttpxHeadlessEnrichmentArguments({
      captureScreenshot: true,
      storeDir: "/tmp/stackray-screenshots",
      target: "https://example.com",
    });

    expect(args).toContain("-tdh");
    expect(args).toContain("-cff");
    expect(args[args.indexOf("-cff") + 1]).toContain("custom-wappalyzer-fingerprints.json");
    expect(args).toContain("-screenshot");
    expect(args).toContain("-esb");
    expect(args).toContain("-ehb");
    expect(args).toContain("-st");
    expect(args[args.indexOf("-st") + 1]).toBe("30");
    expect(args).toContain("-sid");
    expect(args[args.indexOf("-sid") + 1]).toBe("10");
    expect(args).toContain("-srd");
    expect(args[args.indexOf("-srd") + 1]).toBe("/tmp/stackray-screenshots");
    expect(args[args.indexOf("-u") + 1]).toBe("https://example.com");
    expect(args.filter((value) => value === "-H")).toHaveLength(10);
  });

  it("runs headless tech detection without screenshot capture", () => {
    const args = buildHttpxHeadlessEnrichmentArguments({
      captureScreenshot: false,
      target: "https://example.com",
    });

    expect(args).toContain("-tdh");
    expect(args).toContain("-cff");
    expect(args[args.indexOf("-cff") + 1]).toContain("custom-wappalyzer-fingerprints.json");
    expect(args).not.toContain("-screenshot");
    expect(args).not.toContain("-esb");
    expect(args).not.toContain("-srd");
    expect(args).toContain("-ehb");
    expect(args[args.indexOf("-st") + 1]).toBe("30");
    expect(args[args.indexOf("-sid") + 1]).toBe("10");
    expect(args[args.indexOf("-u") + 1]).toBe("https://example.com");
    expect(args.filter((value) => value === "-H")).toHaveLength(10);
  });
});

describe("buildScreenshotTechnologyDetectionRows", () => {
  it("adds new canonical wappalyzer technologies without duplicating existing rows", () => {
    const rows = buildScreenshotTechnologyDetectionRows({
      resultId: "result-1",
      technologies: ["Vercel", "Stripe", "React:18.2.0", "Stripe", ""],
      existingDetections: [
        {
          kind: "technology",
          source: "wappalyzer",
          name: "Vercel",
          version: null,
          slug: null,
          cpe: null,
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        resultId: "result-1",
        kind: "technology",
        source: "wappalyzer",
        name: "Stripe",
        version: null,
      }),
      expect.objectContaining({
        resultId: "result-1",
        kind: "technology",
        source: "wappalyzer",
        name: "React",
        version: "18.2.0",
      }),
    ]);
  });
});

describe("buildNucleiTechnologyDetectionRows", () => {
  it("materializes nuclei technology and DNS service matches as technology detections", () => {
    const rows = buildNucleiTechnologyDetectionRows({
      resultId: "result-1",
      matches: [
        {
          findingKind: "technology",
          matcherName: "Next.js",
          technologyName: "Next.js",
          technologyVersion: null,
        },
        {
          findingKind: "dns_service",
          matcherName: "brevo",
          technologyName: null,
          technologyVersion: null,
        },
        {
          findingKind: "dns_service",
          matcherName: "google-workspace",
          technologyName: null,
          technologyVersion: null,
        },
        {
          findingKind: "ssl_issuer",
          matcherName: "Let's Encrypt",
          technologyName: null,
          technologyVersion: null,
        },
      ],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        resultId: "result-1",
        kind: "technology",
        source: "nuclei",
        name: "Next.js",
      }),
      expect.objectContaining({
        resultId: "result-1",
        kind: "technology",
        source: "nuclei",
        name: "Brevo",
      }),
      expect.objectContaining({
        resultId: "result-1",
        kind: "technology",
        source: "nuclei",
        name: "Google Workspace",
      }),
    ]);
  });
});

describe("buildStoredResultSearchDocument", () => {
  it("includes persisted screenshot technologies and nuclei technologies", () => {
    const searchDocument = buildStoredResultSearchDocument(
      {
        input: "example.com",
        url: "https://example.com",
        finalUrl: "https://example.com",
        title: "Example",
        webServer: "nginx",
        rawJson: {
          tech: ["Cloudflare"],
          wordpress: {
            plugins: [],
            themes: [],
          },
          cpe: [],
        },
        cspJson: {},
        bodyDomains: [],
        bodyFqdns: [],
      } as unknown as typeof import("@/lib/db/schema").scanResults.$inferSelect,
      ["Next.js"],
      ["Cloudflare", "React"],
    );

    expect(searchDocument).toContain("Cloudflare");
    expect(searchDocument).toContain("React");
    expect(searchDocument).toContain("Next.js");
  });
});

describe("httpx fallback profiles", () => {
  it("maps request profiles to the expected behavior options", () => {
    expect(getHttpxBehaviorOptionsForProfile("baseline")).toEqual({
      browserLikeHeaders: false,
      tlsImpersonate: false,
      followRedirects: null,
    });
    expect(getHttpxBehaviorOptionsForProfile("browser_headers")).toEqual({
      browserLikeHeaders: true,
      tlsImpersonate: false,
      followRedirects: null,
    });
    expect(getHttpxBehaviorOptionsForProfile("tlsi_final_url")).toEqual({
      browserLikeHeaders: false,
      tlsImpersonate: true,
      followRedirects: false,
    });
  });

  it("advances fallback profiles only on blocked responses", () => {
    expect(getNextHttpxRequestProfile("baseline")).toBe("browser_headers");
    expect(getNextHttpxRequestProfile("browser_headers")).toBe("tlsi_final_url");
    expect(getNextHttpxRequestProfile("tlsi_final_url")).toBeNull();
  });
});

describe("selectNucleiTargets", () => {
  it("keeps distinct original and final registrable domains when a redirect changes domains", () => {
    expect(
      selectNucleiTargets(
        {
          normalizedTarget: "https://alpha-company.test/login",
        } as typeof import("@/drizzle/schema").scans.$inferSelect,
        {
          url: "https://alpha-company.test/login",
          finalUrl: "https://www.beta-company.test/dashboard",
        } as typeof import("@/drizzle/schema").scanResults.$inferSelect,
      ),
    ).toEqual({
      targetUrl: "https://www.beta-company.test/dashboard",
      targetHost: "www.beta-company.test",
      originalDomainTarget: "alpha-company.test",
      finalDomainTarget: "beta-company.test",
      domainTarget: "alpha-company.test",
    });
  });

  it("deduplicates the final domain when it matches the original registrable domain", () => {
    expect(
      selectNucleiTargets(
        {
          normalizedTarget: "https://app.example.co.uk/login",
        } as typeof import("@/drizzle/schema").scans.$inferSelect,
        {
          url: "https://app.example.co.uk/login",
          finalUrl: "https://www.example.co.uk/dashboard",
        } as typeof import("@/drizzle/schema").scanResults.$inferSelect,
      ),
    ).toEqual({
      targetUrl: "https://www.example.co.uk/dashboard",
      targetHost: "www.example.co.uk",
      originalDomainTarget: "example.co.uk",
      finalDomainTarget: "example.co.uk",
      domainTarget: "example.co.uk",
    });
  });

  it("derives the original registrable domain from scheme-less stored url targets", () => {
    expect(
      selectNucleiTargets(
        {
          normalizedTarget: "app.example.co.uk/login",
        } as typeof import("@/drizzle/schema").scans.$inferSelect,
        {
          url: "https://app.example.co.uk/login",
          finalUrl: "https://www.example.co.uk/dashboard",
        } as typeof import("@/drizzle/schema").scanResults.$inferSelect,
      ),
    ).toEqual({
      targetUrl: "https://www.example.co.uk/dashboard",
      targetHost: "www.example.co.uk",
      originalDomainTarget: "example.co.uk",
      finalDomainTarget: "example.co.uk",
      domainTarget: "example.co.uk",
    });
  });

  it("omits the domain target for ip-based inputs", () => {
    expect(
      selectNucleiTargets(
        {
          normalizedTarget: "https://192.0.2.10/login",
        } as typeof import("@/drizzle/schema").scans.$inferSelect,
        {
          url: "https://192.0.2.10/login",
          finalUrl: "https://192.0.2.10/home",
        } as typeof import("@/drizzle/schema").scanResults.$inferSelect,
      ),
    ).toEqual({
      targetUrl: "https://192.0.2.10/home",
      targetHost: "192.0.2.10",
      originalDomainTarget: null,
      finalDomainTarget: null,
      domainTarget: null,
    });
  });
});

describe("buildRetryTargets", () => {
  it("rebuilds fallback retry targets as runnable https urls for scheme-less stored url targets", () => {
    expect(
      buildRetryTargets(
        {
          normalizedTarget: "path-target.example.test/about",
        } as typeof import("@/drizzle/schema").scans.$inferSelect,
        "browser_headers",
        null,
      ),
    ).toEqual(["https://path-target.example.test/about"]);
  });

  it("prefers the forbidden retry url for the final fallback profile", () => {
    expect(
      buildRetryTargets(
        {
          normalizedTarget: "path-target.example.test/about",
        } as typeof import("@/drizzle/schema").scans.$inferSelect,
        "tlsi_final_url",
        "https://path-target.example.test/login",
      ),
    ).toEqual(["https://path-target.example.test/login"]);
  });
});

describe("buildAttemptFallbackDecision", () => {
  it("does not fall back when incidental sibling 403s exist but the authoritative row is not blocked", () => {
    expect(
      buildAttemptFallbackDecision("baseline", {
        authoritativeResultStatusCode: 200,
        authoritativeRetryUrl: "https://payments.example.test",
      }),
    ).toEqual({
      shouldFallback: false,
      nextProfile: null,
      retryUrl: null,
      reason: "authoritative_result_not_blocked",
    });
  });

  it("falls back when the authoritative row itself is blocked", () => {
    expect(
      buildAttemptFallbackDecision("browser_headers", {
        authoritativeResultStatusCode: 403,
        authoritativeRetryUrl: "https://path-target.example.test/login",
      }),
    ).toEqual({
      shouldFallback: true,
      nextProfile: "tlsi_final_url",
      retryUrl: "https://path-target.example.test/login",
      reason: "authoritative_result_blocked",
    });
  });

  it("falls back when a non-final attempt returns no authoritative row", () => {
    expect(
      buildAttemptFallbackDecision("baseline", {
        authoritativeResultStatusCode: null,
        authoritativeRetryUrl: null,
      }),
    ).toEqual({
      shouldFallback: true,
      nextProfile: "browser_headers",
      retryUrl: null,
      reason: "authoritative_result_missing",
    });
  });

  it("stops retrying after the final fallback profile returns no authoritative row", () => {
    expect(
      buildAttemptFallbackDecision("tlsi_final_url", {
        authoritativeResultStatusCode: null,
        authoritativeRetryUrl: null,
      }),
    ).toEqual({
      shouldFallback: false,
      nextProfile: null,
      retryUrl: null,
      reason: "fallback_exhausted",
    });
  });

  it("stops retrying after the final fallback profile even when the authoritative row is still blocked", () => {
    expect(
      buildAttemptFallbackDecision("tlsi_final_url", {
        authoritativeResultStatusCode: 403,
        authoritativeRetryUrl: "https://path-target.example.test/login",
      }),
    ).toEqual({
      shouldFallback: false,
      nextProfile: null,
      retryUrl: "https://path-target.example.test/login",
      reason: "fallback_exhausted",
    });
  });
});

describe("buildNucleiExecutionPhases", () => {
  it("runs domain templates for both original and final domains when they differ", () => {
    expect(
      buildNucleiExecutionPhases({
        targetUrl: "https://www.beta-company.test/dashboard",
        targetHost: "www.beta-company.test",
        originalDomainTarget: "alpha-company.test",
        finalDomainTarget: "beta-company.test",
        domainTarget: "alpha-company.test",
      }),
    ).toEqual([
      {
        subject: "alpha-company.test",
        subjectType: "domain",
        templateIds: [
          "dns-saas-service-detection",
          "mx-service-detector",
          "txt-fingerprint",
          "replit-dns-verification",
        ],
      },
      {
        subject: "alpha-company.test",
        subjectType: "domain",
        templateIds: ["rdap-whois"],
        disableRedirects: false,
      },
      {
        subject: "alpha-company.test",
        subjectType: "domain",
        templateIds: ["txt-service-detect"],
        includeTags: ["txt-service"],
      },
      {
        subject: "beta-company.test",
        subjectType: "domain",
        templateIds: [
          "dns-saas-service-detection",
          "mx-service-detector",
          "txt-fingerprint",
          "replit-dns-verification",
        ],
      },
      {
        subject: "beta-company.test",
        subjectType: "domain",
        templateIds: ["rdap-whois"],
        disableRedirects: false,
      },
      {
        subject: "beta-company.test",
        subjectType: "domain",
        templateIds: ["txt-service-detect"],
        includeTags: ["txt-service"],
      },
      {
        subject: "https://www.beta-company.test/dashboard",
        subjectType: "url",
        templateIds: [
          "ssl-dns-names",
          "ssl-issuer",
          "fingerprinthub-web-fingerprints",
          "tech-detect",
          "robots-txt",
        ],
      },
    ]);
  });

  it("runs one domain phase when original and final registrable domains are the same", () => {
    expect(
      buildNucleiExecutionPhases({
        targetUrl: "https://www.example.com/dashboard",
        targetHost: "www.example.com",
        originalDomainTarget: "example.com",
        finalDomainTarget: "example.com",
        domainTarget: "example.com",
        }),
    ).toHaveLength(4);
  });

  it("isolates txt-service-detect into its own domain phase", () => {
    expect(
      buildNucleiExecutionPhases({
        targetUrl: "https://www.example.com/dashboard",
        targetHost: "www.example.com",
        originalDomainTarget: "example.com",
        finalDomainTarget: "example.com",
        domainTarget: "example.com",
      }).filter((phase) => phase.includeTags?.includes("txt-service")),
    ).toEqual([
      {
        subject: "example.com",
        subjectType: "domain",
        templateIds: ["txt-service-detect"],
        includeTags: ["txt-service"],
      },
    ]);
  });

  it("gives RDAP its own domain phase with redirects enabled", () => {
    expect(
      buildNucleiExecutionPhases({
        targetUrl: "https://www.example.com/dashboard",
        targetHost: "www.example.com",
        originalDomainTarget: "example.com",
        finalDomainTarget: "example.com",
        domainTarget: "example.com",
      }).filter((phase) => phase.templateIds.includes("rdap-whois")),
    ).toEqual([
      {
        subject: "example.com",
        subjectType: "domain",
        templateIds: ["rdap-whois"],
        disableRedirects: false,
      },
    ]);
  });
});
