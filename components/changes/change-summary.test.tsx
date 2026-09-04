import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ChangeComparisonCard, ChangeItemsPanel } from "@/components/changes/change-summary";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ScanComparison } from "@/lib/contracts/changes";

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest");
});

function comparison(baselineMode: ScanComparison["baselineMode"]): ScanComparison {
  return {
    id: `comparison-${baselineMode}`,
    status: "completed",
    algorithmVersion: 1,
    currentScan: {
      id: "scan-current",
      target: "https://example.test",
      completedAt: "2026-07-18T03:00:00.000Z",
      faviconUrl: null,
    },
    baselineScan: {
      id: "scan-baseline",
      target: "https://example.test",
      completedAt: "2026-07-17T03:00:00.000Z",
    },
    baselineMode,
    counts: {
      total: 0,
      alertEligible: 0,
    },
    items: [],
    errorMessage: null,
    createdAt: "2026-07-18T03:00:01.000Z",
  };
}

describe("ChangeComparisonCard", () => {
  it.each([
    ["previous", "Previous scan"],
    ["pinned", "Pinned baseline"],
    ["ad_hoc", "Ad hoc comparison"],
  ] as const)("renders the persisted %s baseline mode", (baselineMode, label) => {
    render(<ChangeComparisonCard comparison={comparison(baselineMode)} />);

    expect(screen.getByText(label)).toBeVisible();
  });

  it("renders structured header evidence without serialized JSON", () => {
    render(
      <TooltipProvider>
        <ChangeItemsPanel items={[{
          id: "headers-1",
          category: "content",
          changeType: "response_headers.changed",
          fieldPath: "response_headers.changed",
          summary: "Response headers changed",
          endpointIdentity: "https://example.test:443/",
          before: {
            strictFingerprint: "strict-before",
            semanticFingerprint: "semantic-before",
            names: ["cache-control", "permissions-policy"],
            valuesByName: {
              "cache-control": "public, max-age=60",
              "permissions-policy": "camera=()",
            },
            mode: "semantic",
          },
          after: {
            strictFingerprint: "strict-after",
            semanticFingerprint: "semantic-after",
            names: ["etag", "permissions-policy", "referrer-policy"],
            valuesByName: {
              etag: 'W/"new"',
              "permissions-policy": "camera=(self)",
              "referrer-policy": "no-referrer",
            },
            mode: "semantic",
            added: ["etag", "referrer-policy"],
            removed: ["cache-control"],
            changed: ["date", "permissions-policy", "x_vercel_id"],
          },
          alertEligible: true,
        }]} />
      </TooltipProvider>,
    );

    expect(screen.getByRole("columnheader", { name: "Header" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Before" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "After" })).toBeVisible();
    expect(screen.getByText("Added")).toBeVisible();
    expect(screen.getByText("Removed")).toBeVisible();
    expect(screen.getByText("Modified")).toBeVisible();
    expect(screen.getByText("permissions-policy")).toBeVisible();
    expect(screen.queryByText("etag")).not.toBeInTheDocument();
    expect(screen.getByText("cache-control")).toBeVisible();
    expect(screen.getByText("camera=()")).toBeVisible();
    expect(screen.getByText("camera=(self)")).toBeVisible();
    expect(screen.getByText("referrer-policy")).toBeVisible();
    const removedHeaderRow = screen.getByText("cache-control").closest("tr");
    expect(removedHeaderRow).not.toBeNull();
    expect(within(removedHeaderRow!).getByText("Not present")).toHaveClass("text-orange-400");
    expect(screen.queryByText("date")).not.toBeInTheDocument();
    expect(screen.queryByText("x_vercel_id")).not.toBeInTheDocument();
    expect(screen.queryByText("Volatile only")).not.toBeInTheDocument();
    expect(screen.queryByText(/retains header fingerprints/i)).not.toBeInTheDocument();
  });

  it("labels classified routine, representation, and unknown header evidence", () => {
    render(
      <TooltipProvider>
        <ChangeItemsPanel items={[{
          id: "headers-classified",
          category: "content",
          changeType: "response_headers.changed",
          fieldPath: "response_headers.changed",
          summary: "Response headers changed",
          endpointIdentity: "https://example.test/",
          before: {
            mode: "classified",
            valuesByName: {
              date: "Wed, 01 Jan 2025 00:00:00 GMT",
              etag: 'W/"one"',
              "x-example-release": "one",
            },
          },
          after: {
            mode: "classified",
            valuesByName: {
              date: "Wed, 01 Jan 2025 00:01:00 GMT",
              etag: 'W/"two"',
              "x-example-release": "two",
            },
            changesByDisposition: {
              meaningful: { added: [], changed: [], removed: [] },
              routine: { added: [], changed: ["date"], removed: [] },
              representation: { added: [], changed: ["etag"], removed: [] },
              unknown: { added: [], changed: ["x-example-release"], removed: [] },
            },
          },
          alertEligible: false,
        }]} />
      </TooltipProvider>,
    );

    expect(screen.getByText("Modified · Routine")).toBeVisible();
    expect(screen.getByText("Modified · Representation evidence")).toBeVisible();
    expect(screen.getByText("Modified · Other")).toBeVisible();
    expect(screen.getByText("date")).toBeVisible();
    expect(screen.getByText("etag")).toBeVisible();
    expect(screen.getByText("x-example-release")).toBeVisible();
  });

  it("renders DNS record changes as removed and added sets", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "dns-a-1",
        category: "infrastructure",
        changeType: "dns.a_changed",
        fieldPath: "dns.a_changed",
        summary: "IPv4 DNS records changed",
        endpointIdentity: "https://example.test:443/",
        before: { removed: ["64.239.109.1", "64.239.123.193"] },
        after: { added: ["64.239.109.129", "64.239.123.1"] },
        alertEligible: true,
      }]} />,
    );

    expect(screen.getByRole("region", { name: "Removed DNS records" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Added DNS records" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Removed, 2 records" })).toHaveTextContent("Removed · 2");
    expect(screen.getByRole("heading", { name: "Added, 2 records" })).toHaveTextContent("Added · 2");
    expect(document.querySelector("[data-slot='added-removed-evidence']")).toHaveClass(
      "overflow-hidden",
      "rounded-lg",
      "border",
      "sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
      "sm:border-0",
    );
    expect(screen.getByText("64.239.109.1")).toBeVisible();
    expect(screen.getByText("64.239.123.193")).toBeVisible();
    expect(screen.getByText("64.239.109.129")).toBeVisible();
    expect(screen.getByText("64.239.123.1")).toBeVisible();
    expect(screen.queryByText("Before")).not.toBeInTheDocument();
    expect(screen.queryByText("After")).not.toBeInTheDocument();
  });

  it("renders a single CNAME replacement with the shared transition", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "dns-cname-1",
        category: "infrastructure",
        changeType: "dns.cname_changed",
        fieldPath: "dns.cname_changed",
        summary: "CNAME records changed",
        endpointIdentity: "https://www.vercel.com/",
        before: { removed: ["old-edge.vercel-dns.com"] },
        after: { added: ["new-edge.vercel-dns.com"] },
        alertEligible: true,
      }]} />,
    );

    expect(screen.getByRole("group", { name: "CNAME record transition" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Before CNAME record" })).toBeVisible();
    expect(screen.getByRole("region", { name: "After CNAME record" })).toBeVisible();
    expect(screen.getByText("old-edge.vercel-dns.com")).toBeVisible();
    expect(screen.getByText("new-edge.vercel-dns.com")).toBeVisible();
    expect(screen.getByText("www.vercel.com")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Removed DNS records" })).not.toBeInTheDocument();
  });

  it("uses the shared transition for resolved IP changes", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "host-ip-1",
        category: "infrastructure",
        changeType: "dns.host_ip_changed",
        fieldPath: "dns.host_ip_changed",
        summary: "Resolved IP changed",
        endpointIdentity: "https://example.test:443/",
        before: "192.0.2.1",
        after: "192.0.2.2",
        alertEligible: true,
      }]} />,
    );

    expect(screen.getByRole("group", { name: "Resolved IP transition" })).toBeVisible();
    expect(screen.getByText("192.0.2.1")).toBeVisible();
    expect(screen.getByText("192.0.2.2")).toBeVisible();
  });

  it("uses fingerprint comparison tables for TLS certificate and JARM changes", () => {
    render(
      <TooltipProvider>
        <ChangeItemsPanel items={[
          {
            id: "certificate-1",
            category: "tls",
            changeType: "tls.certificate_changed",
            fieldPath: "tls.certificate_changed",
            summary: "TLS certificate changed",
            endpointIdentity: "https://example.test:443/",
            before: { fingerprint: "certificate-before-fingerprint-value" },
            after: { fingerprint: "certificate-current-fingerprint-value" },
            alertEligible: true,
          },
          {
            id: "jarm-1",
            category: "tls",
            changeType: "tls.jarm_changed",
            fieldPath: "tls.jarm_changed",
            summary: "JARM fingerprint changed",
            endpointIdentity: "https://example.test:443/",
            before: "jarm-before-fingerprint-value",
            after: "jarm-current-fingerprint-value",
            alertEligible: true,
          },
        ]} />
      </TooltipProvider>,
    );

    expect(screen.getAllByRole("columnheader", { name: "Fingerprint" })).toHaveLength(2);
    expect(screen.getAllByRole("columnheader", { name: "Before" })).toHaveLength(2);
    expect(screen.getAllByRole("columnheader", { name: "After" })).toHaveLength(2);
    expect(screen.getByText("Certificate")).toBeVisible();
    expect(screen.getByText("JARM")).toBeVisible();
    expect(screen.queryByRole("group", { name: "TLS certificate fingerprint transition" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "JARM fingerprint transition" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy before certificate fingerprint" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy after JARM fingerprint" })).toBeVisible();
  });

  it("uses the added and removed layout for detected technology sets", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "technology-1",
        category: "technology",
        changeType: "technology.changed",
        fieldPath: "technology.changed",
        summary: "Detected technologies changed",
        endpointIdentity: "https://example.test:443/",
        before: { removed: ["React 18", "webpack 5"] },
        after: { added: ["React 19", "Next.js 16", "Turbopack"] },
        alertEligible: true,
      }]} />,
    );

    const removed = screen.getByRole("region", { name: "Removed technologies" });
    const added = screen.getByRole("region", { name: "Added technologies" });

    expect(removed).toBeVisible();
    expect(added).toBeVisible();
    expect(removed.querySelector("svg")).toHaveClass("text-red-400");
    expect(added.querySelector("svg")).toHaveClass("text-emerald-400");
    expect(screen.queryByRole("group", { name: "Detected technology changes" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Removed, 2 technologies" })).toHaveTextContent("Removed · 2");
    expect(screen.getByRole("heading", { name: "Added, 3 technologies" })).toHaveTextContent("Added · 3");
    expect(screen.getByText("React 18")).toBeVisible();
    expect(screen.getByText("React 19")).toBeVisible();
  });

  it("uses context-aware empty copy in added and removed layouts", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "technology-added-only",
        category: "technology",
        changeType: "technology.changed",
        fieldPath: "technology.changed",
        summary: "Detected technologies changed",
        endpointIdentity: "https://example.test:443/",
        before: { removed: [] },
        after: { added: ["React 19"] },
        alertEligible: true,
      }]} />,
    );

    expect(screen.getByText("No technologies")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Removed, 0 technologies" })).toHaveTextContent("Removed · 0");
    expect(screen.getByRole("heading", { name: "Added, 1 technology" })).toHaveTextContent("Added · 1");
    expect(screen.queryByText("No records")).not.toBeInTheDocument();
  });

  it("labels multi-value CNAME fallback evidence as CNAME records", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "dns-cname-many",
        category: "infrastructure",
        changeType: "dns.cname_changed",
        fieldPath: "dns.cname_changed",
        summary: "CNAME records changed",
        endpointIdentity: "https://example.test:443/",
        before: { removed: ["old-a.example.test", "old-b.example.test"] },
        after: { added: ["new-a.example.test", "new-b.example.test"] },
        alertEligible: true,
      }]} />,
    );

    expect(screen.getByRole("region", { name: "Removed CNAME records" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Added CNAME records" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Removed, 2 CNAME records" })).toHaveTextContent("Removed · 2");
    expect(screen.getByRole("heading", { name: "Added, 2 CNAME records" })).toHaveTextContent("Added · 2");
    expect(screen.queryByRole("region", { name: "Removed DNS records" })).not.toBeInTheDocument();
  });

  it("uses the added and removed layout for detected CPE identifier sets", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "cpe-1",
        category: "technology",
        changeType: "cpe.changed",
        fieldPath: "cpe.changed",
        summary: "Detected CPE identifiers changed",
        endpointIdentity: "https://example.test:443/",
        before: { removed: ["cpe:2.3:a:nodejs:node.js:22.0:*:*:*:*:*:*:*"] },
        after: { added: ["cpe:2.3:a:nodejs:node.js:24.0:*:*:*:*:*:*:*"] },
        alertEligible: true,
      }]} />,
    );

    const removed = screen.getByRole("region", { name: "Removed CPE identifiers" });
    const added = screen.getByRole("region", { name: "Added CPE identifiers" });

    expect(removed).toBeVisible();
    expect(added).toBeVisible();
    expect(removed.querySelector("svg")).toHaveClass("text-red-400");
    expect(added.querySelector("svg")).toHaveClass("text-emerald-400");
    expect(screen.queryByRole("group", { name: "Detected CPE identifier changes" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Removed, 1 CPE identifier" })).toHaveTextContent("Removed · 1");
    expect(screen.getByRole("heading", { name: "Added, 1 CPE identifier" })).toHaveTextContent("Added · 1");
  });

  it("renders response body fingerprints as a compact comparison table", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <TooltipProvider>
        <ChangeItemsPanel items={[{
        id: "body-1",
        category: "content",
        changeType: "body_fingerprint.changed",
        fieldPath: "body_fingerprint.changed",
        summary: "Response body changed",
        endpointIdentity: "https://example.test/",
        before: {
          algorithm: "simhash",
          hashes: {
            body_simhash: "9899964551385036782",
          },
        },
        after: {
          algorithm: "simhash",
          hashes: {
            body_simhash: "9899964551385036769",
          },
        },
        alertEligible: true,
        }]} />
      </TooltipProvider>,
    );

    expect(screen.getByText("1 fingerprint signal changed")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Fingerprint" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Before" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "After" })).toBeVisible();
    expect(screen.getByText("SimHash")).toBeVisible();
    expect(screen.getByTitle("9899964551385036782")).toHaveTextContent("9899964551385036782");

    fireEvent.click(screen.getByRole("button", { name: "Copy before SimHash fingerprint" }));
    expect(writeText).toHaveBeenCalledWith("9899964551385036782");
  });

  it("renders retained favicon fingerprints without historical image previews", () => {
    render(
      <TooltipProvider>
        <ChangeItemsPanel items={[{
          id: "favicon-1",
          category: "content",
          changeType: "favicon.changed",
          fieldPath: "favicon.changed",
          summary: "Favicon fingerprint changed",
          endpointIdentity: "https://example.test/",
          before: {
            algorithm: "md5",
            value: "54f3e3892f8c3a5f11ba712fdd7d91c8",
            hashes: {
              md5: "54f3e3892f8c3a5f11ba712fdd7d91c8",
              mmh3: "-1883726194",
            },
            location: "/favicon.ico",
          },
          after: {
            algorithm: "md5",
            value: "cc34b8f12807cdd7db76c8bbf2b97445",
            hashes: {
              md5: "cc34b8f12807cdd7db76c8bbf2b97445",
              mmh3: "2071356481",
            },
            location: "/favicon.ico",
          },
          alertEligible: true,
        }]} />
      </TooltipProvider>,
    );

    expect(screen.getByText("2 fingerprints changed")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Algorithm" })).toBeVisible();
    expect(screen.getByText("MD5")).toBeVisible();
    expect(screen.getByText("MMH3")).toBeVisible();
    expect(screen.getByText("/favicon.ico")).toBeVisible();
    expect(screen.getByText("Stackray stores fingerprints for comparison. Historical favicon images are not retained.")).toBeVisible();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("keeps legacy single-fingerprint favicon changes readable", () => {
    render(
      <TooltipProvider>
        <ChangeItemsPanel items={[{
          id: "favicon-legacy",
          category: "content",
          changeType: "favicon.changed",
          fieldPath: "favicon.changed",
          summary: "Favicon fingerprint changed",
          endpointIdentity: "https://example.test/",
          before: { algorithm: "md5", value: "old" },
          after: { algorithm: "md5", value: "new" },
          alertEligible: true,
        }]} />
      </TooltipProvider>,
    );

    expect(screen.getByText("1 fingerprint changed")).toBeVisible();
    expect(screen.getByTitle("old")).toBeVisible();
    expect(screen.getByTitle("new")).toBeVisible();
    expect(screen.queryByText("Location")).not.toBeInTheDocument();
    expect(screen.queryByText("Not recorded")).not.toBeInTheDocument();
  });

  it("uses before and after terminology for legacy fingerprint evidence", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "favicon-legacy-sha1",
        category: "content",
        changeType: "favicon.changed",
        fieldPath: "favicon.changed",
        summary: "Favicon fingerprint changed",
        endpointIdentity: "https://example.test/",
        before: { algorithm: "sha1", value: "old-sha1" },
        after: { algorithm: "sha1", value: "new-sha1" },
        alertEligible: true,
      }]} />,
    );

    expect(screen.getByText("Before sha1")).toBeVisible();
    expect(screen.getByText("After sha1")).toBeVisible();
    expect(screen.queryByText("Previous sha1")).not.toBeInTheDocument();
  });

  it("renders favicon location changes as a shared-host path transition", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "favicon-location-1",
        category: "content",
        changeType: "favicon_location.changed",
        fieldPath: "favicon_location.changed",
        summary: "Favicon location changed",
        endpointIdentity: "https://www.vercel.com/",
        before: "https://vercel.com/favicon.ico",
        after: "https://vercel.com/icon-192.png",
        alertEligible: false,
      }]} />,
    );

    expect(screen.getByRole("region", { name: "Favicon location transition" })).toBeVisible();
    expect(screen.getByText("Fingerprint unchanged")).toBeVisible();
    expect(screen.getByText("/favicon.ico")).toBeVisible();
    expect(screen.getByText("/icon-192.png")).toBeVisible();
    expect(screen.queryByText("Moved")).not.toBeInTheDocument();
    expect(screen.queryByText("Host")).not.toBeInTheDocument();
    expect(screen.queryByText("https://vercel.com")).not.toBeInTheDocument();
  });

  it("renders HTTP capability evidence as a compact comparison matrix", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "capabilities-1",
        category: "availability",
        changeType: "metadata.capabilities_changed",
        fieldPath: "metadata.capabilities_changed",
        summary: "HTTP capabilities changed",
        endpointIdentity: "https://example.test/",
        before: { http2: true, vhost: false, pipeline: false, websocket: true },
        after: { http2: true, vhost: true, pipeline: true, websocket: true },
        alertEligible: false,
      }]} />,
    );

    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "2 changed · 2 unchanged")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Before" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "After" })).toBeVisible();
    expect(screen.getByText("Virtual host")).toBeVisible();
    expect(screen.getByText("HTTP pipelining")).toBeVisible();
    expect(screen.queryByRole("button", { name: /copy/i })).not.toBeInTheDocument();
  });

  it("renders content type evidence as an attribute comparison matrix", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "content-type-1",
        category: "content",
        changeType: "metadata.content_type_changed",
        fieldPath: "metadata.content_type_changed",
        summary: "Content type changed",
        endpointIdentity: "https://example.test/",
        before: "text/html; charset=utf-8",
        after: "application/json; charset=utf-8",
        alertEligible: false,
      }]} />,
    );

    expect(screen.getByRole("region", { name: "Content type comparison" })).toBeVisible();
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "1 changed · 1 unchanged")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Attribute" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Before" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "After" })).toBeVisible();
    expect(screen.getByText("Media type")).toBeVisible();
    expect(screen.getByText("Charset")).toBeVisible();
    expect(screen.getByText("text/html")).toBeVisible();
    expect(screen.getByText("application/json")).toBeVisible();
    expect(screen.getAllByText("utf-8")).toHaveLength(2);
  });

  it("renders page title evidence as a typographic handoff", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "title-1",
        category: "content",
        changeType: "metadata.title_changed",
        fieldPath: "metadata.title_changed",
        summary: "Page title changed",
        endpointIdentity: "https://example.test/",
        before: "Vercel: Build and deploy the best web experiences",
        after: "Vercel – The AI Cloud",
        alertEligible: false,
      }]} />,
    );

    expect(screen.getByRole("group", { name: "Page title transition" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Before page title" })).toBeVisible();
    expect(screen.getByRole("region", { name: "After page title" })).toBeVisible();
    expect(screen.getByText("Vercel: Build and deploy the best web experiences")).toBeVisible();
    expect(screen.getByText("Vercel – The AI Cloud")).toBeVisible();
    expect(screen.getByText("Before")).toBeVisible();
    expect(screen.getByText("After")).toBeVisible();
  });

  it("renders web server identity evidence as a handoff", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "server-1",
        category: "infrastructure",
        changeType: "metadata.server_changed",
        fieldPath: "metadata.server_changed",
        summary: "Web server identity changed",
        endpointIdentity: "https://example.test/",
        before: "Vercel Edge Network",
        after: "Vercel Frontend Cloud",
        alertEligible: true,
      }]} />,
    );

    expect(screen.getByRole("group", { name: "Web server identity transition" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Before web server identity" })).toBeVisible();
    expect(screen.getByRole("region", { name: "After web server identity" })).toBeVisible();
    expect(screen.getByText("Vercel Edge Network")).toBeVisible();
    expect(screen.getByText("Vercel Frontend Cloud")).toBeVisible();
    expect(screen.queryByText("Identity changed")).not.toBeInTheDocument();
    expect(screen.getByText("Before")).toBeVisible();
    expect(screen.getByText("After")).toBeVisible();
  });

  it("renders CDN identity evidence as an attribute comparison matrix", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "cdn-1",
        category: "infrastructure",
        changeType: "metadata.cdn_changed",
        fieldPath: "metadata.cdn_changed",
        summary: "CDN or WAF identity changed",
        endpointIdentity: "https://example.test/",
        before: { enabled: true, name: "Vercel", type: "cdn" },
        after: { enabled: true, name: "Cloudflare", type: "waf" },
        alertEligible: true,
      }]} />,
    );

    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "2 changed · 1 unchanged")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Attribute" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Before" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "After" })).toBeVisible();
    expect(screen.getByText("Vercel")).toBeVisible();
    expect(screen.getByText("Cloudflare")).toBeVisible();
    expect(screen.getByText("CDN")).toBeVisible();
    expect(screen.getByText("WAF")).toBeVisible();
  });

  it("renders redirect evidence as before and after timelines", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "redirect-1",
        category: "availability",
        changeType: "redirect.changed",
        fieldPath: "redirect.changed",
        summary: "Redirect behavior changed",
        endpointIdentity: "https://vercel.com/",
        before: {
          chain: ["https://vercel.com/", "https://vercel.com/home"],
          location: "https://vercel.com/home",
        },
        after: {
          chain: ["https://vercel.com/", "https://vercel.com/login", "https://vercel.com/dashboard"],
          location: "https://vercel.com/dashboard",
        },
        alertEligible: true,
      }]} />,
    );

    expect(screen.getByRole("region", { name: "Before redirect chain" })).toBeVisible();
    expect(screen.getByRole("region", { name: "After redirect chain" })).toBeVisible();
    expect(screen.getAllByText("vercel.com")).toHaveLength(2);
    expect(screen.getByText("/home")).toBeVisible();
    expect(screen.getByText("/login")).toBeVisible();
    expect(screen.getByText("/dashboard")).toBeVisible();
    expect(screen.getByText("New hop")).toBeVisible();
    expect(screen.getAllByText("Final destination")).toHaveLength(2);
  });

  it("renders HTTP status evidence as a classified status transition", () => {
    render(
      <ChangeItemsPanel items={[{
        id: "status-1",
        category: "availability",
        changeType: "status.changed",
        fieldPath: "status.changed",
        summary: "HTTP status changed from 200 to 503",
        endpointIdentity: "https://vercel.com/",
        before: 200,
        after: 503,
        alertEligible: true,
      }]} />,
    );

    expect(screen.getByRole("region", { name: "Before HTTP status" })).toBeVisible();
    expect(screen.getByRole("region", { name: "After HTTP status" })).toBeVisible();
    expect(screen.getByText("200")).toBeVisible();
    expect(screen.getByText("OK")).toBeVisible();
    expect(screen.getByText("Successful response")).toBeVisible();
    expect(screen.getByText("503")).toBeVisible();
    expect(screen.getByText("Service Unavailable")).toBeVisible();
    expect(screen.getByText("Server error response")).toBeVisible();
    expect(screen.queryByText("The endpoint is no longer returning a successful response.")).not.toBeInTheDocument();
  });
});
