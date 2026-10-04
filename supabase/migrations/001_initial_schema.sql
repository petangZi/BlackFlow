-- Supabase Migration: 001_initial_schema.sql
-- Black Flow v1.0 - Core Database Schema
-- Run this first to set up the initial tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CORE TABLES
-- ============================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner')),
  plan_id TEXT NOT NULL DEFAULT 'free' REFERENCES plans(id),
  locale TEXT NOT NULL DEFAULT 'id' CHECK (locale IN ('id', 'en')),
  prefs JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plans
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_idr JSONB NOT NULL DEFAULT '{}', -- {"monthly": 50000, "yearly": 500000}
  limits JSONB NOT NULL DEFAULT '{}',    -- {"messages_per_day": 30, "tools_per_turn": 1, "max_file_mb": 10}
  allowed_pools TEXT[] NOT NULL DEFAULT '{}', -- tiers: free, pro, internal, byok
  features JSONB NOT NULL DEFAULT '{}',  -- {"models": [], "tools": [], "concurrency": 1}
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default plans
INSERT INTO plans (id, name, description, price_idr, limits, allowed_pools, features, sort_order) VALUES
('free', 'Free', 'Gratis untuk penggunaan dasar', '{"monthly": 0, "yearly": 0}', '{"messages_per_day": 30, "tools_per_turn": 1, "max_file_mb": 10, "concurrency": 1}', '{"free"}', '{"models": ["basic"], "tools": ["web.search", "file.create", "file.read"]}', 1),
('pro', 'Pro', 'Untuk pengguna intensif', '{"monthly": 100000, "yearly": 1000000}', '{"messages_per_day": 1000, "tools_per_turn": 6, "max_file_mb": 100, "concurrency": 3}', '{"free", "pro"}', '{"models": ["all"], "tools": ["all"]}', 2),
('team', 'Team', 'Untuk tim kecil', '{"monthly": 300000, "yearly": 3000000}', '{"messages_per_day": 5000, "tools_per_turn": 10, "max_file_mb": 500, "concurrency": 5}', '{"free", "pro", "internal"}', '{"models": ["all"], "tools": ["all"], "workspace": true}', 3)
ON CONFLICT (id) DO NOTHING;

-- Subscriptions
CREATE TABLE subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'grace')),
  period_end TIMESTAMPTZ,
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CONVERSATIONS & MESSAGES
-- ============================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  model_id TEXT, -- references pool_targets.id
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  system_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL DEFAULT '',
  tool_calls JSONB,
  usage JSONB,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_parent_id ON messages(parent_id);
CREATE INDEX idx_messages_request_id ON messages(request_id);

-- ============================================
-- FILES
-- ============================================

CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  ttl_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'tool', 'import')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_ttl_at ON files(ttl_at) WHERE ttl_at IS NOT NULL;

-- ============================================
-- API POOL (Unified Router)
-- ============================================

-- Vendors
CREATE TABLE pool_vendors (
  id TEXT PRIMARY KEY, -- e.g., 'google', 'openrouter', 'ilovepdf', 'vendor_s'
  kinds TEXT[] NOT NULL DEFAULT '{}', -- model, vendor, scrape
  base_urls JSONB NOT NULL DEFAULT '{}',
  docs_url TEXT,
  data_policy JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credentials (encrypted secrets)
CREATE TABLE pool_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id TEXT NOT NULL REFERENCES pool_vendors(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'internal', 'byok')),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enc_secret TEXT NOT NULL, -- AES-256-GCM encrypted
  key_version INT NOT NULL DEFAULT 1,
  hint TEXT, -- last 4 chars or label
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invalid', 'cooldown', 'disabled')),
  limits JSONB NOT NULL DEFAULT '{}', -- {"rpm": 60, "tpm": 10000, "rpd": 1000, "monthly_budget": 100, "concurrency": 3}
  usage JSONB NOT NULL DEFAULT '{}', -- {"rpm_used": 0, "tpm_used": 0, "rpd_used": 0, "monthly_used": 0}
  cooldown_until TIMESTAMPTZ,
  failures INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pool_credentials_vendor_tier ON pool_credentials(vendor_id, tier);

