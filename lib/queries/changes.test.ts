import { describe, expect, it } from "vitest";

import { parseChangeFeedPageQuery } from "@/lib/queries/changes";

describe("change feed query parsing", () => {
  it("applies bounded defaults", () => {
    expect(parseChangeFeedPageQuery({})).toEqual({
      cursor: null,
      limit: 30,
      category: null,
      target: null,
    });
  });

  it("accepts supported filters and caps the page size", () => {
    expect(parseChangeFeedPageQuery({
      cursor: "cursor_01",
      limit: "500",
      category: "content",
      target: " example.com ",
    })).toEqual({
      cursor: "cursor_01",
      limit: 100,
      category: "content",
      target: "example.com",
    });
  });

  it("ignores invalid enum filters and page sizes", () => {
    expect(parseChangeFeedPageQuery({
      limit: "-1",
      category: "headers",
    })).toMatchObject({
      limit: 30,
      category: null,
    });
  });
});
