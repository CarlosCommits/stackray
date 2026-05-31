// @vitest-environment node

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSubfinderArguments,
  parseSubfinderJsonLine,
  runSubfinderCli,
} from "@/worker/subfinder";

function flagValue(args: readonly string[], flag: string) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1] ?? null;
}

class FakeSubfinderProcess extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly killSignals: Array<NodeJS.Signals | number | undefined> = [];
  killed = false;

  kill(signal?: NodeJS.Signals | number) {
    this.killed = true;
    this.killSignals.push(signal);
    setImmediate(() => this.close(null));
    return true;
  }

  close(code: number | null = 0) {
    this.stdout.end();
    this.stderr.end();
    this.emit("close", code);
  }
}

class SigtermIgnoringSubfinderProcess extends FakeSubfinderProcess {
  override kill(signal?: NodeJS.Signals | number) {
    this.killed = true;
    this.killSignals.push(signal);

    if (signal === "SIGKILL") {
      setImmediate(() => this.close(null));
    }

    return true;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("buildSubfinderArguments", () => {
  it("builds active validated JSONL arguments with separate source and run budgets", () => {
    expect(buildSubfinderArguments("example.com", {
      sourceTimeoutSeconds: 60,
      maxTimeMinutes: 5,
    })).toEqual([
      "-silent",
      "-json",
      "-d",
      "example.com",
      "-nW",
      "-oI",
      "-duc",
      "-timeout",
      "60",
      "-max-time",
      "5",
    ]);
  });

  it("uses a minimum one-second timeout and one-minute max-time", () => {
    const args = buildSubfinderArguments("example.com", {
      sourceTimeoutSeconds: 0,
      maxTimeMinutes: 0,
    });

    expect(flagValue(args, "-timeout")).toBe("1");
    expect(flagValue(args, "-max-time")).toBe("1");
  });

  it("rounds fractional source and max-time values up", () => {
    const args = buildSubfinderArguments("example.com", {
      sourceTimeoutSeconds: 30.2,
      maxTimeMinutes: 2.1,
    });

    expect(flagValue(args, "-timeout")).toBe("31");
    expect(flagValue(args, "-max-time")).toBe("3");
  });
});

describe("parseSubfinderJsonLine", () => {
  it("normalizes active host/IP/source output", () => {
    expect(parseSubfinderJsonLine({
      host: "App.Example.com",
      input: "example.com",
      ip: "203.0.113.10",
      source: "crtsh",
      wildcard_certificate: true,
    })).toEqual({
      host: "app.example.com",
      input: "example.com",
      ip: "203.0.113.10",
      source: "crtsh",
      sources: [],
      wildcardCertificate: true,
      rawJson: {
        host: "App.Example.com",
        input: "example.com",
        ip: "203.0.113.10",
        source: "crtsh",
        wildcard_certificate: true,
      },
    });
  });

  it("supports source arrays from capture-source JSON", () => {
    expect(parseSubfinderJsonLine({
      host: "api.example.com",
      input: "example.com",
      sources: ["crtsh", "alienvault"],
    })?.sources).toEqual(["crtsh", "alienvault"]);
  });

  it("ignores rows without a host", () => {
    expect(parseSubfinderJsonLine({ ip: "203.0.113.10" })).toBeNull();
  });
});

describe("runSubfinderCli", () => {
  it("terminates the child process and returns failed when JSON handling fails", async () => {
    const process = new FakeSubfinderProcess();
    const run = runSubfinderCli({
      command: "subfinder",
      args: [],
      timeoutMs: 30_000,
      spawnProcess: () => process,
      onJsonLine: () => {
        throw new Error("database insert failed");
      },
    });

    process.stdout.write(`${JSON.stringify({ host: "app.example.com" })}\n`);

    const result = await run;

    expect(result.status).toBe("failed");
    expect(result.stderr).toContain("database insert failed");
    expect(process.killed).toBe(true);
    expect(process.killSignals).toContain("SIGTERM");
  });

  it("catches cancellation check failures and terminates the child process", async () => {
    const process = new FakeSubfinderProcess();
    const run = runSubfinderCli({
      command: "subfinder",
      args: [],
      timeoutMs: 30_000,
      cancellationPollIntervalMs: 5,
      spawnProcess: () => process,
      shouldCancel: async () => {
        throw new Error("cancellation lookup failed");
      },
      onJsonLine: () => {},
    });

    const result = await run;

    expect(result.status).toBe("failed");
    expect(result.stderr).toContain("cancellation lookup failed");
    expect(process.killed).toBe(true);
    expect(process.killSignals).toContain("SIGTERM");
  });

  it("sends SIGKILL when the process does not close after SIGTERM", async () => {
    vi.useFakeTimers();

    const process = new SigtermIgnoringSubfinderProcess();
    const run = runSubfinderCli({
      command: "subfinder",
      args: [],
      timeoutMs: 30_000,
      spawnProcess: () => process,
      onJsonLine: () => {
        throw new Error("database insert failed");
      },
    });

    process.stdout.write(`${JSON.stringify({ host: "app.example.com" })}\n`);

    await vi.waitFor(() => {
      expect(process.killSignals).toContain("SIGTERM");
    });

    await vi.advanceTimersByTimeAsync(1_000);

    await vi.waitFor(() => {
      expect(process.killSignals).toContain("SIGKILL");
    });

    const result = await run;

    expect(result.status).toBe("failed");
  });
});
