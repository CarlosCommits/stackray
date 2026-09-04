import { isNotNull, sql } from "drizzle-orm";
import {
  bigserial,
  bigint,
  boolean,
  check,
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

export const scanScheduleFrequencyEnum = pgEnum("scan_schedule_frequency", ["daily", "weekly", "monthly"]);

export const scanScheduleRunStatusEnum = pgEnum("scan_schedule_run_status", ["queued", "skipped", "failed"]);

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
  "nuclei",
]);

export const detectionKindEnum = pgEnum("scan_result_detection_kind", [
  "technology",
  "wordpress_plugin",
  "wordpress_theme",
  "cpe",
]);

export const nucleiRunStatusEnum = pgEnum("scan_result_nuclei_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
]);

export const subdomainDiscoveryRunStatusEnum = pgEnum("scan_subdomain_discovery_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
]);

export const scanPhaseKindEnum = pgEnum("scan_phase_kind", [
  "http_probe",
  "headless",
  "browser_fallback",
  "subfinder",
  "nuclei_dns",
  "nuclei_http",
  "ip_intel",
  "finalize",
]);

export const scanPhaseStatusEnum = pgEnum("scan_phase_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "skipped",
  "cancelled",
]);

export const scanEventTypeEnum = pgEnum("scan_event_type", [
  "scan.status",
  "scan.phase",
  "scan.progress",
  "scan.result",
  "scan.complete",
  "scan.failed",
  "scan.cancelled",
]);

export const scanComparisonStatusEnum = pgEnum("scan_comparison_status", [
  "pending",
  "completed",
  "failed",
  "incompatible",
]);

export const monitoringBaselineModeEnum = pgEnum("monitoring_baseline_mode", ["previous", "pinned", "ad_hoc"]);

export const alertChannelTypeEnum = pgEnum("alert_channel_type", ["email", "slack", "webhook"]);

export const alertChannelTestStatusEnum = pgEnum("alert_channel_test_status", [
  "untested",
  "succeeded",
  "failed",
]);

export const alertPolicyStateEnum = pgEnum("alert_policy_state", ["draft", "enabled", "paused"]);

export const alertPolicyCoverageEnum = pgEnum("alert_policy_coverage", [
  "all_targets",
  "selected_targets",
  "selected_schedules",
]);

export const alertEventStateEnum = pgEnum("alert_event_state", [
  "pending",
  "delivering",
  "delivered",
  "partially_failed",
  "failed",
  "suppressed",
]);