-- Targets (logical models/tools)
CREATE TABLE pool_targets (
  id TEXT PRIMARY KEY, -- e.g., 'model:gemini-3.8', 'vendor:pdf.compress', 'scrape:web.page'
  class TEXT NOT NULL CHECK (class IN ('model', 'vendor', 'scrape')),
  title TEXT NOT NULL,
  description TEXT,
  schema JSONB, -- JSON Schema for input/output
  features TEXT[] NOT NULL DEFAULT '{}', -- vision, tools, reasoning, json
  context INT, -- context window
  max_output INT,
  plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro', 'team')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  similar_to JSONB NOT NULL DEFAULT '[]', -- [{"target": "...", "similarity": 0.8, "degradation_note": "..."}]
  side_effect TEXT CHECK (side_effect IN ('read_only', 'write_internal', 'external')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pool_targets_class ON pool_targets(class);
CREATE INDEX idx_pool_targets_plan_tier ON pool_targets(plan_tier);

-- Entries (physical routes)
CREATE TABLE pool_entries (
  id TEXT PRIMARY KEY, -- e.g., 'model:gemini-3.8/google/direct'
  target_id TEXT NOT NULL REFERENCES pool_targets(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL REFERENCES pool_vendors(id) ON DELETE CASCADE,
  credential_group TEXT NOT NULL, -- e.g., 'google/pro/*', 'ilovepdf/byok/*'
  adapter TEXT NOT NULL CHECK (adapter IN ('openai_compat', 'gemini_native', 'anthropic_native', 'http_manifest', 'client', 'builtin', 'llm_native')),
  manifest JSONB, -- for http_manifest adapter
  options JSONB, -- for scrape class
  priority INT NOT NULL DEFAULT 10,
  weight INT NOT NULL DEFAULT 1,
  quality NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  limits JSONB NOT NULL DEFAULT '{}',
  cost JSONB NOT NULL DEFAULT '{}',
  data_policy JSONB NOT NULL DEFAULT '{}',
  degradation_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'testing', 'active', 'degraded', 'disabled', 'deprecated')),
  schema_version INT NOT NULL DEFAULT 1,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pool_entries_target_id ON pool_entries(target_id);
CREATE INDEX idx_pool_entries_status ON pool_entries(status);

-- Pool Health (circuit breaker state)
CREATE TABLE pool_health (
  scope TEXT NOT NULL CHECK (scope IN ('entry', 'credential')),
  ref_id TEXT NOT NULL, -- entry_id or credential_id
  state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
  consecutive_failures INT NOT NULL DEFAULT 0,
  cooldown_until TIMESTAMPTZ,
  latency_ewma NUMERIC(10,2), -- milliseconds
  success_rate NUMERIC(5,4), -- 0-1
  last_error_class TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, ref_id)
);

-- Pool Policies (routing weights, fallbacks, domain rules)
CREATE TABLE pool_policies (
  scope TEXT NOT NULL CHECK (scope IN ('class', 'target')),
  ref_id TEXT NOT NULL, -- class name or target_id
  weights JSONB NOT NULL DEFAULT '{}',
  max_attempts INT NOT NULL DEFAULT 6,
  deadline_ms INT NOT NULL DEFAULT 55000,
  fallback_mode TEXT NOT NULL DEFAULT 'ask_model' CHECK (fallback_mode IN ('auto', 'ask_model', 'ask_user')),
  domain_allow TEXT[],
  domain_deny TEXT[],
  rules JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, ref_id)
);

-- Pool Changes (audit log for pool modifications)
CREATE TABLE pool_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity TEXT NOT NULL, -- vendor, target, entry, credential, policy
  entity_id TEXT NOT NULL,
  version INT NOT NULL,
  diff JSONB NOT NULL,
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pool_changes_entity ON pool_changes(entity, entity_id);

