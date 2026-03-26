import { describe, expect, it } from "vitest";

import { buildTechnologyDisplayModel } from "@/lib/server/scans/technology-display";

describe("buildTechnologyDisplayModel", () => {
  it("promotes WordPress to primary and moves inferred plugins out of the general list", () => {
    const model = buildTechnologyDisplayModel({
      technologies: [
        "CookieYes",
        "Fastly",
        "Google Analytics",
        "Google Tag Manager",
        "MariaDB",
        "MySQL",
        "Nginx",
        "PHP",
        "Pantheon",
        "WordPress",
        "WordPress Block Editor",
        "Yoast SEO Premium:25.8",
        "Yoast SEO:25.8",
      ],
      wordpress: null,
      cpe: [],
    });

    expect(model.primaryTechnologies).toEqual(["WordPress"]);
    expect(model.primaryTechnologyItems).toEqual([{ name: "WordPress", inferred: false }]);
    expect(model.additionalFindings).not.toContain("CookieYes");
    expect(model.additionalFindings).not.toContain("Yoast SEO Premium:25.8");
    expect(model.additionalFindings).not.toContain("Yoast SEO:25.8");
    expect(model.wordpress.plugins).toEqual(["CookieYes", "Yoast SEO Premium", "Yoast SEO"]);
    expect(model.wordpress.pluginItems).toEqual([
      { name: "CookieYes", inferred: true },
      { name: "Yoast SEO Premium", inferred: true },
      { name: "Yoast SEO", inferred: true },
    ]);
  });

  it("dedupes wordpress plugins when httpx provides both plugin slugs and tech labels", () => {
    const model = buildTechnologyDisplayModel({
      technologies: [
        "Instagram Feed for WordPress:6.9.1",
        "Jetpack",
        "PHP",
        "WooCommerce",
        "WordPress",
        "jQuery",
      ],
      wordpress: {
        plugins: ["instagram-feed", "jetpack"],
        themes: ["pro"],
      },
      cpe: [],
    });

    expect(model.primaryTechnologies).toEqual(["WordPress", "WooCommerce"]);
    expect(model.additionalFindings).not.toContain("Jetpack");
    expect(model.additionalFindings).not.toContain("Instagram Feed for WordPress:6.9.1");
    expect(model.wordpress.plugins).toEqual(["Instagram Feed", "Jetpack", "Instagram Feed for WordPress"]);
    expect(model.wordpress.pluginItems).toEqual([
      { name: "Instagram Feed", inferred: false },
      { name: "Jetpack", inferred: false },
      { name: "Instagram Feed for WordPress", inferred: true },
    ]);
    expect(model.wordpress.themes).toEqual(["pro"]);
  });

  it("falls back to the first two technologies when no core platform is detected", () => {
    const model = buildTechnologyDisplayModel({
      technologies: ["Fastly", "Google Analytics", "Nginx", "PHP"],
      wordpress: null,
      cpe: [],
    });

    expect(model.primaryTechnologies).toEqual(["Fastly", "Google Analytics"]);
    expect(model.additionalFindings).toEqual(["Nginx", "PHP"]);
    expect(model.wordpress.plugins).toEqual([]);
    expect(model.primaryTechnologyItems).toEqual([
      { name: "Fastly", inferred: false },
      { name: "Google Analytics", inferred: false },
    ]);
  });
});
