import { describe, expect, it } from "vitest";

import { escapeLikePattern, matchesTargetIdentity } from "@/lib/targets/search";

describe("target search helpers", () => {
  it("escapes SQL LIKE wildcard characters for literal contains search", () => {
    expect(escapeLikePattern("100%_match\\path")).toBe("100\\%\\_match\\\\path");
  });

  it("escapes single-character wildcard queries as literal search text", () => {
    expect(escapeLikePattern("%")).toBe("\\%");
    expect(escapeLikePattern("_")).toBe("\\_");
  });

  it("matches percent and underscore as literal target identity characters", () => {
    expect(matchesTargetIdentity(["openai.com"], "%")).toBe(false);
    expect(matchesTargetIdentity(["openai.com"], "_")).toBe(false);
    expect(matchesTargetIdentity(["https://example.com/a%20space"], "%")).toBe(true);
    expect(matchesTargetIdentity(["https://example.com/account_analytics"], "_")).toBe(true);
  });
});
