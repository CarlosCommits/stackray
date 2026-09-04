import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ChangeTypeIcon,
  formatEndpointForDisplay,
  getChangePreview,
  getChangeTitle,
} from "@/components/changes/change-presentation";
import { CHANGE_TYPE_DEFINITIONS } from "@/lib/changes/change-types";
import type { ScanChangeItem } from "@/lib/contracts/changes";

function change(overrides: Partial<ScanChangeItem>): ScanChangeItem {
  return {
    id: "change-1",
    category: "content",
    changeType: "body_fingerprint.changed",
    fieldPath: "endpoints./.bodyFingerprint",
    summary: "Legacy summary",
    endpointIdentity: "https://example.com/",
    before: null,
    after: null,
    alertEligible: true,
    ...overrides,
  };
}

describe("change presentation", () => {
  it("defines a title and a distinct icon for every supported change type", () => {
    const iconNames = CHANGE_TYPE_DEFINITIONS.map((definition) => {
      expect(getChangeTitle(change({ changeType: definition.type }))).toBe(definition.label);
      const { container, unmount } = render(<ChangeTypeIcon changeType={definition.type} />);
      const iconName = container.querySelector("svg")?.getAttribute("class");
      unmount();
      return iconName;
    });

    expect(new Set(iconNames).size).toBe(CHANGE_TYPE_DEFINITIONS.length);
  });

  it("uses the Tech Compare navigation icon for technology changes", () => {
    const { container } = render(<ChangeTypeIcon changeType="technology.changed" />);

    expect(container.querySelector("svg")?.getAttribute("class")).toContain("lucide-layers");
  });

  it("summarizes simple scalar and collection changes", () => {
    expect(getChangePreview(change({
      changeType: "status.changed",
      before: 200,
      after: 503,
    }), "example.com")).toBe("200 → 503");

    expect(getChangePreview(change({
      changeType: "technology.changed",
      before: { removed: ["React 18", "Webpack 5"] },
      after: { added: ["React 19", "Next.js 16", "Turbopack"] },
    }), "example.com")).toBe("Added React 19, Next.js 16 +1 · Removed React 18, Webpack 5");

    expect(getChangePreview(change({
      changeType: "response_headers.changed",
      before: {},
      after: { added: ["permissions-policy"], removed: ["x-powered-by"], changed: ["etag", "cache-control"] },
    }), "example.com")).toBe("1 added · 1 removed · 2 modified");

    expect(getChangePreview(change({
      changeType: "metadata.capabilities_changed",
      before: { http2: true, vhost: false, pipeline: false, websocket: true },
      after: { http2: true, vhost: true, pipeline: true, websocket: true },
    }), "example.com")).toBe("Virtual host and HTTP pipelining are now enabled.");

    expect(getChangePreview(change({
      changeType: "favicon_location.changed",
      endpointIdentity: "https://www.example.com/",
      before: "https://example.com/favicon.ico",
      after: "https://example.com/icon-192.png",
    }), "example.com")).toBe("The favicon moved to a different URL.");

    expect(getChangePreview(change({
      changeType: "metadata.content_type_changed",
      before: "text/html; charset=utf-8",
      after: "application/json; charset=utf-8",
    }), "example.com")).toBe("The response format changed from HTML to JSON.");
  });

  it("omits a root endpoint while retaining useful paths and hosts", () => {
    expect(formatEndpointForDisplay("https://example.com/", "example.com")).toBeNull();
    expect(formatEndpointForDisplay("https://example.com/api/health", "example.com")).toBe("/api/health");
    expect(formatEndpointForDisplay("https://api.example.com/", "example.com")).toBe("api.example.com");
  });
});
