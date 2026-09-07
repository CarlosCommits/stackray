import { describe, expect, it } from "vitest";

import { getChangePreview } from "./change-preview";

describe("response header change previews", () => {
  it("describes routine-only evidence without presenting it as meaningful", () => {
    expect(getChangePreview({
      changeType: "response_headers.changed",
      endpointIdentity: "https://example.test/",
      after: {
        mode: "classified",
        changesByDisposition: {
          meaningful: { added: [], changed: [], removed: [] },
          routine: { added: [], changed: ["date", "x-request-id"], removed: [] },
          representation: { added: [], changed: [], removed: [] },
          unknown: { added: [], changed: [], removed: [] },
        },
      },
    }, "https://example.test")).toBe("2 routine");
  });

  it("keeps meaningful change kinds and supporting evidence in one preview", () => {
    expect(getChangePreview({
      changeType: "response_headers.changed",
      endpointIdentity: "https://example.test/api",
      after: {
        mode: "classified",
        changesByDisposition: {
          meaningful: { added: ["permissions-policy"], changed: ["content-security-policy"], removed: [] },
          routine: { added: [], changed: ["date"], removed: [] },
          representation: { added: [], changed: ["etag"], removed: [] },
          unknown: { added: [], changed: [], removed: [] },
        },
      },
    }, "https://example.test")).toBe("1 added · 1 modified · 1 routine · 1 representation · /api");
  });

  it("labels unknown header evidence as other in the UI", () => {
    expect(getChangePreview({
      changeType: "response_headers.changed",
      endpointIdentity: "https://example.test/",
      after: {
        mode: "classified",
        changesByDisposition: {
          meaningful: { added: [], changed: [], removed: [] },
          routine: { added: [], changed: [], removed: [] },
          representation: { added: [], changed: [], removed: [] },
          unknown: { added: [], changed: ["x-example-release"], removed: [] },
        },
      },
    }, "https://example.test")).toBe("1 other");
  });
});
