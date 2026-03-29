// @vitest-environment node

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  buildNucleiExecutionPhases,
  buildHttpxArguments,
  getHttpxBehaviorOptionsForProfile,
  getNextHttpxRequestProfile,
  resolveTargetForPayload,
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
});

describe("buildHttpxArguments", () => {
  it("includes stream mode so stdin targets are processed immediately", () => {
    const args = buildHttpxArguments({
      optionsJson: {},
    } as typeof import("@/lib/db/schema").scans.$inferSelect);

    expect(args).toContain("-stream");
    expect(args[0]).toBe("-silent");
    expect(args[1]).toBe("-json");
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

describe("resolveTargetForPayload", () => {
  it("matches the original target when payload fields normalize to it", () => {
    const target = {
      id: "tgt_root",
      normalizedTarget: "https://stripe.com/",
    } as typeof import("@/drizzle/schema").scanTargets.$inferSelect;

    expect(
      resolveTargetForPayload(
        {
          input: "https://stripe.com",
          url: "https://stripe.com",
          final_url: "https://stripe.com",
        },
        [target],
      ),
    ).toEqual(target);
  });

  it("returns null for unmatched subdomain payloads even when only one target exists", () => {
    const target = {
      id: "tgt_root",
      normalizedTarget: "https://stripe.com/",
    } as typeof import("@/drizzle/schema").scanTargets.$inferSelect;

    expect(
      resolveTargetForPayload(
        {
          input: "https://js.stripe.com",
          url: "https://js.stripe.com",
          final_url: "https://js.stripe.com",
        },
        [target],
      ),
    ).toBeNull();
  });
});

describe("selectNucleiTargets", () => {
  it("keeps distinct original and final registrable domains when a redirect changes domains", () => {
    expect(
      selectNucleiTargets(
        {
          normalizedTarget: "https://alphacompany.com/login",
        } as typeof import("@/drizzle/schema").scanTargets.$inferSelect,
        {
          url: "https://alphacompany.com/login",
          finalUrl: "https://www.betacompany.com/dashboard",
        } as typeof import("@/drizzle/schema").scanResults.$inferSelect,
      ),
    ).toEqual({
      targetUrl: "https://www.betacompany.com/dashboard",
      targetHost: "www.betacompany.com",
      originalDomainTarget: "alphacompany.com",
      finalDomainTarget: "betacompany.com",
      domainTarget: "alphacompany.com",
    });
  });

  it("deduplicates the final domain when it matches the original registrable domain", () => {
    expect(
      selectNucleiTargets(
        {
          normalizedTarget: "https://app.example.co.uk/login",
        } as typeof import("@/drizzle/schema").scanTargets.$inferSelect,
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
        } as typeof import("@/drizzle/schema").scanTargets.$inferSelect,
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

describe("buildNucleiExecutionPhases", () => {
  it("runs domain templates for both original and final domains when they differ", () => {
    expect(
      buildNucleiExecutionPhases({
        targetUrl: "https://www.betacompany.com/dashboard",
        targetHost: "www.betacompany.com",
        originalDomainTarget: "alphacompany.com",
        finalDomainTarget: "betacompany.com",
        domainTarget: "alphacompany.com",
      }),
    ).toEqual([
      {
        subject: "alphacompany.com",
        subjectType: "domain",
        templateIds: [
          "dns-saas-service-detection",
          "mx-service-detector",
          "txt-fingerprint",
          "nameserver-fingerprint",
          "rdap-whois-custom",
        ],
      },
      {
        subject: "alphacompany.com",
        subjectType: "domain",
        templateIds: ["txt-service-detect"],
        includeTags: ["txt-service"],
      },
      {
        subject: "betacompany.com",
        subjectType: "domain",
        templateIds: [
          "dns-saas-service-detection",
          "mx-service-detector",
          "txt-fingerprint",
          "nameserver-fingerprint",
          "rdap-whois-custom",
        ],
      },
      {
        subject: "betacompany.com",
        subjectType: "domain",
        templateIds: ["txt-service-detect"],
        includeTags: ["txt-service"],
      },
      {
        subject: "https://www.betacompany.com/dashboard",
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
    ).toHaveLength(3);
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
});