export const alertDeliveryStatusEnum = pgEnum("alert_delivery_status", [
  "pending",
  "queued",
  "delivering",
  "retrying",
  "delivered",
  "failed",
  "cancelled",
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
  apiKeyAccessEnabled: boolean("api_key_access_enabled").default(true).notNull(),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  passwordChangeRequiredAt: timestamp("password_change_required_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userProductState = pgTable("user_product_state", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  lastSeenReleaseVersion: text("last_seen_release_version"),
  gettingStartedDismissedAt: timestamp("getting_started_dismissed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const demoScanRateLimits = pgTable(
  "demo_scan_rate_limits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    visitorKeyHash: varchar("visitor_key_hash", { length: 64 }).notNull(),
    day: varchar("day", { length: 10 }).notNull(),
    scanCount: integer("scan_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_demo_scan_rate_limits_visitor_day").on(table.visitorKeyHash, table.day),
    index("idx_demo_scan_rate_limits_day").on(table.day),
  ],
);

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

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    keyHint: text("key_hint"),
    keyHash: text("key_hash").notNull(),
    scope: jsonb("scope").$type<Record<string, unknown>>().default({}).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_api_keys_key_hash").on(table.keyHash)],
);

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

export const scanSchedules = pgTable(
  "scan_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    frequency: scanScheduleFrequencyEnum("frequency").notNull(),
    hour: integer("hour").notNull(),
    minute: integer("minute").notNull(),
    weekday: integer("weekday"),
    dayOfMonth: integer("day_of_month"),
    timezone: text("timezone").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    optionsJson: jsonb("options_json").$type<Record<string, unknown>>().notNull(),
    targetCount: integer("target_count").default(0).notNull(),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_scan_schedules_created_by_user_id").on(table.createdByUserId),
    index("idx_scan_schedules_enabled_next_run_at").on(table.enabled, table.nextRunAt),
  ],
);

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdByApiKeyId: uuid("created_by_api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
    scheduleId: uuid("schedule_id").references(() => scanSchedules.id, { onDelete: "set null" }),
    source: scanSourceEnum("source").notNull(),
    status: scanStatusEnum("status").notNull(),
    profile: text("profile").notNull(),
    idempotencyKey: text("idempotency_key"),
    requestFingerprint: text("request_fingerprint").notNull(),
    requestSchemaVersion: integer("request_schema_version").default(1).notNull(),
    canonicalTargetId: uuid("canonical_target_id").references(() => canonicalTargets.id, { onDelete: "set null" }),
    inputTarget: text("input_target").notNull(),
    normalizedTarget: text("normalized_target").notNull(),
    optionsJson: jsonb("options_json").$type<Record<string, unknown>>().notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    scheduledForAt: timestamp("scheduled_for_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancellationRequestedAt: timestamp("cancellation_requested_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_scans_submitted_at").on(table.submittedAt),
    index("idx_scans_completed_at_id").on(table.completedAt, table.id),
    index("idx_scans_status").on(table.status),
    index("idx_scans_schedule_id").on(table.scheduleId),
    index("idx_scans_canonical_target_status_completed_at").on(
      table.canonicalTargetId,
      table.status,
      table.completedAt,
    ),
    index("idx_scans_canonical_target_submitted_at_id").on(
      table.canonicalTargetId,
      table.submittedAt,
      table.id,
    ),
    index("idx_scans_normalized_target").on(table.normalizedTarget),
    index("idx_scans_input_target_trgm").using("gin", table.inputTarget.op("gin_trgm_ops")),
    index("idx_scans_normalized_target_trgm").using("gin", table.normalizedTarget.op("gin_trgm_ops")),
    index("idx_scans_request_fingerprint").on(table.requestFingerprint, table.submittedAt),
    uniqueIndex("idx_scans_idempotency_key")
      .on(table.idempotencyKey)
      .where(isNotNull(table.idempotencyKey)),
    index("idx_scans_schedule_slot").on(table.scheduleId, table.scheduledForAt),
  ],
);

export const scanScheduleTargets = pgTable(
  "scan_schedule_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => scanSchedules.id, { onDelete: "cascade" }),
    canonicalTargetId: uuid("canonical_target_id").references(() => canonicalTargets.id, {
      onDelete: "set null",
    }),
    inputTarget: text("input_target").notNull(),
    normalizedTarget: text("normalized_target").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.scheduleId, table.normalizedTarget)],
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
    index("idx_scan_results_attempt_id").on(table.attemptId),
    index("idx_scan_results_status_code").on(table.statusCode),
    index("idx_scan_results_final_url").on(table.finalUrl),
    index("idx_scan_results_location").on(table.location),
    index("idx_scan_results_host_ip").on(table.hostIp),
    index("idx_scan_results_server").on(table.webServer),
    index("idx_scan_results_cdn_name").on(table.cdnName),
    index("idx_scan_results_search_document_trgm").using("gin", table.searchDocument.op("gin_trgm_ops")),
    index("idx_scan_results_input_trgm").using("gin", table.input.op("gin_trgm_ops")),
    index("idx_scan_results_url_trgm").using("gin", table.url.op("gin_trgm_ops")),
    index("idx_scan_results_final_url_trgm").using("gin", table.finalUrl.op("gin_trgm_ops")),
    index("idx_scan_results_host_trgm").using("gin", table.host.op("gin_trgm_ops")),
    index("idx_scan_results_title_trgm").using("gin", table.title.op("gin_trgm_ops")),
    index("idx_scan_results_server_trgm").using("gin", table.webServer.op("gin_trgm_ops")),
    index("idx_scan_results_cdn_name_trgm").using("gin", table.cdnName.op("gin_trgm_ops")),
    index("idx_scan_results_jarm_hash").on(table.jarmHash),
    index("idx_scan_results_favicon_mmh3").on(table.faviconMmh3),
  ],
);

