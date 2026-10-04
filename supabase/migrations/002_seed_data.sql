-- Supabase Migration: 002_seed_data.sql
-- Black Flow v1.0 - Seed Data for API Pool

-- ============================================
-- DEFAULT VENDORS
-- ============================================

INSERT INTO pool_vendors (id, kinds, base_urls, docs_url, data_policy, status) VALUES
('google', ARRAY['model'], '{"default": "https://generativelanguage.googleapis.com"}', 'https://ai.google.dev/docs', '{"retention": "zero", "region": "global"}', 'active'),
('openrouter', ARRAY['model'], '{"default": "https://openrouter.ai/api/v1"}', 'https://openrouter.ai/docs', '{"retention": "zero", "region": "global"}', 'active'),
('groq', ARRAY['model'], '{"default": "https://api.groq.com/openai/v1"}', 'https://console.groq.com/docs', '{"retention": "zero", "region": "us"}', 'active'),
('anthropic', ARRAY['model'], '{"default": "https://api.anthropic.com"}', 'https://docs.anthropic.com', '{"retention": "zero", "region": "us"}', 'active'),
('ilovepdf', ARRAY['vendor'], '{"default": "https://api.ilovepdf.com/v1"}', 'https://developer.ilovepdf.com', '{"retention": "deleted_after_2h", "region": "eu"}', 'active'),
('vendor_s', ARRAY['scrape'], '{"default": "https://api.vendor-s.example.com"}', 'https://vendor-s.example.com/docs', '{"retention": "cache_only", "region": "us"}', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DEFAULT TARGETS (Models)
-- ============================================

-- Note: These are example models from owner. Real IDs must be filled from provider documentation.
INSERT INTO pool_targets (id, class, title, description, features, context, max_output, plan_tier, tags, side_effect, status) VALUES
('model:gemini-3.8', 'model', 'Gemini 3.8', 'Google''s latest multimodal model', ARRAY['vision', 'tools', 'reasoning', 'json'], 2000000, 8192, 'free', ARRAY['google', 'multimodal', 'reasoning'], 'read_only', 'active'),
('model:gpt-4o', 'model', 'GPT-4o', 'OpenAI''s flagship multimodal model', ARRAY['vision', 'tools', 'reasoning', 'json'], 128000, 4096, 'pro', ARRAY['openai', 'multimodal', 'reasoning'], 'read_only', 'active'),
('model:claude-3.5-sonnet', 'model', 'Claude 3.5 Sonnet', 'Anthropic''s best model for coding', ARRAY['vision', 'tools', 'reasoning', 'json'], 200000, 8192, 'pro', ARRAY['anthropic', 'coding', 'reasoning'], 'read_only', 'active'),
('model:llama-3.3-70b', 'model', 'Llama 3.3 70B', 'Meta''s open model via Groq', ARRAY['tools', 'reasoning', 'json'], 128000, 4096, 'free', ARRAY['meta', 'open', 'fast'], 'read_only', 'active'),
('model:auto', 'model', 'Auto', 'Automatically select best model', ARRAY['vision', 'tools', 'reasoning', 'json'], 128000, 4096, 'free', ARRAY['router', 'auto'], 'read_only', 'active'),
('model:fast', 'model', 'Fast', 'Optimized for speed', ARRAY['tools', 'json'], 32000, 2048, 'free', ARRAY['router', 'fast'], 'read_only', 'active'),
('model:smart', 'model', 'Smart', 'Optimized for quality', ARRAY['vision', 'tools', 'reasoning', 'json'], 200000, 8192, 'pro', ARRAY['router', 'smart'], 'read_only', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DEFAULT TARGETS (Vendor Tools)
-- ============================================

INSERT INTO pool_targets (id, class, title, description, schema, limits, plan_tier, tags, similar_to, side_effect, status) VALUES
('vendor:pdf.compress', 'vendor', 'PDF Compress', 'Compress PDF files', 
  '{"type": "object", "properties": {"file_ref": {"type": "object"}, "level": {"type": "string", "enum": ["low", "medium", "high"]}}, "required": ["file_ref"]}',
  '{"max_file_mb": 100}',
  'free', ARRAY['pdf', 'compress'],
  '[{"target": "vendor:pdf.optimize", "similarity": 0.8, "degradation_note": "May produce larger output"}, {"target": "vendor:pdf.reduce_images", "similarity": 0.7, "degradation_note": "Images downscaled more aggressively"}]',
  'write_internal', 'active'),

('vendor:pdf.optimize', 'vendor', 'PDF Optimize', 'Optimize PDF structure',
  '{"type": "object", "properties": {"file_ref": {"type": "object"}}, "required": ["file_ref"]}',
  '{"max_file_mb": 50}',
  'free', ARRAY['pdf', 'optimize'],
  '[{"target": "vendor:pdf.compress", "similarity": 0.8, "degradation_note": "Less compression"}]',
  'write_internal', 'active'),

('vendor:pdf.reduce_images', 'vendor', 'Reduce PDF Images', 'Downscale images in PDF',
  '{"type": "object", "properties": {"file_ref": {"type": "object"}, "dpi": {"type": "integer"}}, "required": ["file_ref"]}',
  '{"max_file_mb": 100}',
  'free', ARRAY['pdf', 'images'],
  '[{"target": "vendor:pdf.compress", "similarity": 0.7, "degradation_note": "Only image reduction"}]',
  'write_internal', 'active'),

('vendor:file.create', 'vendor', 'Create File', 'Create files from content',
  '{"type": "object", "properties": {"type": {"type": "string", "enum": ["md", "txt", "csv", "json", "html", "code", "docx", "xlsx", "pdf", "pptx"]}, "content": {"type": "string"}, "filename": {"type": "string"}}, "required": ["type", "content"]}',
  '{"max_file_mb": 50}',
  'free', ARRAY['file', 'create'],
  '[]',
  'write_internal', 'active'),

('vendor:file.read', 'vendor', 'Read File', 'Extract text from files',
  '{"type": "object", "properties": {"file_ref": {"type": "object"}}, "required": ["file_ref"]}',
  '{"max_file_mb": 100}',
  'free', ARRAY['file', 'read'],
  '[]',
  'read_only', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DEFAULT TARGETS (Scrape)
-- ============================================

INSERT INTO pool_targets (id, class, title, description, schema, options, limits, plan_tier, tags, similar_to, side_effect, status) VALUES
('scrape:web.search', 'scrape', 'Web Search', 'Search the web',
  '{"type": "object", "properties": {"query": {"type": "string"}, "max_results": {"type": "integer"}}, "required": ["query"]}',
  '{"render_js": false, "formats": ["markdown"], "respect_robots": true}',
  '{"rpm": 30, "concurrency": 3, "timeout_ms": 15000}',
  'free', ARRAY['web', 'search'],
  '[{"target": "scrape:web.search_lite", "similarity": 0.7, "degradation_note": "Fewer results, no snippets"}]',
  'read_only', 'active'),

('scrape:web.search_lite', 'scrape', 'Web Search Lite', 'Lightweight web search',
  '{"type": "object", "properties": {"query": {"type": "string"}, "max_results": {"type": "integer"}}, "required": ["query"]}',
  '{"render_js": false, "formats": ["markdown"], "respect_robots": true}',
  '{"rpm": 60, "concurrency": 5, "timeout_ms": 10000}',
  'free', ARRAY['web', 'search'],
  '[{"target": "scrape:web.search", "similarity": 0.7, "degradation_note": "More comprehensive results"}]',
  'read_only', 'active'),

('scrape:web.page', 'scrape', 'Fetch Page', 'Fetch and extract page content',
  '{"type": "object", "properties": {"url": {"type": "string"}, "format": {"type": "string", "enum": ["markdown", "html", "text"]}}, "required": ["url"]}',
  '{"render_js": true, "formats": ["markdown", "html", "text"], "respect_robots": true}',
  '{"rpm": 20, "concurrency": 2, "timeout_ms": 30000}',
  'free', ARRAY['web', 'fetch'],
  '[{"target": "scrape:web.page_lite", "similarity": 0.7, "degradation_note": "No JavaScript rendering"}]',
  'read_only', 'active'),

('scrape:web.page_lite', 'scrape', 'Fetch Page Lite', 'Fetch page without JS',
  '{"type": "object", "properties": {"url": {"type": "string"}, "format": {"type": "string", "enum": ["markdown", "html", "text"]}}, "required": ["url"]}',
  '{"render_js": false, "formats": ["markdown", "html", "text"], "respect_robots": true}',
  '{"rpm": 60, "concurrency": 5, "timeout_ms": 15000}',
  'free', ARRAY['web', 'fetch'],
  '[{"target": "scrape:web.page", "similarity": 0.7, "degradation_note": "Full rendering with JavaScript"}]',
  'read_only', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DEFAULT ENTRIES (Routes)
-- ============================================

-- Model entries
INSERT INTO pool_entries (id, target_id, vendor_id, credential_group, adapter, upstream, priority, weight, status, cost, limits) VALUES
('model:gemini-3.8/google/direct', 'model:gemini-3.8', 'google', 'google/pro/*', 'openai_compat', '{"model": "gemini-3.8"}', 10, 3, 'active', '{"unit": "token", "in": 0.000001, "out": 0.000003}', '{}'),
('model:gpt-4o/openrouter/direct', 'model:gpt-4o', 'openrouter', 'openrouter/pro/*', 'openai_compat', '{"model": "openai/gpt-4o"}', 10, 3, 'active', '{"unit": "token", "in": 0.000005, "out": 0.000015}', '{}'),
('model:claude-3.5-sonnet/anthropic/direct', 'model:claude-3.5-sonnet', 'anthropic', 'anthropic/pro/*', 'anthropic_native', '{"model": "claude-3-5-sonnet-20241022"}', 10, 3, 'active', '{"unit": "token", "in": 0.000003, "out": 0.000015}', '{}'),
('model:llama-3.3-70b/groq/direct', 'model:llama-3.3-70b', 'groq', 'groq/free/*', 'openai_compat', '{"model": "llama-3.3-70b-versatile"}', 10, 2, 'active', '{"unit": "token", "in": 0, "out": 0}', '{}'),
('model:auto/router', 'model:auto', 'openrouter', 'openrouter/pro/*', 'openai_compat', '{"model": "auto"}', 5, 1, 'active', '{"unit": "token", "in": 0.000005, "out": 0.000015}', '{}'),
('model:fast/router', 'model:fast', 'groq', 'groq/free/*', 'openai_compat', '{"model": "llama-3.1-8b-instant"}', 5, 1, 'active', '{"unit": "token", "in": 0, "out": 0}', '{}'),
('model:smart/router', 'model:smart', 'openrouter', 'openrouter/pro/*', 'openai_compat', '{"model": "anthropic/claude-3.5-sonnet"}', 5, 1, 'active', '{"unit": "token", "in": 0.000003, "out": 0.000015}', '{}')
ON CONFLICT (id) DO NOTHING;

-- Vendor tool entries
INSERT INTO pool_entries (id, target_id, vendor_id, credential_group, adapter, manifest, priority, quality, status, limits, cost) VALUES
('vendor:pdf.compress/ilovepdf/std', 'vendor:pdf.compress', 'ilovepdf', 'ilovepdf/pro/*', 'http_manifest', '{"file": "manifests/ilovepdf.pdf_compress.json"}', 10, 0.9, 'active', '{"max_file_mb": 100}', '{"unit": "call", "usd": 0.01}'),
('vendor:pdf.compress/browser/rasterize', 'vendor:pdf.compress', 'client', 'client/*', 'client', '{"handler": "pdfCompressClient"}', 100, 0.4, 'active', '{"max_file_mb": 50}', '{"unit": "call", "usd": 0}'),
('vendor:pdf.optimize/ilovepdf/std', 'vendor:pdf.optimize', 'ilovepdf', 'ilovepdf/pro/*', 'http_manifest', '{"file": "manifests/ilovepdf.pdf_optimize.json"}', 10, 0.85, 'active', '{"max_file_mb": 50}', '{"unit": "call", "usd": 0.01}'),
('vendor:file.create/client', 'vendor:file.create', 'client', 'client/*', 'builtin', '{"handler": "fileCreateClient"}', 10, 1.0, 'active', '{"max_file_mb": 50}', '{"unit": "call", "usd": 0}'),
('vendor:file.read/client', 'vendor:file.read', 'client', 'client/*', 'builtin', '{"handler": "fileReadClient"}', 10, 1.0, 'active', '{"max_file_mb": 100}', '{"unit": "call", "usd": 0}')
ON CONFLICT (id) DO NOTHING;

-- Scrape entries
INSERT INTO pool_entries (id, target_id, vendor_id, credential_group, adapter, manifest, options, priority, status, limits, cost) VALUES
('scrape:web.search/vendor_s/js', 'scrape:web.search', 'vendor_s', 'vendor_s/pro/*', 'http_manifest', '{"file": "manifests/vendor_s.web_search.json"}', '{"render_js": false, "formats": ["markdown"], "respect_robots": true}', 10, 'active', '{"rpm": 30, "concurrency": 3, "timeout_ms": 15000}', '{"unit": "page", "usd": 0.001}'),
('scrape:web.search/builtin', 'scrape:web.search', 'builtin', 'builtin/*', 'builtin', '{"handler": "webSearchBuiltin"}', '{"render_js": false, "formats": ["markdown"], "respect_robots": true}', 100, 'active', '{"rpm": 60, "concurrency": 5, "timeout_ms": 10000}', '{"unit": "call", "usd": 0}'),
('scrape:web.page/vendor_s/js', 'scrape:web.page', 'vendor_s', 'vendor_s/pro/*', 'http_manifest', '{"file": "manifests/vendor_s.web_page.json"}', '{"render_js": true, "formats": ["markdown", "html", "text"], "respect_robots": true}', 10, 'active', '{"rpm": 20, "concurrency": 2, "timeout_ms": 30000}', '{"unit": "page", "usd": 0.002}'),
('scrape:web.page/builtin', 'scrape:web.page', 'builtin', 'builtin/*', 'builtin', '{"handler": "webPageBuiltin"}', '{"render_js": false, "formats": ["markdown", "html", "text"], "respect_robots": true}', 100, 'active', '{"rpm": 60, "concurrency": 5, "timeout_ms": 15000}', '{"unit": "call", "usd": 0}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DEFAULT POLICIES
-- ============================================

INSERT INTO pool_policies (scope, ref_id, weights, max_attempts, deadline_ms, fallback_mode, domain_deny, rules) VALUES
('class', 'model', '{"health": 0.4, "latency": 0.3, "cost": 0.3}', 6, 55000, 'ask_model', '{}', '{"model_fallback": false}'),
('class', 'vendor', '{"quality": 0.4, "health": 0.3, "cost": 0.15, "latency": 0.15}', 6, 55000, 'ask_model', '{}', '{}'),
('class', 'scrape', '{"health": 0.3, "success_rate": 0.3, "cost": 0.25, "latency": 0.15}', 6, 55000, 'ask_model', '{"localhost", "127.0.0.1", "169.254.169.254", "metadata.google.internal"}', '{"respect_robots": true}')
ON CONFLICT (scope, ref_id) DO NOTHING;

-- ============================================
-- FEATURE FLAGS
-- ============================================

INSERT INTO feature_flags (key, enabled, rollout_pct, target_roles, description) VALUES
('billing_enabled', true, 100, '{}', 'Enable billing/order system'),
('byok_enabled', false, 0, '{}', 'Enable BYOK (bring your own key)'),
('workspace_enabled', false, 0, '{}', 'Enable workspace/team features'),
('canvas_enabled', false, 0, '{}', 'Enable canvas panel for documents/code'),
('code_run_enabled', false, 0, '{}', 'Enable code.run tool (Pyodide)'),
('voice_enabled', false, 0, '{}', 'Enable voice mode'),
('memory_enabled', false, 0, '{}', 'Enable cross-chat memory'),
('share_link_enabled', false, 0, '{}', 'Enable read-only share links'),
('model_fallback_opt_in', false, 0, '{}', 'Allow fallback to different model (opt-in)'),
('private_mode', false, 0, '{}', 'Enable private mode (data policy filtering)')
ON CONFLICT (key) DO NOTHING;