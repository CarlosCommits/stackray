import { describe, expect, it } from "vitest";

import { getExecutionTarget, normalizeTarget } from "@/lib/server/scans/normalize-targets";

describe("normalizeTarget", () => {
  it("collapses scheme-only root variants to the same canonical target", () => {
    expect(normalizeTarget("path-target.example.test")).toMatchObject({
      normalizedTarget: "path-target.example.test",
      targetType: "domain",
    });
    expect(normalizeTarget("https://path-target.example.test")).toMatchObject({
      normalizedTarget: "path-target.example.test",
      targetType: "domain",
    });
    expect(normalizeTarget("http://path-target.example.test/")).toMatchObject({
      normalizedTarget: "path-target.example.test",
      targetType: "domain",
    });
  });

  it("collapses scheme-only path variants to the same canonical target", () => {
    expect(normalizeTarget("path-target.example.test/about")).toMatchObject({
      normalizedTarget: "path-target.example.test/about",
      targetType: "url",
    });
    expect(normalizeTarget("https://path-target.example.test/about")).toMatchObject({
      normalizedTarget: "path-target.example.test/about",
      targetType: "url",
    });
  });

  it("keeps non-default ports, paths, and queries distinct", () => {
    expect(normalizeTarget("https://path-target.example.test:8443")).toMatchObject({
      normalizedTarget: "path-target.example.test:8443",
      targetType: "url",
    });
    expect(normalizeTarget("path-target.example.test/about?ref=nav")).toMatchObject({
      normalizedTarget: "path-target.example.test/about?ref=nav",
      targetType: "url",
    });
  });
});

describe("getExecutionTarget", () => {
  it("adds https for stored scheme-less url targets", () => {
    expect(getExecutionTarget("path-target.example.test/about")).toBe("https://path-target.example.test/about");
    expect(getExecutionTarget("path-target.example.test:8443")).toBe("https://path-target.example.test:8443");
  });

  it("leaves bare domains and schemeful targets intact for execution", () => {
    expect(getExecutionTarget("path-target.example.test")).toBe("path-target.example.test");
    expect(getExecutionTarget("http://path-target.example.test")).toBe("http://path-target.example.test");
  });
});
