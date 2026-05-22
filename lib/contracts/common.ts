import { z } from "zod";

export const isoDateSchema = z.iso.datetime();

export const actorSourceSchema = z.enum(["ui", "cli", "api", "system"]);

export const scanStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const cdnSchema = z.object({
  enabled: z.boolean(),
  name: z.string().nullable(),
  type: z.string().nullable(),
});

export const dnsSchema = z.object({
  hostIp: z.string().nullable(),
  a: z.array(z.string()),
  aaaa: z.array(z.string()),
  cname: z.array(z.string()),
  resolvers: z.array(z.string()),
});

export const asnSchema = z.object({
  asNumber: z.string().nullable(),
  org: z.string().nullable(),
  country: z.string().nullable().optional(),
  range: z.array(z.string()).optional(),
}).passthrough();

export const ipIntelligenceSchema = z.object({
  ip: z.string(),
  providerName: z.string().nullable(),
  providerSource: z.string().nullable(),
  refreshedAt: isoDateSchema.nullable(),
  rdap: z.record(z.string(), z.unknown()),
  bgp: z.record(z.string(), z.unknown()),
  ptr: z.array(z.string()),
  reverseIp: z.object({
    provider: z.string().nullable(),
    enabled: z.boolean(),
    sourceUrl: z.string().nullable(),
    fallbackFrom: z.string().nullable().optional(),
    domains: z.array(z.string()),
    error: z.string().nullable(),
  }),
  internalMatches: z.array(z.object({
    scanId: z.string(),
    resultId: z.string(),
    target: z.string(),
    finalUrl: z.string(),
    title: z.string(),
    observedAt: isoDateSchema,
  })),
  errors: z.record(z.string(), z.unknown()),
}).nullable();

export const tlsSchema = z.object({
  sni: z.string().nullable(),
  jarmHash: z.string().nullable(),
  certificate: z.record(z.string(), z.unknown()),
});

export const faviconSchema = z.object({
  mmh3: z.string().nullable(),
  md5: z.string().nullable(),
  url: z.string().nullable(),
  path: z.string().nullable(),
});

export const screenshotSchema = z.object({
  available: z.boolean(),
  path: z.string().nullable(),
  contentType: z.string().nullable(),
  byteSize: z.number().int().nonnegative().nullable(),
  capturedAt: isoDateSchema.nullable(),
});

export const hashesSchema = z.record(z.string(), z.string());

export const capabilitiesSchema = z.object({
  http2: z.boolean(),
  pipeline: z.boolean(),
  websocket: z.boolean(),
  vhost: z.boolean(),
});

export const redirectChainSchema = z.object({
  statusCodes: z.array(z.number().int()),
  items: z.array(z.record(z.string(), z.unknown())),
});

export const cpeItemSchema = z.object({
  cpe: z.string(),
  vendor: z.string().nullable(),
  product: z.string().nullable(),
});

export const wordpressSchema = z.object({
  plugins: z.array(z.string()),
  themes: z.array(z.string()),
});