export const ipEnrichments = pgTable(
  "ip_enrichments",
  {
    ip: varchar("ip", { length: 64 }).primaryKey(),
    providerName: text("provider_name"),
    providerSource: text("provider_source"),
    rdapJson: jsonb("rdap_json").$type<Record<string, unknown>>(),
    bgpJson: jsonb("bgp_json").$type<Record<string, unknown>>(),
    ptrJson: jsonb("ptr_json").$type<string[]>(),
    reverseIpJson: jsonb("reverse_ip_json").$type<Record<string, unknown>>(),
    errorJson: jsonb("error_json").$type<Record<string, unknown>>(),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_ip_enrichments_provider_name").on(table.providerName),
    index("idx_ip_enrichments_refreshed_at").on(table.refreshedAt),
  ],
);

export const scanResultDetections = pgTable(
  "scan_result_detections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => scanResults.id, { onDelete: "cascade" }),
    kind: detectionKindEnum("kind").notNull(),
    name: text("name").notNull(),
    version: text("version"),
    source: techSourceEnum("source").notNull(),
    slug: text("slug"),
    vendor: text("vendor"),
    product: text("product"),
    cpe: text("cpe"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_scan_result_detections_result_id").on(table.resultId),
    index("idx_scan_result_detections_result_id_kind").on(table.resultId, table.kind),
    index("idx_scan_result_detections_kind_name").on(table.kind, table.name),
    index("idx_scan_result_detections_name_trgm").using("gin", table.name.op("gin_trgm_ops")),
    index("idx_scan_result_detections_slug_trgm").using("gin", table.slug.op("gin_trgm_ops")),
    index("idx_scan_result_detections_vendor_trgm").using("gin", table.vendor.op("gin_trgm_ops")),
    index("idx_scan_result_detections_product_trgm").using("gin", table.product.op("gin_trgm_ops")),
    index("idx_scan_result_detections_cpe_trgm").using("gin", table.cpe.op("gin_trgm_ops")),
  ],
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
    originalDomainTarget: text("original_domain_target"),
    finalDomainTarget: text("final_domain_target"),
    domainTarget: text("domain_target"),
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
    subject: text("subject"),
    subjectType: text("subject_type"),
    rawJson: jsonb("raw_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_scan_result_nuclei_matches_result_id").on(table.resultId),
    index("idx_scan_result_nuclei_matches_run_id").on(table.runId),
    index("idx_scan_result_nuclei_matches_template_id").on(table.templateId),
  ],
);

export const scanSubdomainDiscoveryRuns = pgTable(
  "scan_subdomain_discovery_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => scanAttempts.id, { onDelete: "cascade" }),
    status: subdomainDiscoveryRunStatusEnum("status").notNull(),
    targetDomain: text("target_domain"),
    engineVersion: text("engine_version"),
    errorMessage: text("error_message"),
    resultCount: integer("result_count").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_scan_subdomain_discovery_runs_attempt_id").on(table.attemptId),
    index("idx_scan_subdomain_discovery_runs_scan_id").on(table.scanId),
  ],
);

export const scanSubdomains = pgTable(
  "scan_subdomains",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => scanAttempts.id, { onDelete: "cascade" }),
    runId: uuid("run_id")
      .notNull()
      .references(() => scanSubdomainDiscoveryRuns.id, { onDelete: "cascade" }),
    rootDomain: text("root_domain").notNull(),
    host: text("host").notNull(),
    ip: varchar("ip", { length: 64 }),
    ipKey: text("ip_key").default("").notNull(),
    source: text("source"),
    sourceKey: text("source_key").default("").notNull(),
    wildcardCertificate: boolean("wildcard_certificate").default(false).notNull(),
    rawJson: jsonb("raw_json").$type<Record<string, unknown>>().notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_scan_subdomains_run_host_ip_source_key").on(table.runId, table.host, table.ipKey, table.sourceKey),
    index("idx_scan_subdomains_scan_id").on(table.scanId),
    index("idx_scan_subdomains_run_id").on(table.runId),
    index("idx_scan_subdomains_root_domain").on(table.rootDomain),
    index("idx_scan_subdomains_host").on(table.host),
  ],
);

