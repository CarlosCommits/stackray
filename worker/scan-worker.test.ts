// @vitest-environment node

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { buildHttpxArguments, runHttpxCli } from "@/worker/scan-worker";

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
});

describe("buildHttpxArguments", () => {
  it("includes stream mode so stdin targets are processed immediately", () => {
    const args = buildHttpxArguments({
      optionsJson: {},
    } as typeof import("@/lib/db/schema").scans.$inferSelect);

    expect(args).toContain("-stream");
    expect(args[0]).toBe("-silent");
    expect(args[1]).toBe("-json");
  });
});
