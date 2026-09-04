import { describe, expect, it } from "vitest";

import { resolveConfiguredInstanceOrigin } from "./public-origin-config.ts";

describe("resolveConfiguredInstanceOrigin", () => {
  it("prefers and normalizes BETTER_AUTH_URL", () => {
    expect(resolveConfiguredInstanceOrigin({
      BETTER_AUTH_URL: "https://stackray.example/auth/callback",
      RAILWAY_PUBLIC_DOMAIN: "generated.up.railway.app",
    })).toBe("https://stackray.example");
  });

  it("builds an HTTPS origin from Railway's public domain", () => {
    expect(resolveConfiguredInstanceOrigin({
      RAILWAY_PUBLIC_DOMAIN: "stackray.example",
    })).toBe("https://stackray.example");
  });

  it("does not invent a localhost production origin", () => {
    expect(resolveConfiguredInstanceOrigin({})).toBeNull();
  });
});
