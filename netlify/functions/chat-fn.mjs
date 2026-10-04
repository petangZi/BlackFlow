/**
 * Netlify Serverless Function: Chat (Function runtime)
 * Path: /api/chat/*
 * Runtime: Node.js 20 (Function)
 * Max duration: 60s sync, 15min background
 * Used as fallback when Edge function exceeds limits
 */

import { createClient } from '@supabase/supabase-js';
import { Router } from '../lib/router/index.mjs';
import { KeyVault } from '../lib/auth/keyvault.mjs';
import { RateLimiter } from '../lib/ratelimit/index.mjs';
import { SSEParser, SSEWriter } from '../lib/utils/sse.mjs';
import { logger } from '../lib/logger/index.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = new Router(supabase);
const keyVault = new KeyVault(supabase);
const rateLimiter = new RateLimiter(supabase);

const ROUTER_DEADLINE_MS = parseInt(process.env.ROUTER_DEADLINE_MS || '55000');
const TTFB_TIMEOUT_MS = parseInt(process.env.TTFB_TIMEOUT_MS || '10000');
const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || '6');

export default async function handler(event, context) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  logger.info('Function chat request', { requestId, method: event.httpMethod, path: event.path });

  // CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: ''
    };
  }

  try {
    // Parse path
    const path = event.path.replace('/.netlify/functions/chat-fn', '') || '/';

    // Auth
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user = null;
    let apiKey = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (token.startsWith('bf_')) {
        apiKey = await validateApiKey(token);
        if (!apiKey) {
          return errorResponse('AUTH_REQUIRED', 'Invalid API key', 401, requestId);
        }
        if (!apiKey.scopes.includes('chat')) {
          return errorResponse('AUTH_REQUIRED', 'API key missing chat scope', 403, requestId);
        }
      } else {
        const { data: { user: u }, error } = await supabase.auth.getUser(token);
        if (error || !u) {
          return errorResponse('AUTH_REQUIRED', 'Invalid token', 401, requestId);
        }
        user = u;
      }
    }

    // Rate limiting
    const clientIp = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
    const rateLimitKey = user?.id || apiKey?.id || clientIp;
    const rateLimit = await rateLimiter.check(rateLimitKey, user?.id ? 'user' : 'ip');
    if (!rateLimit.allowed) {
      return errorResponse('RATE_LIMITED', 'Rate limit exceeded', 429, requestId, {
        'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString()
      });
    }

    // Route handling
    if (path === '/completions' || path === '/chat/completions') {
      return handleChatCompletions(event, requestId, user, apiKey, startTime);
    } else if (path === '/models') {
      return handleModels(event, requestId, user, apiKey);
    } else if (path.startsWith('/tools/')) {
      return handleToolCall(event, requestId, user, apiKey, path);
    }

    return errorResponse('BAD_REQUEST', 'Not found', 404, requestId);
  } catch (err) {
    logger.error('Function error', { requestId, error: err.message, stack: err.stack });
    return errorResponse('INTERNAL', 'Internal server error', 500, requestId);
  }
}

