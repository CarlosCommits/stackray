import type { ScanChangeItem } from "../contracts/changes.ts";
import {
  getChangeTypeDefinition,
  type KnownChangeType,
} from "./change-types.ts";

type PreviewEvidence = Pick<
  ScanChangeItem,
  "after" | "before" | "endpointIdentity" | "fieldPath"
>;

type PreviewSampleDefinition = Omit<PreviewEvidence, "endpointIdentity"> & {
  endpointPath?: string;
};

const SAMPLE_BY_CHANGE_TYPE = {
  "status.changed": {
    fieldPath: "statusCode",
    endpointPath: "/api/health",
    before: 200,
    after: 503,
  },
  "redirect.changed": {
    fieldPath: "redirectChain",
    before: { finalUrl: "https://example.com/" },
    after: { finalUrl: "https://www.example.com/" },
  },
  "body_fingerprint.changed": {
    fieldPath: "bodyHashes",
    before: { algorithm: "simhash", hashes: { body_simhash: "9899964551385036782" } },
    after: { algorithm: "simhash", hashes: { body_simhash: "9899964551385036769" } },
  },
  "response_headers.changed": {
    fieldPath: "headers",
    before: { values: { "cache-control": "max-age=0", "x-powered-by": "Express" } },
    after: {
      mode: "both",
      added: ["content-security-policy"],
      removed: ["x-powered-by"],
      semanticChanged: ["cache-control"],
      values: { "cache-control": "public, max-age=3600" },
    },
  },
  "favicon.changed": {
    fieldPath: "favicon.hash",
    before: { value: "a13d9f4c2e18" },
    after: { value: "7bf26e1a90c4" },
  },
  "favicon_location.changed": {
    fieldPath: "favicon.location",
    before: "/favicon.ico",
    after: "/icon-192.png",
  },
  "dns.host_ip_changed": {
    fieldPath: "hostIp",
    before: "203.0.113.10",
    after: "198.51.100.24",
  },
  "dns.a_changed": {
    fieldPath: "dns.a",
    before: { removed: ["203.0.113.10"] },
    after: { added: ["198.51.100.24", "198.51.100.25"] },
  },
  "dns.aaaa_changed": {
    fieldPath: "dns.aaaa",
    before: { removed: ["2606:4700:10::6816:1"] },
    after: { added: ["2606:4700:10::6816:2", "2606:4700:10::ac43:1"] },
  },
  "dns.cname_changed": {
    fieldPath: "dns.cname",
    before: { removed: ["origin-old.example.net"] },
    after: { added: ["origin-new.example.net"] },
  },
  "tls.certificate_changed": {
    fieldPath: "tls.certificateFingerprint",
    before: { fingerprint: "72:2D:88:41:AC:19" },
    after: { fingerprint: "15:8A:6C:90:BE:42" },
  },
  "tls.jarm_changed": {
    fieldPath: "tls.jarm",
    before: "2ad2ad0002ad2ad22c42d42d000000",
    after: "3fd3fd0003fd3fd21c42d43d000000",
  },
  "technology.changed": {
    fieldPath: "technologies",
    before: { removed: ["React 18", "Webpack 5"] },
    after: { added: ["React 19", "Next.js 16", "Turbopack"] },
  },
  "cpe.changed": {
    fieldPath: "cpe",
    before: { removed: ["cpe:2.3:a:example:server:1.4:*:*:*:*:*:*:*"] },
    after: { added: ["cpe:2.3:a:example:server:1.5:*:*:*:*:*:*:*"] },
  },
  "metadata.title_changed": {
    fieldPath: "title",
    before: "Example | Developer platform",
    after: "Example | Build and deploy",
  },
  "metadata.server_changed": {
    fieldPath: "server",
    before: "nginx/1.24",
    after: "Caddy",
  },
  "metadata.content_type_changed": {
    fieldPath: "contentType",
    before: "text/html; charset=utf-8",
    after: "application/json; charset=utf-8",
  },
  "metadata.cdn_changed": {
    fieldPath: "cdn",
    before: { name: "Cloudflare" },
    after: { name: "Fastly" },
  },
  "metadata.capabilities_changed": {
    fieldPath: "capabilities",
    before: { http2: true, pipeline: false, vhost: false, websocket: true },
    after: { http2: true, pipeline: true, vhost: true, websocket: true },
  },
} satisfies Record<KnownChangeType, PreviewSampleDefinition>;

function targetOrigin(target: string) {
  try {
    return new URL(target.includes("://") ? target : `https://${target}`).origin;
  } catch {
    return "https://example.com";
  }
}

export function createChangePreviewSample(
  changeType: KnownChangeType,
  target: string,
  index = 0,
): ScanChangeItem {
  const definition = getChangeTypeDefinition(changeType);
  const sample: PreviewSampleDefinition = SAMPLE_BY_CHANGE_TYPE[changeType];

  if (!definition) {
    throw new Error(`No change definition exists for ${changeType}.`);
  }

  return {
    id: `preview-${index + 1}-${changeType.replaceAll(".", "-")}`,
    category: definition.category,
    changeType,
    fieldPath: sample.fieldPath,
    summary: definition.label,
    endpointIdentity: sample.endpointPath
      ? new URL(sample.endpointPath, targetOrigin(target)).toString()
      : null,
    before: sample.before,
    after: sample.after,
    alertEligible: true,
  };
}
