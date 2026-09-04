import { isVolatileResponseHeader } from "./response-headers.ts";

export type ChangePreviewItem = {
  after?: unknown;
  before?: unknown;
  changeType: string;
  endpointIdentity: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scalar(value: unknown) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.flatMap((entry) => typeof entry === "string" ? [entry] : []) : [];
}

function compactList(values: readonly string[], limit = 2) {
  if (values.length === 0) return null;
  const visible = values.slice(0, limit).join(", ");
  return values.length > limit ? `${visible} +${values.length - limit}` : visible;
}

function setPreview(before: unknown, after: unknown) {
  const removed = isRecord(before) ? stringArray(before.removed) : [];
  const added = isRecord(after) ? stringArray(after.added) : [];
  const parts = [
    added.length > 0 ? `Added ${compactList(added)}` : null,
    removed.length > 0 ? `Removed ${compactList(removed)}` : null,
  ].flatMap((part) => part ? [part] : []);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function objectName(value: unknown) {
  if (!isRecord(value)) return null;
  return scalar(value.name) ?? scalar(value.type) ?? scalar(value.location) ?? scalar(value.finalUrl);
}

function humanizeCapabilityKey(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function formatConjunction(values: readonly string[]) {
  if (values.length < 2) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function changedCapabilityPreview(before: unknown, after: unknown) {
  if (!isRecord(before) || !isRecord(after)) return null;
  const labels: Record<string, string> = {
    http2: "HTTP/2",
    pipeline: "HTTP pipelining",
    vhost: "Virtual host",
    websocket: "WebSocket",
  };
  const changes = Object.keys({ ...before, ...after }).flatMap((key) => {
    const previous = before[key];
    const current = after[key];
    return typeof previous === "boolean" && typeof current === "boolean" && previous !== current
      ? [{ label: labels[key] ?? humanizeCapabilityKey(key), current }]
      : [];
  });

  if (changes.length === 0) return null;

  const names = formatConjunction(changes.map((change) => change.label));
  if (changes.every((change) => change.current)) {
    return `${names} ${changes.length === 1 ? "is" : "are"} now enabled.`;
  }
  if (changes.every((change) => !change.current)) {
    return `${names} ${changes.length === 1 ? "is" : "are"} now disabled.`;
  }
  return `${names} changed.`;
}

function headerChangeGroup(value: unknown) {
  if (!isRecord(value)) return { added: 0, modified: 0, removed: 0, total: 0 };
  const added = stringArray(value.added).length;
  const removed = stringArray(value.removed).length;
  const modified = stringArray(value.changed).length;
  return { added, modified, removed, total: added + modified + removed };
}

const CONTENT_TYPE_LABELS = new Map([
  ["application/javascript", "JavaScript"],
  ["application/json", "JSON"],
  ["application/pdf", "PDF"],
  ["application/xml", "XML"],
  ["text/css", "CSS"],
  ["text/html", "HTML"],
  ["text/javascript", "JavaScript"],
  ["text/plain", "plain text"],
  ["text/xml", "XML"],
]);

function contentTypeMediaType(value: string | null) {
  return value?.split(";", 1)[0]?.trim().toLowerCase() || null;
}

function contentTypePreview(before: string | null, after: string | null) {
  const previousMediaType = contentTypeMediaType(before);
  const currentMediaType = contentTypeMediaType(after);

  if (!previousMediaType || !currentMediaType) return "The response Content-Type changed.";
  if (previousMediaType === currentMediaType) return "The response Content-Type parameters changed.";

  const previousLabel = CONTENT_TYPE_LABELS.get(previousMediaType) ?? previousMediaType;
  const currentLabel = CONTENT_TYPE_LABELS.get(currentMediaType) ?? currentMediaType;
  return `The response format changed from ${previousLabel} to ${currentLabel}.`;
}

export function formatEndpointForDisplay(endpoint: string | null, target: string) {
  if (!endpoint) return null;

  try {
    const parsed = new URL(endpoint);
    const targetUrl = new URL(target.includes("://") ? target : `https://${target}`);
    const path = `${parsed.pathname}${parsed.search}`;
    if (parsed.hostname === targetUrl.hostname && path === "/") return null;
    if (parsed.hostname === targetUrl.hostname) return path;
    return path === "/" ? parsed.hostname : `${parsed.hostname}${path}`;
  } catch {
    return endpoint;
  }
}

export function getChangePreview(item: ChangePreviewItem, target: string) {
  const before = scalar(item.before);
  const after = scalar(item.after);
  let preview: string | null = null;

  switch (item.changeType) {
    case "status.changed":
    case "dns.host_ip_changed":
    case "metadata.title_changed":
    case "metadata.server_changed":
    case "tls.jarm_changed":
      preview = before !== null && after !== null ? `${before} → ${after}` : null;
      break;
    case "metadata.content_type_changed":
      return contentTypePreview(before, after);
    case "favicon_location.changed":
      return "The favicon moved to a different URL.";
    case "dns.a_changed":
    case "dns.aaaa_changed":
    case "dns.cname_changed":
    case "technology.changed":
    case "cpe.changed":
      preview = setPreview(item.before, item.after);
      break;
    case "response_headers.changed": {
      const evidence = isRecord(item.after) ? item.after : {};

      if (evidence.mode === "classified" && isRecord(evidence.changesByDisposition)) {
        const meaningful = headerChangeGroup(evidence.changesByDisposition.meaningful);
        const routine = headerChangeGroup(evidence.changesByDisposition.routine);
        const unknown = headerChangeGroup(evidence.changesByDisposition.unknown);
        const representation = headerChangeGroup(evidence.changesByDisposition.representation);
        const meaningfulParts = [
          meaningful.added > 0 ? `${meaningful.added} added` : null,
          meaningful.removed > 0 ? `${meaningful.removed} removed` : null,
          meaningful.modified > 0 ? `${meaningful.modified} modified` : null,
        ].flatMap((part) => part ? [part] : []);
        const supportingParts = [
          routine.total > 0 ? `${routine.total} routine` : null,
          unknown.total > 0 ? `${unknown.total} other` : null,
          representation.total > 0 ? `${representation.total} representation` : null,
        ].flatMap((part) => part ? [part] : []);

        preview = [...meaningfulParts, ...supportingParts].join(" · ") || null;
        break;
      }

      const added = stringArray(evidence.added).filter((name) => !isVolatileResponseHeader(name)).length;
      const removed = stringArray(evidence.removed).filter((name) => !isVolatileResponseHeader(name)).length;
      const changed = evidence.mode === "both" ? evidence.semanticChanged : evidence.changed;
      const modified = stringArray(changed).filter((name) => !isVolatileResponseHeader(name)).length;
      const parts = [
        added > 0 ? `${added} added` : null,
        removed > 0 ? `${removed} removed` : null,
        modified > 0 ? `${modified} modified` : null,
      ].flatMap((part) => part ? [part] : []);
      preview = parts.length > 0 ? parts.join(" · ") : null;
      break;
    }
    case "redirect.changed":
    case "metadata.cdn_changed": {
      const previous = objectName(item.before);
      const current = objectName(item.after);
      preview = previous && current ? `${previous} → ${current}` : null;
      break;
    }
    case "metadata.capabilities_changed":
      preview = changedCapabilityPreview(item.before, item.after);
      break;
    case "tls.certificate_changed":
      preview = "Certificate fingerprint differs from the baseline";
      break;
    case "body_fingerprint.changed":
      preview = "Response content differs from the baseline";
      break;
    case "favicon.changed":
      preview = "Served icon content differs from the baseline";
      break;
    default:
      preview = null;
  }

  const endpoint = formatEndpointForDisplay(item.endpointIdentity, target);
  return preview && endpoint ? `${preview} · ${endpoint}` : preview ?? endpoint;
}
