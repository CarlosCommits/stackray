// @vitest-environment node

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAttemptFallbackDecision,
  buildRetryTargets,
  buildStackrayResolvedTxtMatches,
  buildStackrayTxtDnsServiceMatches,
  collectStackrayResolvedTxtMatches,
  loadStackrayTxtDnsServiceRules,
  mergeUniqueNucleiMatches,
  parseNucleiTxtServiceRulesTemplate,
  buildNucleiExecutionPhases,
  buildHttpxArguments,
  buildHttpxHeadlessEnrichmentArguments,
  buildHeadlessMetadataPromotion,
  buildNucleiTechnologyDetectionRows,
  buildScreenshotTechnologyDetectionRows,
  buildStoredResultSearchDocument,
  extractHeadlessDocumentObservation,
  extractFaviconFields,
  getHttpxBehaviorOptionsForProfile,
  getNextHttpxRequestProfile,
  isMissingScanQueueSchemaError,
  selectNucleiTargets,
  shouldCaptureHomepageScreenshot,
  runHttpxCli,
} from "@/worker/scan-worker";

const testNucleiTxtServiceTemplate = `id: txt-service-detect

info:
  name: DNS TXT Service - Detect
  severity: info

dns:
  - name: "{{FQDN}}"
    type: TXT
    matchers-condition: or
    matchers:
      - type: word
        name: "google-workspace"
        words:
          - "google-site-verification"

      - type: word
        name: "openai"
        words:
          - "openai-domain-verification"

      - type: word
        name: "stripe"
        words:
          - "stripe-verification"
`;

const testReplitDnsVerificationTemplate = `id: replit-dns-verification

info:
  name: Replit DNS Verification
  severity: info

dns:
  - name: "{{FQDN}}"
    type: TXT
    matchers:
      - type: regex
        name: Replit
        regex:
          - '(?:IN\\s+TXT\\s+"?)?replit-verify=[a-f0-9-]+"?'
`;

const testStackrayDnsServiceTemplate = `id: stackray-dns-service-detection

info:
  name: Stackray DNS Service Detection
  severity: info

dns:
  - name: "{{FQDN}}"
    type: TXT
    matchers-condition: or
    matchers:
      - type: word
        name: "Amazon SES"
        words:
          - "amazonses:"
          - "include:amazonses.com"

      - type: regex
        name: "Pardot Mail"
        regex:
          - '(?i)\\bpardot\\d+='
          - '(?i)\\bsending_domain\\d+='
          - '(?i)\\binclude:aspmx\\.pardot\\.com\\b'

      - type: word
        name: "Mailgun"
        words:
          - "include:mailgun.org"

      - type: regex
        name: "Proofpoint"
        regex:
          - '(?i)\\binclude:[^"\\s]*\\.spf\\.has\\.pphosted\\.com\\b'

      - type: word
        name: "Zoom"
        words:
          - "ZOOM_verify_"
          - "zoom-domain-verification="

      - type: regex
        name: "Cursor"
        regex:
          - 'cursor-domain-verification-[a-z0-9_-]+=[A-Za-z0-9_-]+'

  - name: "{{FQDN}}"
    type: NS
    matchers:
      - type: regex
        name: "Amazon Route 53"
        regex:
          - '(?i)\\bns-\\d+\\.awsdns-\\d+\\.(?:com|net|org|co\\.uk)\\.?'
`;

async function readTestTxtDetectionTemplate(templatePath: string) {
  if (templatePath === "/opt/nuclei-templates/dns/txt-service-detect.yaml") {
    return testNucleiTxtServiceTemplate;
  }

  if (templatePath.endsWith("/worker/nuclei-templates/dns/replit-dns-verification.yaml")) {
    return testReplitDnsVerificationTemplate;
  }

  if (templatePath.endsWith("/worker/nuclei-templates/dns/stackray-dns-service-detection.yaml")) {
    return testStackrayDnsServiceTemplate;
  }

  throw new Error(`Unexpected TXT detection template path: ${templatePath}`);
}

async function loadTestTxtDnsServiceRules() {
  return loadStackrayTxtDnsServiceRules({
    templatesDir: "/opt/nuclei-templates",
    readTemplateFile: readTestTxtDetectionTemplate,
  });
}

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

