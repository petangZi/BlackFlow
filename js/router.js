/**
 * Black Flow - Unified Router (Client-side stub)
 * Server-side routing happens in Netlify Functions/Edge Functions
 * This handles client-side model selection and tool calls
 */

export class Router {
  constructor(supabase) {
    this.supabase = supabase;
    this.cache = new Map();
  }

  // Client-side: get available models for current plan
  async getAvailableModels(plan = 'free') {
    const cacheKey = `models:${plan}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const { data, error } = await this.supabase
        .from('pool_targets')
        .select('id, title, features, context, max_output, plan_tier, tags')
        .eq('class', 'model')
        .eq('status', 'active')
        .lte('plan_tier', plan)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const models = data || [];
      this.cache.set(cacheKey, models);
      return models;
    } catch (err) {
      console.error('[Router] Failed to fetch models:', err);
      return [];
    }
  }

  // Client-side: get available tools for current plan
  async getAvailableTools(plan = 'free') {
    const cacheKey = `tools:${plan}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const { data, error } = await this.supabase
        .from('pool_targets')
        .select('id, title, description, schema, tags, side_effect, similar_to')
        .in('class', ['vendor', 'scrape'])
        .eq('status', 'active')
        .lte('plan_tier', plan)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const tools = data || [];
      this.cache.set(cacheKey, tools);
      return tools;
    } catch (err) {
      console.error('[Router] Failed to fetch tools:', err);
      return [];
    }
  }

  // Client-side: call API via Netlify Function
  async callAPI(endpoint, body, options = {}) {
    const { user, session } = this.getAuth();
    const headers = {
      'Content-Type': 'application/json'
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    } else if (options.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
    }

    const response = await fetch(`/.netlify/functions/chat-fn${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Client-side: stream chat completions
  async *streamChatCompletions(body, options = {}) {
    const { session } = this.getAuth();
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    } else if (options.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
    }

    const response = await fetch(`/.netlify/edge-functions/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, stream: true })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            yield JSON.parse(data);
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }

  // Client-side: call tool/capability
  async callTool(capabilityId, input, options = {}) {
    return this.callAPI(`/tools/${capabilityId}`, input, options);
  }

  // Client-side: get model health status
  async getModelHealth(modelId) {
    const cacheKey = `health:${modelId}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 30000) { // 30s cache
        return cached.data;
      }
    }

    try {
      const { data, error } = await this.supabase
        .from('pool_health')
        .select('*')
        .eq('scope', 'entry')
        .like('ref_id', `${modelId}/%`);

      if (error) throw error;

      const health = data || [];
      this.cache.set(cacheKey, { data: health, timestamp: Date.now() });
      return health;
    } catch (err) {
      console.error('[Router] Failed to fetch health:', err);
      return [];
    }
  }

  // Client-side: dry-run route (simulate routing)
  async dryRunRoute(targetId, input, plan = 'free') {
    return this.callAPI('/dry-run', { targetId, input, plan });
  }

  // Auth helpers
  getAuth() {
    // This would be populated by the auth module
    return {
      user: null,
      session: null
    };
  }

  setAuth(user, session) {
    this.user = user;
    this.session = session;
  }

  clearCache() {
    this.cache.clear();
  }
}