export const scanPhaseRuns = pgTable(
  "scan_phase_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => scanAttempts.id, { onDelete: "cascade" }),
    resultId: uuid("result_id").references(() => scanResults.id, { onDelete: "set null" }),
    phase: scanPhaseKindEnum("phase").notNull(),
    status: scanPhaseStatusEnum("status").notNull(),
    workerId: text("worker_id"),
    jobKey: text("job_key"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    metaJson: jsonb("meta_json").$type<Record<string, unknown>>().default({}).notNull(),
    queuedAt: timestamp("queued_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_scan_phase_runs_attempt_id_phase").on(table.attemptId, table.phase),
    index("idx_scan_phase_runs_scan_id").on(table.scanId),
    index("idx_scan_phase_runs_status").on(table.status),
    index("idx_scan_phase_runs_phase_status").on(table.phase, table.status),
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

export const scanScheduleRuns = pgTable(
  "scan_schedule_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => scanSchedules.id, { onDelete: "cascade" }),
    status: scanScheduleRunStatusEnum("status").notNull(),
    scheduledForAt: timestamp("scheduled_for_at", { withTimezone: true }).notNull(),
    queuedAt: timestamp("queued_at", { withTimezone: true }),
    queuedScanCount: integer("queued_scan_count").default(0).notNull(),
    skipReason: text("skip_reason"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.scheduleId, table.scheduledForAt),
    index("idx_scan_schedule_runs_schedule_id_created_at").on(table.scheduleId, table.createdAt),
    index("idx_scan_schedule_runs_schedule_id_scheduled_for_at").on(table.scheduleId, table.scheduledForAt),
  ],
);

export const scanScheduleRunScans = pgTable(
  "scan_schedule_run_scans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scheduleRunId: uuid("schedule_run_id")
      .notNull()
      .references(() => scanScheduleRuns.id, { onDelete: "cascade" }),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.scheduleRunId, table.scanId),
    uniqueIndex("idx_scan_schedule_run_scans_scan_id")
      .on(table.scanId),
    index("idx_scan_schedule_run_scans_schedule_run_id_sort_order").on(table.scheduleRunId, table.sortOrder),
  ],
);

export const scanComparisons = pgTable(
  "scan_comparisons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    comparisonScanId: uuid("comparison_scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    baselineScanId: uuid("baseline_scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    baselineMode: monitoringBaselineModeEnum("baseline_mode").default("previous").notNull(),
    canonicalTargetId: uuid("canonical_target_id").references(() => canonicalTargets.id, {
      onDelete: "cascade",
    }),
    comparisonSignature: text("comparison_signature"),
    algorithmVersion: integer("algorithm_version").default(1).notNull(),
    status: scanComparisonStatusEnum("status").default("completed").notNull(),
    changeCount: integer("change_count").default(0).notNull(),
    alertEligibleCount: integer("alert_eligible_count").default(0).notNull(),
    categoryCountsJson: jsonb("category_counts_json")
      .$type<Record<string, number>>()
      .default({})
      .notNull(),
    diffJson: jsonb("diff_json").$type<Record<string, unknown>>().default({}).notNull(),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_scan_comparisons_pair_algorithm").on(
      table.comparisonScanId,
      table.baselineScanId,
      table.algorithmVersion,
    ),
    index("idx_scan_comparisons_current_scan_status").on(table.comparisonScanId, table.status),
    index("idx_scan_comparisons_feed_current_scan")
      .on(table.comparisonScanId, table.id)
      .where(sql`${table.status} = 'completed' AND ${table.baselineMode} <> 'ad_hoc'`),
    index("idx_scan_comparisons_target_created_at").on(table.canonicalTargetId, table.createdAt),
    check(
      "scan_comparisons_distinct_scans",
      sql`${table.comparisonScanId} <> ${table.baselineScanId}`,
    ),
    check(
      "scan_comparisons_nonnegative_counts",
      sql`${table.changeCount} >= 0 AND ${table.alertEligibleCount} >= 0`,
    ),
  ],
);

