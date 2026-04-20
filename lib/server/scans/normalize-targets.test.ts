import { describe, expect, it } from "vitest";

import { getExecutionTarget, normalizeTarget } from "@/lib/server/scans/normalize-targets";

describe("normalizeTarget", () => {
  it("collapses scheme-only root variants to the same canonical target", () => {
    expect(normalizeTarget("theesa.com")).toMatchObject({
      normalizedTarget: "theesa.com",
      targetType: "domain",
    });
    expect(normalizeTarget("https://theesa.com")).toMatchObject({
      normalizedTarget: "theesa.com",
      targetType: "domain",
    });
    expect(normalizeTarget("http://theesa.com/")).toMatchObject({
      normalizedTarget: "theesa.com",
      targetType: "domain",
    });
  });

  it("collapses scheme-only path variants to the same canonical target", () => {
    expect(normalizeTarget("theesa.com/about")).toMatchObject({
      normalizedTarget: "theesa.com/about",
      targetType: "url",
    });
    expect(normalizeTarget("https://theesa.com/about")).toMatchObject({
      normalizedTarget: "theesa.com/about",
      targetType: "url",
    });
  });

  it("keeps non-default ports, paths, and queries distinct", () => {
    expect(normalizeTarget("https://theesa.com:8443")).toMatchObject({
      normalizedTarget: "theesa.com:8443",
      targetType: "url",
    });
    expect(normalizeTarget("theesa.com/about?ref=nav")).toMatchObject({
      normalizedTarget: "theesa.com/about?ref=nav",
      targetType: "url",
    });
  });
});

describe("getExecutionTarget", () => {
  it("adds https for stored scheme-less url targets", () => {
    expect(getExecutionTarget("theesa.com/about")).toBe("https://theesa.com/about");
    expect(getExecutionTarget("theesa.com:8443")).toBe("https://theesa.com:8443");
  });

  it("leaves bare domains and schemeful targets intact for execution", () => {
    expect(getExecutionTarget("theesa.com")).toBe("theesa.com");
    expect(getExecutionTarget("http://theesa.com")).toBe("http://theesa.com");
  });
});
