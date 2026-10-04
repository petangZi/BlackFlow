/**
 * Netlify Scheduled Function: Health Check Cron
 * Runs every 5 minutes (configurable)
 * Max duration: 30 seconds
 * Checks health of all active entries and credentials
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger/index.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds per check

export default async function handler(event, context) {
  const requestId = crypto.randomUUID();
  logger.info('Health check cron started', { requestId });

  try {
    // Check entries
    const { data: entries } = await supabase
      .from('pool_entries')
      .select('id, target_id, vendor_id, adapter, status')
      .eq('status', 'active');

    if (entries) {
      await Promise.all(entries.map(entry => checkEntryHealth(entry)));
    }

    // Check credentials
    const { data: credentials } = await supabase
      .from('pool_credentials')
      .select('id, vendor_id, tier, status')
      .eq('status', 'active');

    if (credentials) {
      await Promise.all(credentials.map(cred => checkCredentialHealth(cred)));
    }

    // Check for stale half-open circuits
    const { data: halfOpen } = await supabase
      .from('pool_health')
      .select('*')
      .eq('state', 'half_open')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()); // 10 min ago

    if (halfOpen) {
      for (const h of halfOpen) {
        // Probe half-open
        await probeHealth(h.scope, h.ref_id);
      }
    }

    logger.info('Health check cron completed', { requestId });
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    logger.error('Health check cron error', { requestId, error: err.message, stack: err.stack });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}

async function checkEntryHealth(entry) {
  try {
    // Quick health check based on adapter type
    let healthy = false;
    let latency = 0;

    const start = Date.now();

    if (entry.adapter === 'openai_compat') {
      healthy = await checkOpenAICompat(entry);
    } else if (entry.adapter === 'gemini_native') {
      healthy = await checkGeminiNative(entry);
    } else if (entry.adapter === 'anthropic_native') {
      healthy = await checkAnthropicNative(entry);
    } else if (entry.adapter === 'http_manifest') {
      healthy = await checkHTTPManifest(entry);
    } else if (entry.adapter === 'builtin' || entry.adapter === 'client') {
      healthy = true; // Local adapters always healthy
    } else if (entry.adapter === 'llm_native') {
      healthy = await checkLLMNative(entry);
    }

    latency = Date.now() - start;

    await updateEntryHealth(entry.id, healthy, latency);
  } catch (err) {
    logger.warn('Entry health check failed', { entryId: entry.id, error: err.message });
    await updateEntryHealth(entry.id, false, 0, err.message);
  }
}

async function checkOpenAICompat(entry) {
  // Get a credential for this entry
  const [vendor, tier] = entry.credential_group.split('/');
  const { data: cred } = await supabase
    .from('pool_credentials')
    .select('enc_secret')
    .eq('vendor_id', vendor)
    .eq('tier', tier)
    .eq('status', 'active')
    .limit(1)
    .single();

  if (!cred) return false;

  // Decrypt key (simplified - real impl uses KeyVault)
  const key = await decryptKey(cred.enc_secret);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

  try {
    const response = await fetch(`${getBaseUrl(vendor)}/models`, {
      headers: { 'Authorization': `Bearer ${key}` },
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

async function checkGeminiNative(entry) {
  // Similar to OpenAI compat but with Gemini endpoint
  return checkOpenAICompat(entry); // Simplified
}

async function checkAnthropicNative(entry) {
  return checkOpenAICompat(entry); // Simplified
}

async function checkHTTPManifest(entry) {
  // Check if manifest endpoint is reachable
  if (!entry.manifest) return false;

  try {
    const response = await fetch(entry.manifest.file, { method: 'HEAD', signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT) });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkLLMNative(entry) {
  // Delegate to model check
  return checkOpenAICompat(entry); // Simplified
}

async function checkCredentialHealth(cred) {
  try {
    const key = await decryptKey(cred.enc_secret);
    const healthy = await testCredential(cred.vendor_id, key);

    await supabase
      .from('pool_credentials')
      .update({
        status: healthy ? 'active' : 'invalid',
        failures: healthy ? 0 : (cred.failures + 1),
        updated_at: new Date().toISOString()
      })
      .eq('id', cred.id);
  } catch (err) {
    logger.warn('Credential health check failed', { credentialId: cred.id, error: err.message });
  }
}

async function testCredential(vendorId, key) {
  // Quick test call
  try {
    const response = await fetch(`${getBaseUrl(vendorId)}/models`, {
      headers: { 'Authorization': `Bearer ${key}` },
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function probeHealth(scope, refId) {
  // Probe a half-open circuit
  if (scope === 'entry') {
    const { data: entry } = await supabase
      .from('pool_entries')
      .select('*')
      .eq('id', refId)
      .single();

    if (entry) {
      const healthy = await checkEntryHealth(entry);
      const newState = healthy ? 'closed' : 'open';
      await supabase
        .from('pool_health')
        .update({ state: newState, updated_at: new Date().toISOString() })
        .eq('scope', scope)
        .eq('ref_id', refId);
    }
  } else if (scope === 'credential') {
    const { data: cred } = await supabase
      .from('pool_credentials')
      .select('*')
      .eq('id', refId)
      .single();

    if (cred) {
      const healthy = await testCredential(cred.vendor_id, await decryptKey(cred.enc_secret));
      await supabase
        .from('pool_credentials')
        .update({ status: healthy ? 'active' : 'invalid', updated_at: new Date().toISOString() })
        .eq('id', cred.id);

      await supabase
        .from('pool_health')
        .update({ state: healthy ? 'closed' : 'open', updated_at: new Date().toISOString() })
        .eq('scope', scope)
        .eq('ref_id', refId);
    }
  }
}

async function updateEntryHealth(entryId, healthy, latency, error = null) {
  const { data: health } = await supabase
    .from('pool_health')
    .select('*')
    .eq('scope', 'entry')
    .eq('ref_id', entryId)
    .single();

  const failures = healthy ? 0 : (health?.consecutive_failures || 0) + 1;
  let state = health?.state || 'closed';
  let cooldownUntil = health?.cooldown_until;

  if (failures >= 3 && state === 'closed') {
    state = 'open';
    const backoffs = [30000, 120000, 600000, 3600000, 3600000];
    const backoff = backoffs[Math.min(failures - 3, backoffs.length - 1)];
    cooldownUntil = new Date(Date.now() + backoff).toISOString();
  } else if (healthy && state !== 'closed') {
    state = 'half_open';
  }

  await supabase
    .from('pool_health')
    .upsert({
      scope: 'entry',
      ref_id: entryId,
      state,
      consecutive_failures: failures,
      cooldown_until: cooldownUntil,
      latency_ewma: latency > 0 ? (health?.latency_ewma ? health.latency_ewma * 0.9 + latency * 0.1 : latency) : health?.latency_ewma,
      success_rate: healthy ? (health?.success_rate ? health.success_rate * 0.9 + 0.1 : 1) : (health?.success_rate ? health.success_rate * 0.9 : 0),
      last_error_class: error ? 'RETRY_NEXT' : null,
      updated_at: new Date().toISOString()
    });
}

function getBaseUrl(vendorId) {
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

async function decryptKey(encSecret) {
  // Simplified - real implementation uses KeyVault with AES-256-GCM
  // This is a placeholder
  return encSecret; // In reality, decrypt with master key from env
}