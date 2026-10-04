/**
 * Unified Router for Black Flow
 * Handles model, vendor, and scrape routing with failover
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export class Router {
  constructor(supabase) {
    this.supabase = supabase;
    this.ROUTER_DEADLINE_MS = parseInt(process.env.ROUTER_DEADLINE_MS || '55000');
    this.TTFB_TIMEOUT_MS = parseInt(process.env.TTFB_TIMEOUT_MS || '10000');
    this.MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || '6');
  }

  async route(targetId, input, ctx) {
    const startTime = Date.now();
    const requestId = ctx.requestId || crypto.randomUUID();
    const deadline = ctx.deadline || Date.now() + this.ROUTER_DEADLINE_MS;

    // 1. Resolve target
    const target = await this.getTarget(targetId);
    if (!target) {
      return { ok: false, error: 'TARGET_NOT_FOUND', targetId };
    }

    // 2. Get eligible entries
    const entries = await this.getEligibleEntries(targetId, ctx);
    if (entries.length === 0) {
      return { ok: false, error: 'POOL_EXHAUSTED', targetId };
    }

    // 3. Sort by priority/weight
    const sortedEntries = this.sortEntries(entries, target.class);

    // 4. Try each entry
    let lastError = null;
    for (let attempt = 0; attempt < Math.min(sortedEntries.length, this.MAX_ATTEMPTS); attempt++) {
      if (Date.now() > deadline) break;

      const entry = sortedEntries[attempt];
      try {
        const result = await this.executeEntry(entry, input, ctx);
        
        // Log attempt
        await this.logAttempt(requestId, attempt + 1, targetId, entry, true, null, Date.now() - startTime);
        
        return {
          ok: true,
          data: result,
          meta: {
            target: targetId,
            entryId: entry.id,
            attempts: attempt + 1,
            servedByClass: 'primary',
            latencyMs: Date.now() - startTime,
            ttfbMs: result.ttfbMs || 0,
            tokensIn: result.tokensIn || 0,
            tokensOut: result.tokensOut || 0,
            costEst: result.costEst || 0
          }
        };
      } catch (err) {
        lastError = err;
        await this.logAttempt(requestId, attempt + 1, targetId, entry, false, err.message, Date.now() - startTime);
        
        // Check if error is retryable
        if (!this.isRetryable(err)) {
          break;
        }
        // Continue to next entry
      }
    }

    return { ok: false, error: 'POOL_EXHAUSTED', targetId, lastError: lastError?.message };
  }

  async getTarget(targetId) {
    const { data } = await this.supabase
      .from('pool_targets')
      .select('*')
      .eq('id', targetId)
      .eq('status', 'active')
      .single();
    return data;
  }

  async getEligibleEntries(targetId, ctx) {
    let query = this.supabase
      .from('pool_entries')
      .select('*')
      .eq('target_id', targetId)
      .eq('status', 'active')
      .order('priority', { ascending: true });

    const { data } = await query;
    if (!data) return [];

    // Filter by credential availability
    const eligible = [];
    for (const entry of data) {
      const cred = await this.getCredentialForEntry(entry);
      if (cred) eligible.push(entry);
    }
    return eligible;
  }

  async getCredentialForEntry(entry) {
    const [vendor, tier] = entry.credential_group.split('/');
    const { data } = await this.supabase
      .from('pool_credentials')
      .select('*')
      .eq('vendor_id', vendor)
      .eq('tier', tier)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    return data;
  }

  sortEntries(entries, targetClass) {
    // Get weights from policy
    const weights = this.getWeights(targetClass);
    
    return entries.map(e => ({
      ...e,
      score: this.calculateScore(e, weights)
    })).sort((a, b) => b.score - a.score);
  }

  getWeights(targetClass) {
    // Default weights per class
    const defaults = {
      model: { health: 0.4, latency: 0.3, cost: 0.3 },
      vendor: { quality: 0.4, health: 0.3, cost: 0.15, latency: 0.15 },
      scrape: { health: 0.3, successRate: 0.3, cost: 0.25, latency: 0.15 }
    };
    return defaults[targetClass] || defaults.model;
  }

  calculateScore(entry, weights) {
    // Simple scoring - in production use health data from pool_health
    return (entry.quality || 0.5) * 0.5 + (entry.weight || 1) * 0.3 + (1 / (entry.priority || 10)) * 0.2;
  }

  async executeEntry(entry, input, ctx) {
    // Dispatch to appropriate adapter
    switch (entry.adapter) {
      case 'openai_compat':
        return this.executeOpenAICompat(entry, input, ctx);
      case 'gemini_native':
        return this.executeGeminiNative(entry, input, ctx);
      case 'anthropic_native':
        return this.executeAnthropicNative(entry, input, ctx);
      case 'http_manifest':
        return this.executeHTTPManifest(entry, input, ctx);
      case 'builtin':
        return this.executeBuiltin(entry, input, ctx);
      case 'client':
        return this.executeClient(entry, input, ctx);
      case 'llm_native':
        return this.executeLLMNative(entry, input, ctx);
      default:
        throw new Error(`Unknown adapter: ${entry.adapter}`);
    }
  }

  async executeOpenAICompat(entry, input, ctx) {
    const cred = await this.getCredentialForEntry(entry);
    if (!cred) throw new Error('No credential available');

    const key = await this.decryptKey(cred.enc_secret);
    const baseUrl = this.getBaseUrl(entry.vendor_id);
    const model = entry.upstream?.model;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        stream: ctx.stream !== false,
        temperature: input.temperature,
        max_tokens: input.max_tokens
      }),
      signal: AbortSignal.timeout(this.TTFB_TIMEOUT_MS)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    if (ctx.stream) {
      return { stream: response.body };
    }

    const data = await response.json();
    return {
      data: data.choices?.[0]?.message?.content || '',
      tokensIn: data.usage?.prompt_tokens || 0,
      tokensOut: data.usage?.completion_tokens || 0,
      costEst: this.estimateCost(entry, data.usage),
      ttfbMs: 0 // TODO: measure
    };
  }

  async executeGeminiNative(entry, input, ctx) {
    // Similar to OpenAI compat but with Gemini-specific formatting
    return this.executeOpenAICompat(entry, input, ctx);
  }

  async executeAnthropicNative(entry, input, ctx) {
    // Similar to OpenAI compat but with Anthropic-specific formatting
    return this.executeOpenAICompat(entry, input, ctx);
  }

  async executeHTTPManifest(entry, input, ctx) {
    // Execute multi-step HTTP manifest
    throw new Error('HTTP Manifest not yet implemented');
  }

  async executeBuiltin(entry, input, ctx) {
    // Built-in handlers (e.g., file.create, file.read, web search builtin)
    throw new Error('Builtin not yet implemented');
  }

  async executeClient(entry, input, ctx) {
    // Client-side execution (Canvas/WASM)
    throw new Error('Client adapter not yet implemented');
  }

  async executeLLMNative(entry, input, ctx) {
    // LLM-native fallback (call model to do the task)
    throw new Error('LLM Native not yet implemented');
  }

  getBaseUrl(vendorId) {
    const urls = {
      google: 'https://generativelanguage.googleapis.com/v1beta',
      openrouter: 'https://openrouter.ai/api/v1',
      groq: 'https://api.groq.com/openai/v1',
      anthropic: 'https://api.anthropic.com/v1',
      ilovepdf: 'https://api.ilovepdf.com/v1',
      vendor_s: 'https://api.vendor-s.example.com'
    };
    return urls[vendorId] || '';
  }

  async decryptKey(encSecret) {
    // Simplified - in production use KeyVault with AES-256-GCM
    return encSecret;
  }

  estimateCost(entry, usage) {
    if (!entry.cost || !usage) return 0;
    if (entry.cost.unit === 'token') {
      return (usage.prompt_tokens * entry.cost.in) + (usage.completion_tokens * entry.cost.out);
    }
    return 0;
  }

  isRetryable(err) {
    // Network errors, timeouts, 5xx, 429 are retryable
    const msg = err.message?.toLowerCase() || '';
    return msg.includes('timeout') || msg.includes('network') || msg.includes('500') || msg.includes('429') || msg.includes('502') || msg.includes('503');
  }

  async logAttempt(requestId, attemptNo, targetId, entry, success, error, latency) {
    await this.supabase.from('pool_calls').upsert({
      request_id: requestId,
      attempt_no: attemptNo,
      class: 'model', // TODO: get from target
      target_id: targetId,
      entry_id: entry.id,
      credential_id: null, // TODO: get from entry
      status: success ? 'success' : 'error',
      error_class: success ? null : 'RETRY_NEXT',
      total_ms: latency,
      cost_est: 0,
      served_by_class: 'primary'
    });
  }
}

export default Router;