-- Pool Calls (per-attempt logging)
CREATE TABLE pool_calls (
  request_id TEXT NOT NULL,
  attempt_no INT NOT NULL,
  class TEXT NOT NULL CHECK (class IN ('model', 'vendor', 'scrape')),
  target_id TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  credential_id UUID,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'retry_next', 'retry_same', 'final')),
  error_class TEXT CHECK (error_class IN ('RETRY_NEXT', 'RETRY_SAME', 'FINAL')),
  ttfb_ms INT,
  total_ms INT,
  cost_est NUMERIC(12,6),
  served_by_class TEXT CHECK (served_by_class IN ('primary', 'sibling', 'similar', 'local', 'llm')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (request_id, attempt_no)
);

CREATE INDEX idx_pool_calls_request_id ON pool_calls(request_id);
CREATE INDEX idx_pool_calls_target_id ON pool_calls(target_id);
CREATE INDEX idx_pool_calls_created_at ON pool_calls(created_at DESC);

-- ============================================
-- BILLING (WhatsApp Manual)
-- ============================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  period TEXT NOT NULL CHECK (period IN ('monthly', 'yearly')),
  price_idr BIGINT NOT NULL,
  unique_code INT NOT NULL, -- 3 digit code for transfer matching
  total_idr BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'rejected', 'needs_review', 'refunded')),
  method TEXT,
  proof_path TEXT,
  note TEXT,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_events_order_id ON order_events(order_id);

-- ============================================
-- REQUEST LOGS
-- ============================================

CREATE TABLE request_logs (
  request_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  class TEXT NOT NULL CHECK (class IN ('model', 'vendor', 'scrape')),
  target_id TEXT,
  attempts INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  tokens_in INT,
  tokens_out INT,
  cost_est NUMERIC(12,6),
  ttfb_ms INT,
  total_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX idx_request_logs_created_at ON request_logs(created_at DESC);

-- ============================================
-- API KEYS
-- ============================================

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL, -- 'bf_live_' or 'bf_test_'
  hash TEXT NOT NULL, -- SHA-256 + pepper
  scopes TEXT[] NOT NULL DEFAULT '{}', -- chat, models, tools, files, debug
  rpm INT NOT NULL DEFAULT 60,
  budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);

-- ============================================
-- USAGE DAILY (for quota tracking)
-- ============================================

CREATE TABLE usage_daily (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  messages_count INT NOT NULL DEFAULT 0,
  tokens_in INT NOT NULL DEFAULT 0,
  tokens_out INT NOT NULL DEFAULT 0,
  tool_calls_count INT NOT NULL DEFAULT 0,
  cost_est NUMERIC(12,6) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- ============================================
-- FEATURE FLAGS
-- ============================================

CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_pct INT NOT NULL DEFAULT 0, -- 0-100
  target_roles TEXT[] NOT NULL DEFAULT '{}', -- empty = all
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ANNOUNCEMENTS
-- ============================================

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  target_roles TEXT[] NOT NULL DEFAULT '{}', -- empty = all users
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_active ON announcements(starts_at, ends_at) WHERE ends_at IS NULL OR ends_at > NOW();

-- ============================================
-- AUDIT LOGS
-- ============================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  before JSONB,
  after JSONB,
  ip INET,
  user_agent TEXT,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX idx_audit_logs_at ON audit_logs(at DESC);

-- ============================================
-- TOOL JOBS (async background jobs)
-- ============================================

CREATE TABLE tool_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability TEXT NOT NULL, -- target_id like 'vendor:pdf.compress'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'canceled')),
  progress INT NOT NULL DEFAULT 0,
  input_ref JSONB, -- file_ref or input data
  output_ref JSONB,
  error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tool_jobs_user_id ON tool_jobs(user_id);
