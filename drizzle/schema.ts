import { sql } from "drizzle-orm";
import {
  bigserial,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "user", "viewer"]);

export const scanStatusEnum = pgEnum("scan_status", [
  "pending",
  "queued",
  "running",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const scanSourceEnum = pgEnum("scan_source", ["ui", "cli", "api", "system"]);

export const targetTypeEnum = pgEnum("target_type", ["url", "host", "domain"]);

export const attemptStatusEnum = pgEnum("attempt_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const techSourceEnum = pgEnum("technology_source", [
  "wappalyzer",
  "wordpress",
  "cpe",
  "derived",
]);

export const nucleiRunStatusEnum = pgEnum("scan_result_nuclei_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
]);

export const scanEventTypeEnum = pgEnum("scan_event_type", [
  "scan.status",
  "scan.progress",
  "scan.result",
  "scan.complete",
  "scan.failed",
  "scan.cancelled",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  displayName: text("display_name"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: userRoleEnum("role").default("user").notNull(),
  banned: boolean("banned").default(false).notNull(),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  passwordChangeRequiredAt: timestamp("password_change_required_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    impersonatedBy: text("impersonated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_auth_sessions_token").on(table.token),
    index("idx_auth_sessions_user_id").on(table.userId),
  ],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_auth_accounts_provider_account").on(table.providerId, table.accountId),
    index("idx_auth_accounts_user_id").on(table.userId),
  ],
);

export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_auth_verifications_identifier").on(table.identifier)],
);

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    scope: jsonb("scope").$type<Record<string, unknown>>().default({}).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_api_tokens_token_hash").on(table.tokenHash)],
);

export const savedSearches = pgTable("saved_searches", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  query: jsonb("query").$type<Record<string, unknown>>().notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const canonicalTargets = pgTable(
  "canonical_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    normalizedTarget: text("normalized_target").notNull(),
    targetType: targetTypeEnum("target_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.normalizedTarget)],
);

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdByTokenId: uuid("created_by_token_id").references(() => apiTokens.id, { onDelete: "set null" }),
    source: scanSourceEnum("source").notNull(),
    status: scanStatusEnum("status").notNull(),
    profile: text("profile").notNull(),
    idempotencyKey: text("idempotency_key"),
    requestFingerprint: text("request_fingerprint").notNull(),
    requestSchemaVersion: integer("request_schema_version").default(1).notNull(),
    optionsJson: jsonb("options_json").$type<Record<string, unknown>>().notNull(),
    targetCount: integer("target_count").default(0).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancellationRequestedAt: timestamp("cancellation_requested_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_scans_submitted_at").on(table.submittedAt),
    index("idx_scans_status").on(table.status),
    index("idx_scans_request_fingerprint").on(table.requestFingerprint, table.submittedAt),
    uniqueIndex("idx_scans_idempotency_key")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
  ],
);

export const scanTargets = pgTable(
  "scan_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    canonicalTargetId: uuid("canonical_target_id").references(() => canonicalTargets.id, {
      onDelete: "set null",
    }),
    inputTarget: text("input_target").notNull(),
    normalizedTarget: text("normalized_target").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.scanId, table.normalizedTarget)],
);

export const scanAttempts = pgTable(
  "scan_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    workerId: text("worker_id"),
    status: attemptStatusEnum("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    metaJson: jsonb("meta_json").$type<Record<string, unknown>>().default({}).notNull(),
  },
  (table) => [
    unique().on(table.scanId, table.attemptNumber),
    index("idx_scan_attempts_scan_id_status").on(table.scanId, table.status, table.attemptNumber),
  ],
);

