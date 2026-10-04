/**
 * Netlify Background Function: Tool Jobs Processor
 * Max duration: 15 minutes
 * Payload limit: 256 KB
 * Triggered by: queue, scheduled, or direct invoke
 */

import { createClient } from '@supabase/supabase-js';
import { ConnectorEngine } from '../lib/connectors/engine.mjs';
import { KeyVault } from '../lib/auth/keyvault.mjs';
import { logger } from '../lib/logger/index.mjs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const connectorEngine = new ConnectorEngine(supabase);
const keyVault = new KeyVault(supabase);

export default async function handler(event, context) {
  const requestId = event.headers['x-blackflow-request-id'] || crypto.randomUUID();
  const startTime = Date.now();

  logger.info('Background job started', { requestId, payload: event.body });

  try {
    // Parse payload
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { jobId, capability, input } = payload;

    if (!jobId || !capability) {
      return { statusCode: 400, body: JSON.stringify({ error: 'jobId and capability required' }) };
    }

    // Update job status to running
    await supabase
      .from('tool_jobs')
      .update({ status: 'running', progress: 0, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    // Get target and entries
    const targetId = capability.startsWith('vendor:') || capability.startsWith('scrape:')
      ? capability
      : `vendor:${capability}`;

    const { data: target } = await supabase
      .from('pool_targets')
      .select('*')
      .eq('id', targetId)
      .eq('status', 'active')
      .single();

    if (!target) {
      await failJob(jobId, 'Target not found');
      return { statusCode: 404, body: JSON.stringify({ error: 'Target not found' }) };
    }

    const { data: entries } = await supabase
      .from('pool_entries')
      .select('*')
      .eq('target_id', targetId)
      .eq('status', 'active')
      .order('priority', { ascending: true });

    if (!entries || entries.length === 0) {
      await failJob(jobId, 'No active entries for target');
      return { statusCode: 404, body: JSON.stringify({ error: 'No active entries' }) };
    }

    // Execute with fallback
    let result = null;
    let lastError = null;

    for (const entry of entries) {
      try {
        // Check circuit breaker
        const health = await getHealth('entry', entry.id);
        if (health?.state === 'open') continue;

        // Get credential
        const credential = await getCredentialForEntry(entry);
        if (!credential) continue;

        // Execute connector
        result = await connectorEngine.execute(entry, credential, input, {
          onProgress: async (progress) => {
            await supabase
              .from('tool_jobs')
              .update({ progress, updated_at: new Date().toISOString() })
              .eq('id', jobId);
          }
        });

        // Success
        await supabase
          .from('tool_jobs')
          .update({
            status: 'completed',
            progress: 100,
            output_ref: result.output_ref,
            updated_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId);

        // Update health
        await updateHealth('entry', entry.id, { success: true, latency: Date.now() - startTime });

        logger.info('Background job completed', { requestId, jobId, entryId: entry.id });
        return { statusCode: 200, body: JSON.stringify({ success: true, result }) };

      } catch (err) {
        lastError = err;
        logger.warn('Entry failed, trying next', { requestId, jobId, entryId: entry.id, error: err.message });

        // Update health
        await updateHealth('entry', entry.id, { success: false, error: err.message });

        // Check if retryable
        if (err.retryable === false) break;
      }
    }

    // All entries failed
    await failJob(jobId, lastError?.message || 'All entries failed');
    return { statusCode: 500, body: JSON.stringify({ error: lastError?.message || 'All entries failed' }) };

  } catch (err) {
    logger.error('Background function error', { requestId, error: err.message, stack: err.stack });
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
}

async function failJob(jobId, error) {
  await supabase
    .from('tool_jobs')
    .update({
      status: 'failed',
      error: { message: error },
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    })
    .eq('id', jobId);
}

async function getHealth(scope, refId) {
  const { data } = await supabase
    .from('pool_health')
    .select('*')
    .eq('scope', scope)
    .eq('ref_id', refId)
    .single();
  return data;
}

async function getCredentialForEntry(entry) {
  const [vendor, tier] = entry.credential_group.split('/');
  const { data } = await supabase
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

async function updateHealth(scope, refId, outcome) {
  const health = await getHealth(scope, refId);
  if (!health) return;

  const failures = outcome.success ? 0 : health.consecutive_failures + 1;
  let state = health.state;
  let cooldownUntil = health.cooldown_until;

  if (failures >= 3 && state === 'closed') {
    state = 'open';
    // Exponential backoff: 30s, 2m, 10m, 1h, 1h...
    const backoffs = [30000, 120000, 600000, 3600000, 3600000];
    const backoff = backoffs[Math.min(failures - 3, backoffs.length - 1)];
    cooldownUntil = new Date(Date.now() + backoff).toISOString();
  } else if (outcome.success && state !== 'closed') {
    state = 'half_open';
  }

  await supabase
    .from('pool_health')
    .upsert({
      scope,
      ref_id: refId,
      state,
      consecutive_failures: failures,
      cooldown_until: cooldownUntil,
      latency_ewma: outcome.latency ? (health.latency_ewma ? health.latency_ewma * 0.9 + outcome.latency * 0.1 : outcome.latency) : health.latency_ewma,
      success_rate: outcome.success ? (health.success_rate ? health.success_rate * 0.9 + 0.1 : 1) : (health.success_rate ? health.success_rate * 0.9 : 0),
      last_error_class: outcome.success ? null : 'RETRY_NEXT',
      updated_at: new Date().toISOString()
    });
}