CREATE INDEX idx_tool_jobs_status ON tool_jobs(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_jobs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update own profile
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Conversations: users can CRUD own conversations
CREATE POLICY "conversations_select_own" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "conversations_insert_own" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations_update_own" ON conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "conversations_delete_own" ON conversations FOR DELETE USING (auth.uid() = user_id);

-- Messages: users can CRUD messages in own conversations
CREATE POLICY "messages_select_own" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversations WHERE id = messages.conversation_id AND user_id = auth.uid())
);
CREATE POLICY "messages_insert_own" ON messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM conversations WHERE id = messages.conversation_id AND user_id = auth.uid())
);
CREATE POLICY "messages_update_own" ON messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM conversations WHERE id = messages.conversation_id AND user_id = auth.uid())
);
CREATE POLICY "messages_delete_own" ON messages FOR DELETE USING (
  EXISTS (SELECT 1 FROM conversations WHERE id = messages.conversation_id AND user_id = auth.uid())
);

-- Files: users can CRUD own files
CREATE POLICY "files_select_own" ON files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "files_insert_own" ON files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "files_update_own" ON files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "files_delete_own" ON files FOR DELETE USING (auth.uid() = user_id);

-- Subscriptions: users can read own subscription
CREATE POLICY "subscriptions_select_own" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Orders: users can read own orders, admins can do everything
CREATE POLICY "orders_select_own" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "orders_insert_own" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Order events: users can read own order events
CREATE POLICY "order_events_select_own" ON order_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE id = order_events.order_id AND user_id = auth.uid())
);

-- Request logs: users can read own logs
CREATE POLICY "request_logs_select_own" ON request_logs FOR SELECT USING (auth.uid() = user_id);

-- API keys: users can CRUD own keys
CREATE POLICY "api_keys_select_own" ON api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "api_keys_insert_own" ON api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "api_keys_update_own" ON api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "api_keys_delete_own" ON api_keys FOR DELETE USING (auth.uid() = user_id);

-- Usage daily: users can read own usage
CREATE POLICY "usage_daily_select_own" ON usage_daily FOR SELECT USING (auth.uid() = user_id);

-- Tool jobs: users can CRUD own jobs
CREATE POLICY "tool_jobs_select_own" ON tool_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tool_jobs_insert_own" ON tool_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tool_jobs_update_own" ON tool_jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tool_jobs_delete_own" ON tool_jobs FOR DELETE USING (auth.uid() = user_id);

-- Admin policies (role = admin/owner)
CREATE POLICY "admin_all" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_conversations_all" ON conversations FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_messages_all" ON messages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_files_all" ON files FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_subscriptions_all" ON subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_orders_all" ON orders FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_order_events_all" ON order_events FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_request_logs_all" ON request_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_api_keys_all" ON api_keys FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_usage_daily_all" ON usage_daily FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_tool_jobs_all" ON tool_jobs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

-- Pool tables: only admins can modify, everyone can read active entries
CREATE POLICY "pool_vendors_read_active" ON pool_vendors FOR SELECT USING (status = 'active');
CREATE POLICY "pool_targets_read_active" ON pool_targets FOR SELECT USING (status = 'active');
CREATE POLICY "pool_entries_read_active" ON pool_entries FOR SELECT USING (status = 'active');
CREATE POLICY "pool_policies_read" ON pool_policies FOR SELECT USING (true);

CREATE POLICY "admin_pool_vendors_all" ON pool_vendors FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_pool_targets_all" ON pool_targets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_pool_entries_all" ON pool_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_pool_credentials_all" ON pool_credentials FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_pool_health_all" ON pool_health FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_pool_policies_all" ON pool_policies FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_pool_changes_all" ON pool_changes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
CREATE POLICY "admin_pool_calls_all" ON pool_calls FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

-- Feature flags: read for all, write for admin
CREATE POLICY "feature_flags_read" ON feature_flags FOR SELECT USING (true);
CREATE POLICY "admin_feature_flags_all" ON feature_flags FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

-- Announcements: read for all active
CREATE POLICY "announcements_read_active" ON announcements FOR SELECT USING (
  starts_at <= NOW() AND (ends_at IS NULL OR ends_at > NOW())
  AND (target_roles = '{}' OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY(target_roles)))
);
CREATE POLICY "admin_announcements_all" ON announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

-- Audit logs: admin only
CREATE POLICY "admin_audit_logs_all" ON audit_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);