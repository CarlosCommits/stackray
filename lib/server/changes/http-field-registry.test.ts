import { describe, expect, it } from "vitest";

import catalog from "./generated/http-field-registry.json" with { type: "json" };

const validStatuses = new Set(["deprecated", "obsoleted", "permanent", "provisional"]);

describe("generated IANA HTTP field registry", () => {
  it("contains unique, referenced field definitions", () => {
    const normalizedNames = catalog.fields.map((field) => field.name.toLowerCase());

    expect(catalog.source).toBe("https://www.iana.org/assignments/http-fields/field-names.csv");
    expect(catalog.fields.length).toBeGreaterThan(250);
    expect(new Set(normalizedNames).size).toBe(catalog.fields.length);

    for (const field of catalog.fields) {
      expect(field.name.trim()).toBe(field.name);
      expect(validStatuses.has(field.status)).toBe(true);
      expect(field.reference).toBeTruthy();
    }
  });

  it("retains specification metadata used to review semantic rules", () => {
    expect(catalog.fields.find((field) => field.name === "Content-Security-Policy")).toMatchObject({
      status: "permanent",
    });
    expect(catalog.fields.find((field) => field.name === "Content-Digest")).toMatchObject({
      structuredType: "Dictionary",
    });
    expect(catalog.fields.find((field) => field.name === "Set-Cookie")).toMatchObject({
      status: "permanent",
    });
  });
});