class SigtermIgnoringHttpxProcess extends FakeHttpxProcess {
  override kill(signal?: NodeJS.Signals | number) {
    this.killed = true;
    this.killSignals.push(signal);

    if (signal === "SIGKILL") {
      this.stdout.end();
      this.stderr.end();
      queueMicrotask(() => {
        this.complete();
      });
    }

    return true;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

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

  it("sends SIGKILL when httpx does not close after SIGTERM", async () => {
    vi.useFakeTimers();

    const process = new SigtermIgnoringHttpxProcess();
    const promise = runHttpxCli({
      command: "httpx",
      args: ["-json"],
      targets: ["https://example.com"],
      timeoutMs: 5,
      spawnProcess: () => process,
      onJsonLine: async () => {},
    });

    await vi.advanceTimersByTimeAsync(5);

    expect(process.killSignals).toContain("SIGTERM");

    await vi.advanceTimersByTimeAsync(1_000);

    expect(process.killSignals).toContain("SIGKILL");

    const result = await promise;

    expect(result.status).toBe("timed_out");
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
    expect(args).toContain("-extract-fqdn");
    expect(args).not.toContain("-csp-probe");
    expect(args).not.toContain("-H");
  });

  it("adds browser-like headers when enabled", () => {
    const args = buildHttpxArguments(
      {
        optionsJson: {},
      } as typeof import("@/lib/db/schema").scans.$inferSelect,
      {
        browserLikeHeaders: true,
        followRedirects: null,
      },
    );

    expect(args).toContain("-H");
    expect(args).toContain(
      "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    expect(args).toContain('Sec-Ch-Ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"');
  });

  it("can disable redirects for a request profile", () => {
    const args = buildHttpxArguments(
      {
        optionsJson: {},
      } as typeof import("@/lib/db/schema").scans.$inferSelect,
      {
        browserLikeHeaders: false,
        followRedirects: false,
      },
    );

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
    expect(args).toContain("-title");
    expect(args).toContain("-favicon");
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
    expect(args).toContain("-title");
    expect(args).toContain("-favicon");
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

describe("buildHeadlessMetadataPromotion", () => {
  it("promotes headless favicon fields when the stored result is missing them", () => {
    expect(
      buildHeadlessMetadataPromotion(
        {
          statusCode: 429,
          title: "Vercel Security Checkpoint",
          faviconMmh3: null,
          faviconMd5: null,
          faviconUrl: null,
          faviconPath: null,
        },
        {
          statusCode: 200,
          url: "https://example.com/",
        },
        "Rendered App",
        {
          faviconMmh3: "895390254",
          faviconMd5: "b1fb28f2c0abf3e0680538f7c027be12",
          faviconUrl: "https://example.com/favicon.ico",
          faviconPath: "/favicon.ico",
        },
      ),
    ).toEqual({
      statusCode: 200,
      finalUrl: "https://example.com/",
      title: "Rendered App",
      faviconMmh3: "895390254",
      faviconMd5: "b1fb28f2c0abf3e0680538f7c027be12",
      faviconUrl: "https://example.com/favicon.ico",
      faviconPath: "/favicon.ico",
    });
  });

  it("promotes the headless title when headless recovers a blocked document", () => {
    expect(
      buildHeadlessMetadataPromotion(
        {
          statusCode: 403,
          title: "Access Denied",
          faviconMmh3: null,
          faviconMd5: null,
          faviconUrl: null,
          faviconPath: null,
        },
        {
          statusCode: 200,
          url: "https://www.brand-content.example.test/us-en",
        },
        "Red Bull Energy Drink - Gives You Wiiings",
        {
          faviconMmh3: null,
          faviconMd5: null,
          faviconUrl: null,
          faviconPath: null,
        },
      ),
    ).toEqual({
      statusCode: 200,
      finalUrl: "https://www.brand-content.example.test/us-en",
      title: "Red Bull Energy Drink - Gives You Wiiings",
    });
  });

  it("keeps existing titles when the headless pass does not recover a blocked document", () => {
    expect(
      buildHeadlessMetadataPromotion(
        {
          statusCode: 200,
          title: "Existing Title",
          faviconMmh3: null,
          faviconMd5: null,
          faviconUrl: null,
          faviconPath: null,
        },
        {
          statusCode: 200,
          url: "https://example.com/",
        },
        "Different Rendered Title",
        {
          faviconMmh3: null,
          faviconMd5: null,
          faviconUrl: null,
          faviconPath: null,
        },
      ),
    ).toEqual({});
  });

  it("keeps existing favicon fields instead of replacing them from headless enrichment", () => {
    expect(
      buildHeadlessMetadataPromotion(
        {
          statusCode: 200,
          title: "Existing Title",
          faviconMmh3: "123",
          faviconMd5: "existing-md5",
          faviconUrl: "https://example.com/existing.ico",
          faviconPath: "/existing.ico",
        },
        null,
        "Rendered App",
        {
          faviconMmh3: "895390254",
          faviconMd5: "b1fb28f2c0abf3e0680538f7c027be12",
          faviconUrl: "https://example.com/favicon.ico",
          faviconPath: "/favicon.ico",
        },
      ),
    ).toEqual({});
  });
});

describe("shouldCaptureHomepageScreenshot", () => {
  it("allows screenshots for successful html results", () => {
    expect(
      shouldCaptureHomepageScreenshot({
        statusCode: 200,
        contentType: "text/html; charset=utf-8",
        finalUrl: "https://fallback-target.example.test",
        path: null,
      }),
    ).toBe(true);
  });

  it("allows screenshots for redirect responses with html-compatible content", () => {
    expect(
      shouldCaptureHomepageScreenshot({
        statusCode: 302,
        contentType: "",
        finalUrl: "https://fallback-target.example.test",
        path: null,
      }),
    ).toBe(true);
  });

  it("allows screenshots for blocked html results so headless browser recovery can run", () => {
    expect(
      shouldCaptureHomepageScreenshot({
        statusCode: 429,
        contentType: "text/html",
        finalUrl: "https://fallback-target.example.test",
        path: null,
      }),
    ).toBe(true);
  });

  it("does not capture screenshots for non-blocked error results", () => {
    expect(
      shouldCaptureHomepageScreenshot({
        statusCode: 404,
        contentType: "text/html",
        finalUrl: "https://fallback-target.example.test/not-found",
        path: null,
      }),
    ).toBe(false);
  });
});

describe("extractHeadlessDocumentObservation", () => {
  it("reads the browser document status from httpx tdh link requests", () => {
    expect(
      extractHeadlessDocumentObservation({
        link_request: [
          {
            RequestID: "1",
            URL: "https://fallback-target.example.test/",
            Method: "GET",
            ResourceType: "Document",
            StatusCode: 200,
            ErrorType: "",
          },
          {
            URL: "https://fallback-target.example.test/assets/main.js",
            ResourceType: "Script",
            StatusCode: 200,
          },
        ],
      }),
    ).toEqual({
      url: "https://fallback-target.example.test/",
      statusCode: 200,
    });
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
          findingKind: "dns_service",
          matcherName: "Amazon SES",
          technologyName: null,
          technologyVersion: null,
        },
        {
          findingKind: "dns_service",
          matcherName: "Amazon Route 53",
          technologyName: null,
          technologyVersion: null,
        },
        {
          findingKind: "dns_service",
          matcherName: "Zoom",
          technologyName: null,
          technologyVersion: null,
        },
        {
          findingKind: "dns_service",
          matcherName: "Microsoft Azure DNS",
          technologyName: null,
          technologyVersion: null,
        },
        {
          findingKind: "dns_service",
          matcherName: "Cursor",
          technologyName: null,
          technologyVersion: null,
        },
        {
          findingKind: "dns_service",
          matcherName: "Convex",
          technologyName: null,
          technologyVersion: null,
        },
        {
          findingKind: "dns_service",
          matcherName: "openai",
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
      expect.objectContaining({
        resultId: "result-1",
        kind: "technology",
        source: "nuclei",
        name: "Amazon SES",
      }),
      expect.objectContaining({
        resultId: "result-1",
        kind: "technology",
        source: "nuclei",
        name: "Amazon Route 53",
      }),
      expect.objectContaining({
        resultId: "result-1",
        kind: "technology",
        source: "nuclei",
        name: "Zoom",
      }),
      expect.objectContaining({
        resultId: "result-1",
        kind: "technology",
        source: "nuclei",
        name: "Microsoft Azure DNS",
      }),
      expect.objectContaining({
        resultId: "result-1",
        kind: "technology",
        source: "nuclei",
        name: "Cursor",
      }),
      expect.objectContaining({
        resultId: "result-1",
        kind: "technology",
        source: "nuclei",
        name: "Convex",
      }),
      expect.objectContaining({
        resultId: "result-1",
        kind: "technology",
        source: "nuclei",
        name: "OpenAI",
      }),
    ]);
  });
});

describe("buildStackrayTxtDnsServiceMatches", () => {
  it("extracts matcher words from the Nuclei txt-service-detect template", () => {
    expect(parseNucleiTxtServiceRulesTemplate(testNucleiTxtServiceTemplate)).toEqual([
      {
        templateId: "txt-service-detect",
        templatePath: "dns/txt-service-detect.yaml",
        findingKind: "dns_service",
        matcherName: "google-workspace",
        words: ["google-site-verification"],
      },
      {
        templateId: "txt-service-detect",
        templatePath: "dns/txt-service-detect.yaml",
        findingKind: "dns_service",
        matcherName: "openai",
        words: ["openai-domain-verification"],
      },
      {
        templateId: "txt-service-detect",
        templatePath: "dns/txt-service-detect.yaml",
        findingKind: "dns_service",
        matcherName: "stripe",
        words: ["stripe-verification"],
      },
    ]);
  });

  it("materializes high-confidence TXT service evidence as DNS service matches", async () => {
    const matches = buildStackrayTxtDnsServiceMatches({
      subject: "twitch.tv",
      txtRecords: [
        "ZOOM_verify_tSqwymEhP9DPai0Q75XrR1",
        "zoom-domain-verification=secondary-token",
        "amazonses:103ntJItAHAS8zF3zrp1+RajxRQJ4tlPSC9BB4StgBk=",
        "v=spf1 include:_spf.google.com include:amazonses.com -all",
        "v=spf1 include:mailgun.org ~all",
        "v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com include:aspmx.pardot.com ~all",
        "pardot1113342=ea9966a0fc36d5cb2e3e35113da18c2e19a90dabe5d0c7dfadf23e676f7d261f",
        "sending_domain1113342=20e876f12c658fe29b58d63966fae8e881f0bac7d0a4885c7b86aff0882343c5",
        "cursor-domain-verification-nmwzhe=8wrKyUOwEPSBwFK54McJp6vdx",
        "cursor-domain-verification-example=anotherSiteSpecificToken",
        "google-site-verification=xYplJjl14xfWi8VIM2NFWQUeIbrKUg9achbQ5W4AYJA",
      ],
      rules: await loadTestTxtDnsServiceRules(),
    });

    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        templateId: "txt-service-detect",
        templatePath: "dns/txt-service-detect.yaml",
        matcherName: "google-workspace",
        findingKind: "dns_service",
        subject: "twitch.tv",
        extractedResults: ["google-site-verification=xYplJjl14xfWi8VIM2NFWQUeIbrKUg9achbQ5W4AYJA"],
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        templatePath: "dns/stackray-dns-service-detection.yaml",
        matcherName: "Amazon SES",
        findingKind: "dns_service",
        subject: "twitch.tv",
        extractedResults: expect.arrayContaining([
          "amazonses:103ntJItAHAS8zF3zrp1+RajxRQJ4tlPSC9BB4StgBk=",
          "v=spf1 include:_spf.google.com include:amazonses.com -all",
        ]),
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        matcherName: "Mailgun",
        findingKind: "dns_service",
        subject: "twitch.tv",
        extractedResults: ["v=spf1 include:mailgun.org ~all"],
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        matcherName: "Proofpoint",
        findingKind: "dns_service",
        subject: "twitch.tv",
        extractedResults: [
          "v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com include:aspmx.pardot.com ~all",
        ],
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        templatePath: "dns/stackray-dns-service-detection.yaml",
        matcherName: "Pardot Mail",
        findingKind: "dns_service",
        subject: "twitch.tv",
        extractedResults: expect.arrayContaining([
          "v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com include:aspmx.pardot.com ~all",
          "pardot1113342=ea9966a0fc36d5cb2e3e35113da18c2e19a90dabe5d0c7dfadf23e676f7d261f",
          "sending_domain1113342=20e876f12c658fe29b58d63966fae8e881f0bac7d0a4885c7b86aff0882343c5",
        ]),
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        matcherName: "Zoom",
        findingKind: "dns_service",
        subject: "twitch.tv",
        extractedResults: ["ZOOM_verify_tSqwymEhP9DPai0Q75XrR1", "zoom-domain-verification=secondary-token"],
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        matcherName: "Cursor",
        findingKind: "dns_service",
        subject: "twitch.tv",
        extractedResults: [
          "cursor-domain-verification-nmwzhe=8wrKyUOwEPSBwFK54McJp6vdx",
          "cursor-domain-verification-example=anotherSiteSpecificToken",
        ],
      }),
    ]));
  });

  it("requires Cursor verification records to include both a verifier suffix and token", async () => {
    const matches = buildStackrayTxtDnsServiceMatches({
      subject: "example.com",
      txtRecords: [
        "replit-verify=0123456789abcdef",
        "cursor-domain-verification-example=anotherSiteSpecificToken",
        "cursor-domain-verification-",
        "cursor-domain-verification-example",
        "cursor-domain-verification-=missingSuffix",
        "cursor-domain-verification-example=",
      ],
      rules: await loadTestTxtDnsServiceRules(),
    });

    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        templateId: "replit-dns-verification",
        matcherName: "Replit",
        findingKind: "technology",
        technologyName: "Replit",
        extractedResults: ["replit-verify=0123456789abcdef"],
      }),
      expect.objectContaining({
        matcherName: "Cursor",
        extractedResults: ["cursor-domain-verification-example=anotherSiteSpecificToken"],
      }),
    ]));
    expect(matches).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        matcherName: "Cursor",
        extractedResults: expect.arrayContaining([
          "cursor-domain-verification-",
          "cursor-domain-verification-example",
          "cursor-domain-verification-=missingSuffix",
          "cursor-domain-verification-example=",
        ]),
      }),
    ]));
  });

  it("merges DNS service matches by canonical technology name and subject", () => {
    const matches = buildStackrayTxtDnsServiceMatches({
      subject: "example.com",
      txtRecords: [
        "zoom-domain-verification=primary-token",
        "ZOOM_verify_secondary-token",
      ],
      rules: [
        {
          templateId: "txt-service-detect",
          templatePath: "dns/txt-service-detect.yaml",
          findingKind: "dns_service",
          matcherName: "zoom-alternative",
          words: ["zoom-domain-verification="],
        },
        {
          templateId: "stackray-dns-service-detection",
          templatePath: "dns/stackray-dns-service-detection.yaml",
          findingKind: "dns_service",
          matcherName: "Zoom",
          words: ["ZOOM_verify_"],
        },
      ],
    });

    expect(mergeUniqueNucleiMatches(matches)).toEqual([
      expect.objectContaining({
        matcherName: "zoom-alternative",
        findingKind: "dns_service",
        subject: "example.com",
        extractedResults: [
          "zoom-domain-verification=primary-token",
          "ZOOM_verify_secondary-token",
        ],
        rawJson: expect.objectContaining({
          "extracted-results": [
            "zoom-domain-verification=primary-token",
            "ZOOM_verify_secondary-token",
          ],
        }),
      }),
    ]);
  });
});