export const scanChangeItems = pgTable(
  "scan_change_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    comparisonId: uuid("comparison_id")
      .notNull()
      .references(() => scanComparisons.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    endpointIdentity: text("endpoint_identity"),
    baselineResultId: uuid("baseline_result_id").references(() => scanResults.id, { onDelete: "set null" }),
    currentResultId: uuid("current_result_id").references(() => scanResults.id, { onDelete: "set null" }),
    category: text("category").notNull(),
    changeType: text("change_type").notNull(),
    fieldPath: text("field_path"),
    confidence: text("confidence").default("high").notNull(),
    beforeJson: jsonb("before_json").$type<unknown>(),
    afterJson: jsonb("after_json").$type<unknown>(),
    summary: text("summary").notNull(),
    summaryArgsJson: jsonb("summary_args_json")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
    alertEligible: boolean("alert_eligible").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_scan_change_items_comparison_item_key").on(table.comparisonId, table.itemKey),
    index("idx_scan_change_items_comparison_category").on(table.comparisonId, table.category),
    index("idx_scan_change_items_current_result_id").on(table.currentResultId),
    index("idx_scan_change_items_baseline_result_id").on(table.baselineResultId),
  ],
);

export const targetMonitoringSettings = pgTable(
  "target_monitoring_settings",
  {
    canonicalTargetId: uuid("canonical_target_id")
      .primaryKey()
      .references(() => canonicalTargets.id, { onDelete: "cascade" }),
    baselineMode: monitoringBaselineModeEnum("baseline_mode").default("previous").notNull(),
    pinnedBaselineScanId: uuid("pinned_baseline_scan_id").references(() => scans.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    index("idx_target_monitoring_settings_pinned_scan").on(table.pinnedBaselineScanId),
    check(
      "target_monitoring_settings_baseline_consistency",
      sql`(${table.baselineMode} = 'previous' AND ${table.pinnedBaselineScanId} IS NULL) OR (${table.baselineMode} = 'pinned' AND ${table.pinnedBaselineScanId} IS NOT NULL)`,
    ),
  ],
);

export const targetMonitoringBaselineEvents = pgTable(
  "target_monitoring_baseline_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    canonicalTargetId: uuid("canonical_target_id")
      .notNull()
      .references(() => canonicalTargets.id, { onDelete: "cascade" }),
    previousMode: monitoringBaselineModeEnum("previous_mode").notNull(),
    previousPinnedScanId: uuid("previous_pinned_scan_id").references(() => scans.id, {
      onDelete: "set null",
    }),
    newMode: monitoringBaselineModeEnum("new_mode").notNull(),
    newPinnedScanId: uuid("new_pinned_scan_id").references(() => scans.id, { onDelete: "set null" }),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_target_monitoring_baseline_events_target_id").on(table.canonicalTargetId, table.id),
  ],
);

export const instanceRuntimeSettings = pgTable(
  "instance_runtime_settings",
  {
    id: text("id").primaryKey(),
    publicOrigin: text("public_origin").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("instance_runtime_settings_singleton", sql`${table.id} = 'default'`),
  ],
);

export const alertChannels = pgTable(
  "alert_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: text("display_name").notNull(),
    channelType: alertChannelTypeEnum("channel_type").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    configJson: jsonb("config_json").$type<Record<string, unknown>>().default({}).notNull(),
    secretPlaintext: text("secret_plaintext"),
    secretCiphertext: text("secret_ciphertext"),
    secretNonce: text("secret_nonce"),
    secretAuthTag: text("secret_auth_tag"),
    encryptionAlgorithm: text("encryption_algorithm"),
    encryptionKeyVersion: integer("encryption_key_version"),
    lastTestStatus: alertChannelTestStatusEnum("last_test_status").default("untested").notNull(),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    lastTestErrorCategory: text("last_test_error_category"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_alert_channels_type_enabled").on(table.channelType, table.enabled),
    index("idx_alert_channels_deleted_at").on(table.deletedAt),
    check(
      "alert_channels_secret_envelope_complete",
      sql`(${table.secretPlaintext} IS NULL AND ${table.secretCiphertext} IS NULL AND ${table.secretNonce} IS NULL AND ${table.secretAuthTag} IS NULL AND ${table.encryptionAlgorithm} IS NULL AND ${table.encryptionKeyVersion} IS NULL) OR (${table.secretPlaintext} IS NOT NULL AND ${table.secretCiphertext} IS NULL AND ${table.secretNonce} IS NULL AND ${table.secretAuthTag} IS NULL AND ${table.encryptionAlgorithm} IS NULL AND ${table.encryptionKeyVersion} IS NULL) OR (${table.secretPlaintext} IS NULL AND ${table.secretCiphertext} IS NOT NULL AND ${table.secretNonce} IS NOT NULL AND ${table.secretAuthTag} IS NOT NULL AND ${table.encryptionAlgorithm} IS NOT NULL AND ${table.encryptionKeyVersion} IS NOT NULL)`,
    ),
  ],
);