export const scanResults = pgTable(
  "scan_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => scanAttempts.id, { onDelete: "cascade" }),
    scanTargetId: uuid("scan_target_id")
      .notNull()
      .references(() => scanTargets.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
    url: text("url"),
    finalUrl: text("final_url"),
    input: text("input"),
    host: text("host"),
    scheme: text("scheme"),
    port: text("port"),
    path: text("path"),
    method: text("method"),
    hostIp: varchar("host_ip", { length: 64 }),
    statusCode: integer("status_code"),
    title: text("title"),
    webServer: text("web_server"),
    location: text("location"),
    contentType: text("content_type"),
    contentLength: bigint("content_length", { mode: "number" }),
    responseTimeMs: integer("response_time_ms"),
    words: integer("words"),
    lines: integer("lines"),
    cdn: boolean("cdn"),
    cdnName: text("cdn_name"),
    cdnType: text("cdn_type"),
    faviconMmh3: text("favicon_mmh3"),
    faviconMd5: text("favicon_md5"),
    faviconUrl: text("favicon_url"),
    faviconPath: text("favicon_path"),
    sni: text("sni"),
    jarmHash: text("jarm_hash"),
    bodyPreview: text("body_preview"),
    rawHeaders: text("raw_headers"),
    responseHeadersJson: jsonb("response_headers_json").$type<Record<string, unknown>>(),
    dnsARecords: jsonb("dns_a_records").$type<string[]>(),
    dnsAaaaRecords: jsonb("dns_aaaa_records").$type<string[]>(),
    dnsCnameRecords: jsonb("dns_cname_records").$type<string[]>(),
    dnsResolvers: jsonb("dns_resolvers").$type<string[]>(),
    asnJson: jsonb("asn_json").$type<Record<string, unknown>>(),
    tlsJson: jsonb("tls_json").$type<Record<string, unknown>>(),
    cspJson: jsonb("csp_json").$type<Record<string, unknown>>(),
    hashesJson: jsonb("hashes_json").$type<Record<string, unknown>>(),
    bodyDomains: jsonb("body_domains").$type<string[]>(),
    bodyFqdns: jsonb("body_fqdns").$type<string[]>(),
    redirectChainStatusCodes: jsonb("redirect_chain_status_codes").$type<number[]>(),
    redirectChainJson: jsonb("redirect_chain_json").$type<Record<string, unknown>[]>(),
    http2: boolean("http2"),
    pipeline: boolean("pipeline"),
    websocket: boolean("websocket"),
    vhost: boolean("vhost"),
    storedResponsePath: text("stored_response_path"),
    screenshotObjectKey: text("screenshot_object_key"),
    screenshotContentType: text("screenshot_content_type"),
    screenshotByteSize: bigint("screenshot_byte_size", { mode: "number" }),
    screenshotCapturedAt: timestamp("screenshot_captured_at", { withTimezone: true }),
    failed: boolean("failed").default(false).notNull(),
    rawJson: jsonb("raw_json").$type<Record<string, unknown>>().notNull(),
    searchDocument: text("search_document"),
  },
  (table) => [
    index("idx_scan_results_scan_id").on(table.scanId),
    index("idx_scan_results_scan_target_id").on(table.scanTargetId),
    index("idx_scan_results_status_code").on(table.statusCode),
    index("idx_scan_results_final_url").on(table.finalUrl),
    index("idx_scan_results_location").on(table.location),
    index("idx_scan_results_host_ip").on(table.hostIp),
    index("idx_scan_results_server").on(table.webServer),
    index("idx_scan_results_cdn_name").on(table.cdnName),
    index("idx_scan_results_jarm_hash").on(table.jarmHash),
    index("idx_scan_results_favicon_mmh3").on(table.faviconMmh3),
  ],
);

export const scanResultTechnologies = pgTable("scan_result_technologies", {
  id: uuid("id").defaultRandom().primaryKey(),
  resultId: uuid("result_id")
    .notNull()
    .references(() => scanResults.id, { onDelete: "cascade" }),
  technologyName: text("technology_name").notNull(),
  technologyVersion: text("technology_version"),
  source: techSourceEnum("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scanResultWordpressPlugins = pgTable(
  "scan_result_wordpress_plugins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => scanResults.id, { onDelete: "cascade" }),
    pluginName: text("plugin_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.resultId, table.pluginName)],
);

export const scanResultWordpressThemes = pgTable(
  "scan_result_wordpress_themes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => scanResults.id, { onDelete: "cascade" }),
    themeName: text("theme_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.resultId, table.themeName)],
);

export const scanResultCpes = pgTable(
  "scan_result_cpes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => scanResults.id, { onDelete: "cascade" }),
    vendor: text("vendor"),
    product: text("product"),
    cpe: text("cpe").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.resultId, table.cpe)],
);

export const scanResultNucleiRuns = pgTable(
  "scan_result_nuclei_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => scanResults.id, { onDelete: "cascade" }),
    status: nucleiRunStatusEnum("status").notNull(),
    targetUrl: text("target_url"),
    targetHost: text("target_host"),
    headersJson: jsonb("headers_json").$type<string[]>().default([]).notNull(),
    templateIdsJson: jsonb("template_ids_json").$type<string[]>().default([]).notNull(),
    engineVersion: text("engine_version"),
    templatesVersion: text("templates_version"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_scan_result_nuclei_runs_result_id").on(table.resultId)],
);

export const scanResultNucleiMatches = pgTable(
  "scan_result_nuclei_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => scanResultNucleiRuns.id, { onDelete: "cascade" }),
    resultId: uuid("result_id")
      .notNull()
      .references(() => scanResults.id, { onDelete: "cascade" }),
    templateId: text("template_id").notNull(),
    templatePath: text("template_path"),
    matcherName: text("matcher_name"),
    protocolType: text("protocol_type"),
    severity: text("severity"),
    matchedAt: text("matched_at"),
    host: text("host"),
    ip: varchar("ip", { length: 64 }),
    port: text("port"),
    scheme: text("scheme"),
    url: text("url"),
    path: text("path"),
    extractedResultsJson: jsonb("extracted_results_json").$type<string[]>().default([]).notNull(),
    technologyName: text("technology_name"),
    technologyVersion: text("technology_version"),
    findingKind: text("finding_kind").notNull(),
    rawJson: jsonb("raw_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_scan_result_nuclei_matches_result_id").on(table.resultId),
    index("idx_scan_result_nuclei_matches_run_id").on(table.runId),
    index("idx_scan_result_nuclei_matches_template_id").on(table.templateId),
  ],
);

export const scanEvents = pgTable(
  "scan_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id").references(() => scanAttempts.id, { onDelete: "cascade" }),
    eventType: scanEventTypeEnum("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_scan_events_scan_id_id").on(table.scanId, table.id)],
);

export const scanComparisons = pgTable(
  "scan_comparisons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    baselineScanId: uuid("baseline_scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    comparisonScanId: uuid("comparison_scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    diffJson: jsonb("diff_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.baselineScanId, table.comparisonScanId)],
);

export type User = typeof users.$inferSelect;
export type Scan = typeof scans.$inferSelect;
export type ScanResult = typeof scanResults.$inferSelect;