async function handleChatCompletions(event, requestId, user, apiKey, startTime) {
  if (event.httpMethod !== 'POST') {
    return errorResponse('BAD_REQUEST', 'Method not allowed', 405, requestId);
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return errorResponse('BAD_REQUEST', 'Invalid JSON', 400, requestId);
  }

  // Validate request
  const validation = validateChatRequest(body);
  if (!validation.valid) {
    return errorResponse('BAD_REQUEST', validation.error, 400, requestId);
  }

  const { model, messages, stream, temperature, max_tokens, tools, tool_choice } = validation.data;

  // Get user plan & quota
  let plan = 'free';
  let quota = { messages_per_day: 30 };
  if (user) {
    const profile = await getProfile(user.id);
    plan = profile?.plan_id || 'free';
    quota = await getPlanQuota(plan);
    const usage = await getUsageToday(user.id);
    if (usage.messages_count >= quota.messages_per_day) {
      return errorResponse('PLAN_LIMIT_REACHED', 'Daily message limit reached', 403, requestId);
    }
  }

  // Resolve model
  const targetId = model.startsWith('model:') ? model : `model:${model}`;
  const target = await getTarget(targetId);
  if (!target) {
    return errorResponse('MODEL_NOT_FOUND', `Model ${model} not found`, 404, requestId);
  }

  if (!canAccessTarget(target, plan)) {
    return errorResponse('MODEL_NOT_ALLOWED', `Model ${model} not available on ${plan} plan`, 403, requestId);
  }

  // Route request
  const ctx = {
    requestId,
    userId: user?.id,
    apiKeyId: apiKey?.id,
    plan,
    deadline: Date.now() + ROUTER_DEADLINE_MS,
    stream: stream !== false,
    privateMode: false
  };

  const result = await router.route(targetId, {
    messages,
    temperature,
    max_tokens,
    tools,
    tool_choice
  }, ctx);

  if (!result.ok) {
    return handleRouterError(result, requestId, stream !== false);
  }

  // Log request
  await logRequest({
    requestId,
    userId: user?.id,
    apiKeyId: apiKey?.id,
    class: 'model',
    targetId,
    attempts: result.meta.attempts,
    status: 'success',
    tokensIn: result.meta.tokensIn,
    tokensOut: result.meta.tokensOut,
    costEst: result.meta.costEst,
    ttfbMs: result.meta.ttfbMs,
    totalMs: Date.now() - startTime
  });

  if (user) {
    await incrementUsage(user.id, { messages: 1, tokensIn: result.meta.tokensIn, tokensOut: result.meta.tokensOut, cost: result.meta.costEst });
  }

  // Stream or return JSON
  if (stream !== false) {
    return streamResponse(result.data, requestId, result.meta);
  }

  return jsonResponse(result.data, requestId, result.meta);
}

async function handleModels(event, requestId, user, apiKey) {
  const plan = user ? (await getProfile(user.id))?.plan_id || 'free' : 'free';
  const targets = await getTargets('model', plan);
  const models = targets.map(t => ({
    id: t.id,
    object: 'model',
    created: Math.floor(new Date(t.created_at).getTime() / 1000),
    owned_by: 'blackflow',
    features: t.features,
    context: t.context,
    max_output: t.max_output
  }));

  return jsonResponse({ object: 'list', data: models }, requestId);
}

async function handleToolCall(event, requestId, user, apiKey, path) {
  if (event.httpMethod !== 'POST') {
    return errorResponse('BAD_REQUEST', 'Method not allowed', 405, requestId);
  }

  const capabilityId = path.replace('/.netlify/functions/chat-fn/tools/', '');
  const targetId = capabilityId.startsWith('vendor:') || capabilityId.startsWith('scrape:')
    ? capabilityId
    : `vendor:${capabilityId}`;

  const target = await getTarget(targetId);
  if (!target) {
    return errorResponse('CAPABILITY_UNAVAILABLE', `Capability ${capabilityId} not found`, 404, requestId);
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return errorResponse('BAD_REQUEST', 'Invalid JSON', 400, requestId);
  }

  const ctx = {
    requestId,
    userId: user?.id,
    apiKeyId: apiKey?.id,
    plan: user ? (await getProfile(user.id))?.plan_id || 'free' : 'free',
    deadline: Date.now() + ROUTER_DEADLINE_MS,
    stream: false,
    privateMode: false
  };

  const result = await router.route(targetId, body, ctx);

  if (!result.ok) {
    return handleRouterError(result, requestId, false);
  }

  return jsonResponse(result.data, requestId, result.meta);
}

function validateChatRequest(body) {
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return { valid: false, error: 'Messages array is required' };
  }

  for (const msg of body.messages) {
    if (!msg.role || !['user', 'assistant', 'system', 'tool'].includes(msg.role)) {
      return { valid: false, error: 'Invalid message role' };
    }
    if (msg.role !== 'tool' && typeof msg.content !== 'string') {
      return { valid: false, error: 'Message content must be string' };
    }
  }

  return {
    valid: true,
    data: {
      model: body.model || 'auto',
      messages: body.messages,
      stream: body.stream !== false,
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens,
      tools: body.tools,
      tool_choice: body.tool_choice
    }
  };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function errorResponse(code, message, status, requestId, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'X-BlackFlow-Request-Id': requestId,
      ...corsHeaders(),
      ...extraHeaders
    },
    body: JSON.stringify({
      error: { message, type: code, code, param: null },
      blackflow: { requestId, code, retriable: status >= 500 || status === 429 }
    })
  };
}