export const emailProviderSettings = pgTable(
  "email_provider_settings",
  {
    id: text("id").primaryKey(),
    provider: text("provider").default("resend").notNull(),
    domainName: text("domain_name").notNull(),
    senderName: text("sender_name").notNull(),
    senderLocalPart: text("sender_local_part").notNull(),
    testRecipient: varchar("test_recipient", { length: 320 }).notNull(),
    oauthClientId: text("oauth_client_id").notNull(),
    oauthScope: text("oauth_scope").notNull(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
    secretPlaintext: text("secret_plaintext"),
    secretCiphertext: text("secret_ciphertext"),
    secretNonce: text("secret_nonce"),
    secretAuthTag: text("secret_auth_tag"),
    encryptionAlgorithm: text("encryption_algorithm"),
    encryptionKeyVersion: integer("encryption_key_version"),
    lastTestStatus: alertChannelTestStatusEnum("last_test_status").default("untested").notNull(),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    lastTestErrorCategory: text("last_test_error_category"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("email_provider_settings_singleton", sql`${table.id} = 'default'`),
    check(
      "email_provider_settings_secret_envelope_complete",
      sql`(${table.secretPlaintext} IS NOT NULL AND ${table.secretCiphertext} IS NULL AND ${table.secretNonce} IS NULL AND ${table.secretAuthTag} IS NULL AND ${table.encryptionAlgorithm} IS NULL AND ${table.encryptionKeyVersion} IS NULL) OR (${table.secretPlaintext} IS NULL AND ${table.secretCiphertext} IS NOT NULL AND ${table.secretNonce} IS NOT NULL AND ${table.secretAuthTag} IS NOT NULL AND ${table.encryptionAlgorithm} IS NOT NULL AND ${table.encryptionKeyVersion} IS NOT NULL)`,
    ),
  ],
);

export const resendOauthSetupSessions = pgTable(
  "resend_oauth_setup_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    oauthScope: text("oauth_scope").notNull(),
    secretPlaintext: text("secret_plaintext"),
    secretCiphertext: text("secret_ciphertext"),
    secretNonce: text("secret_nonce"),
    secretAuthTag: text("secret_auth_tag"),
    encryptionAlgorithm: text("encryption_algorithm"),
    encryptionKeyVersion: integer("encryption_key_version"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_resend_oauth_setup_sessions_user_expires_at").on(table.userId, table.expiresAt),
    check(
      "resend_oauth_setup_sessions_secret_envelope_complete",
      sql`(${table.secretPlaintext} IS NOT NULL AND ${table.secretCiphertext} IS NULL AND ${table.secretNonce} IS NULL AND ${table.secretAuthTag} IS NULL AND ${table.encryptionAlgorithm} IS NULL AND ${table.encryptionKeyVersion} IS NULL) OR (${table.secretPlaintext} IS NULL AND ${table.secretCiphertext} IS NOT NULL AND ${table.secretNonce} IS NOT NULL AND ${table.secretAuthTag} IS NOT NULL AND ${table.encryptionAlgorithm} IS NOT NULL AND ${table.encryptionKeyVersion} IS NOT NULL)`,
    ),
  ],
);

export const alertPolicies = pgTable(
  "alert_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    state: alertPolicyStateEnum("state").default("draft").notNull(),
    coverage: alertPolicyCoverageEnum("coverage").default("all_targets").notNull(),
    conditionsJson: jsonb("conditions_json").$type<Record<string, unknown>>().default({}).notNull(),
    conditionsSchemaVersion: integer("conditions_schema_version").default(2).notNull(),
    cooldownSeconds: integer("cooldown_seconds").default(0).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_alert_policies_state_deleted_at").on(table.state, table.deletedAt),
    check("alert_policies_nonnegative_cooldown", sql`${table.cooldownSeconds} >= 0`),
  ],
);

export const alertPolicyChannels = pgTable(
  "alert_policy_channels",
  {
    policyId: uuid("policy_id")
      .notNull()
      .references(() => alertPolicies.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => alertChannels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_alert_policy_channels_policy_channel").on(table.policyId, table.channelId),
    index("idx_alert_policy_channels_channel_id").on(table.channelId),
  ],
);

export const alertPolicyTargets = pgTable(
  "alert_policy_targets",
  {
    policyId: uuid("policy_id")
      .notNull()
      .references(() => alertPolicies.id, { onDelete: "cascade" }),
    canonicalTargetId: uuid("canonical_target_id")
      .notNull()
      .references(() => canonicalTargets.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_alert_policy_targets_policy_target").on(table.policyId, table.canonicalTargetId),
    index("idx_alert_policy_targets_target_id").on(table.canonicalTargetId),
  ],
);

export const alertPolicySchedules = pgTable(
  "alert_policy_schedules",
  {
    policyId: uuid("policy_id")
      .notNull()
      .references(() => alertPolicies.id, { onDelete: "cascade" }),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => scanSchedules.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_alert_policy_schedules_policy_schedule").on(table.policyId, table.scheduleId),
    index("idx_alert_policy_schedules_schedule_id").on(table.scheduleId),
  ],
);

export const alertEvents = pgTable(
  "alert_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => alertPolicies.id),
    comparisonId: uuid("comparison_id")
      .notNull()
      .references(() => scanComparisons.id, { onDelete: "cascade" }),
    eventType: text("event_type").default("scan.changes").notNull(),
    deduplicationKey: text("deduplication_key").notNull(),
    state: alertEventStateEnum("state").default("pending").notNull(),
    matchedItemCount: integer("matched_item_count").default(0).notNull(),
    summaryJson: jsonb("summary_json").$type<Record<string, unknown>>().default({}).notNull(),
    suppressionReason: text("suppression_reason"),
    suppressedAt: timestamp("suppressed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_alert_events_deduplication_key").on(table.deduplicationKey),
    uniqueIndex("idx_alert_events_policy_comparison_type").on(
      table.policyId,
      table.comparisonId,
      table.eventType,
    ),
    index("idx_alert_events_state_created_at").on(table.state, table.createdAt),
    index("idx_alert_events_comparison_id").on(table.comparisonId),
    check("alert_events_nonnegative_matched_items", sql`${table.matchedItemCount} >= 0`),
  ],
);

export const alertDeliveries = pgTable(
  "alert_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => alertEvents.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => alertChannels.id),
    status: alertDeliveryStatusEnum("status").default("pending").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    providerResponseClass: text("provider_response_class"),
    providerStatusCode: integer("provider_status_code"),
    providerMessageId: text("provider_message_id"),
    redactedError: text("redacted_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_alert_deliveries_event_channel").on(table.eventId, table.channelId),
    index("idx_alert_deliveries_status_next_attempt").on(table.status, table.nextAttemptAt),
    index("idx_alert_deliveries_channel_created_at").on(table.channelId, table.createdAt),
    check("alert_deliveries_nonnegative_attempts", sql`${table.attemptCount} >= 0`),
  ],
);

export type User = typeof users.$inferSelect;
export type Scan = typeof scans.$inferSelect;
export type ScanResult = typeof scanResults.$inferSelect;
export type ScanSubdomain = typeof scanSubdomains.$inferSelect;
export type ScanSchedule = typeof scanSchedules.$inferSelect;
export type ScanComparison = typeof scanComparisons.$inferSelect;
export type ScanChangeItem = typeof scanChangeItems.$inferSelect;
export type AlertChannel = typeof alertChannels.$inferSelect;
export type AlertPolicy = typeof alertPolicies.$inferSelect;
export type AlertEvent = typeof alertEvents.$inferSelect;
export type AlertDelivery = typeof alertDeliveries.$inferSelect;