describe("buildStackrayResolvedTxtMatches", () => {
  it("synthesizes a txt_record match plus DNS service matches from resolved TXT chunks", async () => {
    const matches = buildStackrayResolvedTxtMatches({
      subject: "twitch.tv",
      txtRecords: [
        "google-site-verification=abc123",
        "v=spf1 include:amazonses.com -all",
        "v=spf1 include:mailgun.org ~all",
        "v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com ~all",
        "cursor-domain-verification-nmwzhe=8wrKyUOwEPSBwFK54McJp6vdx",
      ],
      txtRecordChunks: [
        ["google-site-verification=abc", "123"],
        ["v=spf1 include:amazonses.com -all"],
        ["v=spf1 include:mailgun.org ~all"],
        ["v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com ~all"],
        ["cursor-domain-verification-nmwzhe=8wrKyUOwEPSBwFK54McJp6vdx"],
      ],
      rules: await loadTestTxtDnsServiceRules(),
    });

    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        templateId: "txt-fingerprint",
        templatePath: "dns/txt-fingerprint.yaml",
        matcherName: "regex-1",
        findingKind: "txt_record",
        subject: "twitch.tv",
        extractedResults: [
          "google-site-verification=abc123",
          "v=spf1 include:amazonses.com -all",
          "v=spf1 include:mailgun.org ~all",
          "v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com ~all",
          "cursor-domain-verification-nmwzhe=8wrKyUOwEPSBwFK54McJp6vdx",
        ],
        rawJson: expect.objectContaining({
          "stackray-source": "node:dns.resolveTxt",
          "stackray-txt-record-chunks": [
            ["google-site-verification=abc", "123"],
            ["v=spf1 include:amazonses.com -all"],
            ["v=spf1 include:mailgun.org ~all"],
            ["v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com ~all"],
            ["cursor-domain-verification-nmwzhe=8wrKyUOwEPSBwFK54McJp6vdx"],
          ],
        }),
      }),
      expect.objectContaining({
        templateId: "txt-service-detect",
        templatePath: "dns/txt-service-detect.yaml",
        matcherName: "google-workspace",
        findingKind: "dns_service",
        extractedResults: ["google-site-verification=abc123"],
        rawJson: expect.objectContaining({
          "stackray-source": "node:dns.resolveTxt",
        }),
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        templatePath: "dns/stackray-dns-service-detection.yaml",
        matcherName: "Mailgun",
        findingKind: "dns_service",
        extractedResults: ["v=spf1 include:mailgun.org ~all"],
        rawJson: expect.objectContaining({
          "stackray-source": "node:dns.resolveTxt",
        }),
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        templatePath: "dns/stackray-dns-service-detection.yaml",
        matcherName: "Proofpoint",
        findingKind: "dns_service",
        extractedResults: ["v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com ~all"],
        rawJson: expect.objectContaining({
          "stackray-source": "node:dns.resolveTxt",
        }),
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        templatePath: "dns/stackray-dns-service-detection.yaml",
        matcherName: "Amazon SES",
        findingKind: "dns_service",
        extractedResults: ["v=spf1 include:amazonses.com -all"],
        rawJson: expect.objectContaining({
          "stackray-source": "node:dns.resolveTxt",
        }),
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        templatePath: "dns/stackray-dns-service-detection.yaml",
        matcherName: "Cursor",
        findingKind: "dns_service",
        extractedResults: ["cursor-domain-verification-nmwzhe=8wrKyUOwEPSBwFK54McJp6vdx"],
        rawJson: expect.objectContaining({
          "stackray-source": "node:dns.resolveTxt",
        }),
      }),
    ]));
  });
});