function jsonResponse(data, requestId, meta) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-BlackFlow-Request-Id': requestId,
      ...corsHeaders()
    },
    body: JSON.stringify({ ...data, blackflow: { requestId, ...meta } })
  };
}

function streamResponse(stream, requestId, meta) {
  // For Function runtime, we need to buffer and return
  // In production, use Background Function for long streams
  // This is a simplified version - real impl uses async iteration
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-BlackFlow-Request-Id': requestId,
      ...corsHeaders()
    },
    body: 'data: [Function streaming not fully implemented - use Edge Function for streaming]\n\n'
  };
}

function handleRouterError(result, requestId, isStream) {
  const errorMap = {
    'ALL_ENDPOINTS_FAILED': { code: 'ALL_ENDPOINTS_FAILED', status: 503, message: 'Model sedang tidak tersedia. Silakan coba lagi nanti.' },
    'POOL_EXHAUSTED': { code: 'POOL_EXHAUSTED', status: 503, message: 'Semua endpoint gagal. Silakan coba lagi nanti.' },
    'CONTEXT_TOO_LONG': { code: 'CONTEXT_TOO_LONG', status: 400, message: 'Konteks terlalu panjang. Kurangi panjang pesan.' },
    'CONTENT_BLOCKED': { code: 'CONTENT_BLOCKED', status: 400, message: 'Konten diblokir oleh kebijakan keamanan.' },
    'RATE_LIMITED': { code: 'RATE_LIMITED', status: 429, message: 'Terlalu banyak permintaan. Tunggu sebentar.' }
  };

  const err = errorMap[result.error] || { code: 'INTERNAL', status: 500, message: 'Terjadi kesalahan internal' };
  return errorResponse(err.code, err.message, err.status, requestId);
}

async function validateApiKey(token) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(token + (process.env.API_KEY_PEPPER || ''));
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const { data } = await supabase
    .from('api_keys')
    .select('*')
    .eq('hash', hash)
    .is('revoked_at', null)
    .single();

  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data;
}

async function getProfile(userId) {
  const { data } = await supabase.from('profiles').select('plan_id').eq('id', userId).single();
  return data;
}

async function getPlanQuota(planId) {
  const { data } = await supabase.from('plans').select('limits').eq('id', planId).single();
  return data?.limits || { messages_per_day: 30 };
}

async function getUsageToday(userId) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('usage_daily').select('*').eq('user_id', userId).eq('date', today).single();
  return data || { messages_count: 0, tokens_in: 0, tokens_out: 0, tool_calls_count: 0, cost_est: 0 };
}

async function getTarget(targetId) {
  const { data } = await supabase.from('pool_targets').select('*').eq('id', targetId).eq('status', 'active').single();
  return data;
}

async function getTargets(classFilter, planTier) {
  let query = supabase.from('pool_targets').select('*').eq('status', 'active');
  if (classFilter) query = query.eq('class', classFilter);
  if (planTier) query = query.lte('plan_tier', planTier);
  const { data } = await query.order('created_at', { ascending: true });
  return data || [];
}

function canAccessTarget(target, plan) {
  const tiers = { free: 0, pro: 1, team: 2 };
  return tiers[plan] >= tiers[target.plan_tier];
}

async function logRequest(log) {
  await supabase.from('request_logs').insert(log);
}

async function incrementUsage(userId, increments) {
  const today = new Date().toISOString().split('T')[0];
  await supabase.rpc('increment_usage_daily', {
    p_user_id: userId,
    p_date: today,
    p_messages: increments.messages || 0,
    p_tokens_in: increments.tokensIn || 0,
    p_tokens_out: increments.tokensOut || 0,
    p_tool_calls: increments.toolCalls || 0,
    p_cost: increments.cost || 0
  });
}