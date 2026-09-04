import { describe, expect, it } from "vitest";

import { CHANGE_TYPE_DEFINITIONS } from "../../changes/change-types.ts";
import { buildAlertPreview } from "./preview-service.ts";

describe("alert preview service", () => {
  it("uses every production change definition and renders the real email template", () => {
    const preview = buildAlertPreview({
      target: "vercel.com",
      changeTypes: CHANGE_TYPE_DEFINITIONS.map((definition) => definition.type),
    }, new Date("2026-08-29T12:00:00.000Z"));

    expect(preview.email.subject).toBe(
      `[Stackray] ${CHANGE_TYPE_DEFINITIONS.length} monitored changes detected on vercel.com`,
    );
    for (const definition of CHANGE_TYPE_DEFINITIONS) {
      expect(preview.email.html).toContain(definition.label);
    }
  });

  it("shows the same technology summary used by the changes feed", () => {
    const preview = buildAlertPreview({
      target: "example.com",
      changeTypes: ["technology.changed"],
    });

    expect(preview.email.html).toContain("Detected technologies changed");
    expect(preview.email.html).toContain(
      "Added React 19, Next.js 16 +1 · Removed React 18, Webpack 5",
    );
    expect(preview.email.text).toContain("Added React 19, Next.js 16 +1");
  });
});