describe("collectStackrayResolvedTxtMatches", () => {
  it("uses resolveTxt when no Nuclei txt_record exists for the subject", async () => {
    const matches = await collectStackrayResolvedTxtMatches({
      subjects: ["twitch.tv", "twitch.tv"],
      existingMatches: [],
      templatesDir: "/opt/nuclei-templates",
      readTxtDetectionTemplateFile: readTestTxtDetectionTemplate,
      resolveTxtRecords: async () => [
        ["ZOOM_verify_tSqwymEhP9DPai0Q75XrR1"],
        ["v=spf1 include:amazonses.com -all"],
        ["v=spf1 include:mailgun.org ~all"],
        ["v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com ~all"],
        ["cursor-domain-verification-nmwzhe=8wrKyUOwEPSBwFK54McJp6vdx"],
      ],
    });

    expect(matches).toEqual(expect.arrayContaining([
      expect.objectContaining({
        templateId: "txt-fingerprint",
        findingKind: "txt_record",
        subject: "twitch.tv",
        extractedResults: [
          "ZOOM_verify_tSqwymEhP9DPai0Q75XrR1",
          "v=spf1 include:amazonses.com -all",
          "v=spf1 include:mailgun.org ~all",
          "v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com ~all",
          "cursor-domain-verification-nmwzhe=8wrKyUOwEPSBwFK54McJp6vdx",
        ],
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        matcherName: "Zoom",
        findingKind: "dns_service",
        subject: "twitch.tv",
        extractedResults: ["ZOOM_verify_tSqwymEhP9DPai0Q75XrR1"],
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        matcherName: "Amazon SES",
        findingKind: "dns_service",
        subject: "twitch.tv",
        extractedResults: ["v=spf1 include:amazonses.com -all"],
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        matcherName: "Mailgun",
        findingKind: "dns_service",
        subject: "twitch.tv",
        extractedResults: ["v=spf1 include:mailgun.org ~all"],
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        matcherName: "Proofpoint",
        findingKind: "dns_service",
        subject: "twitch.tv",
        extractedResults: ["v=spf1 include:%{ir}.%{v}.%{d}.spf.has.pphosted.com ~all"],
      }),
      expect.objectContaining({
        templateId: "stackray-dns-service-detection",
        matcherName: "Cursor",
        findingKind: "dns_service",
        subject: "twitch.tv",
        extractedResults: ["cursor-domain-verification-nmwzhe=8wrKyUOwEPSBwFK54McJp6vdx"],
      }),
    ]));
    expect(matches.filter((match) => match.findingKind === "txt_record")).toHaveLength(1);
  });

  it("derives DNS service matches from existing Nuclei txt_record evidence without resolving again", async () => {
    const [existingTxtRecord] = buildStackrayResolvedTxtMatches({
      subject: "example.com",
      txtRecords: ["openai-domain-verification=abc123"],
      rules: await loadTestTxtDnsServiceRules(),
    });

    const matches = await collectStackrayResolvedTxtMatches({
      subjects: ["example.com"],
      existingMatches: [existingTxtRecord],
      templatesDir: "/opt/nuclei-templates",
      readTxtDetectionTemplateFile: readTestTxtDetectionTemplate,
      resolveTxtRecords: async (hostname) => {
        throw new Error(`resolveTxt should not be called for ${hostname}`);
      },
    });

    expect(matches).toEqual([
      expect.objectContaining({
        templateId: "txt-service-detect",
        templatePath: "dns/txt-service-detect.yaml",
        matcherName: "openai",
        findingKind: "dns_service",
        subject: "example.com",
        extractedResults: ["openai-domain-verification=abc123"],
        rawJson: expect.objectContaining({
          "stackray-source": "stackray:existing-txt-record",
        }),
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
      followRedirects: null,
    });
    expect(getHttpxBehaviorOptionsForProfile("browser_headers")).toEqual({
      browserLikeHeaders: true,
      followRedirects: null,
    });
  });

  it("advances fallback profiles only on blocked responses", () => {
    expect(getNextHttpxRequestProfile("baseline")).toBe("browser_headers");
    expect(getNextHttpxRequestProfile("browser_headers")).toBeNull();
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
      ),
    ).toEqual(["https://path-target.example.test/about"]);
  });

  it("ignores retry urls after the tls impersonation fallback was removed", () => {
    expect(
      buildRetryTargets(
        {
          normalizedTarget: "path-target.example.test/about",
        } as typeof import("@/drizzle/schema").scans.$inferSelect,
      ),
    ).toEqual(["https://path-target.example.test/about"]);
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
      buildAttemptFallbackDecision("baseline", {
        authoritativeResultStatusCode: 403,
        authoritativeRetryUrl: "https://path-target.example.test/login",
      }),
    ).toEqual({
      shouldFallback: true,
      nextProfile: "browser_headers",
      retryUrl: "https://path-target.example.test/login",
      reason: "authoritative_result_blocked",
    });
  });

  it("falls back to browser headers when the authoritative row is rate limited", () => {
    expect(
      buildAttemptFallbackDecision("baseline", {
        authoritativeResultStatusCode: 429,
        authoritativeRetryUrl: "https://fallback-target.example.test",
      }),
    ).toEqual({
      shouldFallback: true,
      nextProfile: "browser_headers",
      retryUrl: "https://fallback-target.example.test",
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

  it("stops retrying after the browser-header fallback returns no authoritative row", () => {
    expect(
      buildAttemptFallbackDecision("browser_headers", {
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

  it("stops retrying after the browser-header fallback even when the authoritative row is still blocked", () => {
    expect(
      buildAttemptFallbackDecision("browser_headers", {
        authoritativeResultStatusCode: 429,
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
          "stackray-dns-service-detection",
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
          "stackray-dns-service-detection",
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
