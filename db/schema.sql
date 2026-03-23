CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL UNIQUE,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workspace_members (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    scope JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    query JSONB NOT NULL,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE canonical_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    normalized_target TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('url', 'host', 'domain')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, normalized_target)
);

CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_token_id UUID REFERENCES api_tokens(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('ui', 'cli', 'api', 'system')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'queued', 'running', 'processing', 'completed', 'failed', 'cancelled')),
    profile TEXT NOT NULL,
    idempotency_key TEXT,
    request_fingerprint TEXT NOT NULL,
    request_schema_version INTEGER NOT NULL DEFAULT 1,
    options_json JSONB NOT NULL,
    target_count INTEGER NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancellation_requested_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT
);

CREATE INDEX idx_scans_workspace_submitted_at ON scans(workspace_id, submitted_at DESC);
CREATE INDEX idx_scans_workspace_status ON scans(workspace_id, status);
CREATE INDEX idx_scans_workspace_request_fingerprint ON scans(workspace_id, request_fingerprint, submitted_at DESC);
CREATE INDEX idx_scans_workspace_idempotency_key ON scans(workspace_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE scan_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    canonical_target_id UUID REFERENCES canonical_targets(id) ON DELETE SET NULL,
    input_target TEXT NOT NULL,
    normalized_target TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scan_id, normalized_target)
);

CREATE TABLE scan_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    worker_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_code TEXT,
    error_message TEXT,
    meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (scan_id, attempt_number)
);

CREATE INDEX idx_scan_attempts_scan_id_status ON scan_attempts(scan_id, status, attempt_number DESC);

CREATE TABLE scan_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL REFERENCES scan_attempts(id) ON DELETE CASCADE,
    scan_target_id UUID NOT NULL REFERENCES scan_targets(id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    url TEXT,
    final_url TEXT,
    input TEXT,
    host TEXT,
    scheme TEXT,
    port TEXT,
    host_ip INET,
    status_code INTEGER,
    title TEXT,
    web_server TEXT,
    content_type TEXT,
    content_length BIGINT,
    response_time_ms INTEGER,
    words INTEGER,
    lines INTEGER,
    cdn BOOLEAN,
    cdn_name TEXT,
    cdn_type TEXT,
    favicon_mmh3 TEXT,
    favicon_md5 TEXT,
    favicon_url TEXT,
    favicon_path TEXT,
    jarm_hash TEXT,
    body_preview TEXT,
    failed BOOLEAN NOT NULL DEFAULT FALSE,
    raw_json JSONB NOT NULL,
    search_document TSVECTOR
);

CREATE INDEX idx_scan_results_scan_id ON scan_results(scan_id);
CREATE INDEX idx_scan_results_scan_target_id ON scan_results(scan_target_id);
CREATE INDEX idx_scan_results_status_code ON scan_results(status_code);
CREATE INDEX idx_scan_results_title ON scan_results USING GIN (to_tsvector('simple', COALESCE(title, '')));
CREATE INDEX idx_scan_results_server ON scan_results(web_server);
CREATE INDEX idx_scan_results_cdn_name ON scan_results(cdn_name);
CREATE INDEX idx_scan_results_search_document ON scan_results USING GIN(search_document);

CREATE TABLE scan_result_technologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES scan_results(id) ON DELETE CASCADE,
    technology_name TEXT NOT NULL,
    technology_version TEXT,
    source TEXT NOT NULL CHECK (source IN ('wappalyzer', 'wordpress', 'cpe', 'derived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_result_technologies_name ON scan_result_technologies(technology_name);

CREATE TABLE scan_result_wordpress_plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES scan_results(id) ON DELETE CASCADE,
    plugin_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (result_id, plugin_name)
);

CREATE INDEX idx_scan_result_wp_plugins_name ON scan_result_wordpress_plugins(plugin_name);

CREATE TABLE scan_result_wordpress_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES scan_results(id) ON DELETE CASCADE,
    theme_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (result_id, theme_name)
);

CREATE INDEX idx_scan_result_wp_themes_name ON scan_result_wordpress_themes(theme_name);

CREATE TABLE scan_result_cpes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES scan_results(id) ON DELETE CASCADE,
    vendor TEXT,
    product TEXT,
    cpe TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (result_id, cpe)
);

CREATE INDEX idx_scan_result_cpes_vendor_product ON scan_result_cpes(vendor, product);
CREATE INDEX idx_scan_result_cpes_cpe ON scan_result_cpes(cpe);

CREATE TABLE scan_events (
    id BIGSERIAL PRIMARY KEY,
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    attempt_id UUID REFERENCES scan_attempts(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('scan.status', 'scan.progress', 'scan.result', 'scan.complete', 'scan.failed', 'scan.cancelled')),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_events_scan_id_id ON scan_events(scan_id, id);

CREATE TABLE scan_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    baseline_scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    comparison_scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    diff_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (baseline_scan_id, comparison_scan_id)
);
