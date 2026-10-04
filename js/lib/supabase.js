import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = import.meta.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
  console.warn('[Supabase] URL not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in environment.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'blackflow-web'
    }
  }
});

// Auth helpers
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signUp(email, password, options = {}) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: options.data || {}
    }
  });
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithOAuth(provider) {
  return supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function resetPassword(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`
  });
}

export async function updatePassword(newPassword) {
  return supabase.auth.updateUser({ password: newPassword });
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// Profile helpers
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Conversation helpers
export async function listConversations(userId, options = {}) {
  let query = supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (options.archived !== undefined) {
    query = query.eq('archived', options.archived);
  }
  if (options.pinned !== undefined) {
    query = query.eq('pinned', options.pinned);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createConversation(userId, data = {}) {
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, ...data })
    .select()
    .single();
  if (error) throw error;
  return conversation;
}

export async function updateConversation(conversationId, userId, updates) {
  const { data, error } = await supabase
    .from('conversations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteConversation(conversationId, userId) {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId);
  if (error) throw error;
}

// Message helpers
export async function listMessages(conversationId, options = {}) {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.before) {
    query = query.lt('created_at', options.before);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createMessage(conversationId, message) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, ...message })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMessage(messageId, updates) {
  const { data, error } = await supabase
    .from('messages')
    .update(updates)
    .eq('id', messageId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// File helpers
export async function listFiles(userId, options = {}) {
  let query = supabase
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createFileRecord(userId, file) {
  const { data, error } = await supabase
    .from('files')
    .insert({ user_id: userId, ...file })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSignedUploadUrl(userId, fileName, mimeType, expiresIn = 3600) {
  const path = `${userId}/${Date.now()}-${fileName}`;
  const { data, error } = await supabase.storage
    .from('files')
    .createSignedUploadUrl(path, expiresIn);
  if (error) throw error;
  return { ...data, path };
}

export async function getSignedDownloadUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from('files')
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data;
}

// Pool helpers
export async function listTargets(classFilter, planTier) {
  let query = supabase
    .from('pool_targets')
    .select('*')
    .eq('status', 'active');

  if (classFilter) {
    query = query.eq('class', classFilter);
  }
  if (planTier) {
    query = query.lte('plan_tier', planTier);
  }

  query = query.order('created_at', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listEntries(targetId) {
  const { data, error } = await supabase
    .from('pool_entries')
    .select('*')
    .eq('target_id', targetId)
    .eq('status', 'active')
    .order('priority', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getPoolHealth(scope, refId) {
  const { data, error } = await supabase
    .from('pool_health')
    .select('*')
    .eq('scope', scope)
    .eq('ref_id', refId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Request logging (client-side only logs metadata)
export async function logRequest(log) {
  const { error } = await supabase
    .from('request_logs')
    .insert(log);
  if (error) console.error('[RequestLog] Failed to log:', error);
}

// Usage tracking
export async function incrementUsage(userId, increments) {
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase.rpc('increment_usage_daily', {
    p_user_id: userId,
    p_date: today,
    p_messages: increments.messages || 0,
    p_tokens_in: increments.tokens_in || 0,
    p_tokens_out: increments.tokens_out || 0,
    p_tool_calls: increments.tool_calls || 0,
    p_cost: increments.cost || 0
  });
  if (error) console.error('[Usage] Failed to increment:', error);
}

// RPC for atomic usage increment
/*
CREATE OR REPLACE FUNCTION increment_usage_daily(
  p_user_id UUID,
  p_date DATE,
  p_messages INT DEFAULT 0,
  p_tokens_in INT DEFAULT 0,
  p_tokens_out INT DEFAULT 0,
  p_tool_calls INT DEFAULT 0,
  p_cost NUMERIC DEFAULT 0
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO usage_daily (user_id, date, messages_count, tokens_in, tokens_out, tool_calls_count, cost_est)
  VALUES (p_user_id, p_date, p_messages, p_tokens_in, p_tokens_out, p_tool_calls, p_cost)
  ON CONFLICT (user_id, date) DO UPDATE SET
    messages_count = usage_daily.messages_count + p_messages,
    tokens_in = usage_daily.tokens_in + p_tokens_in,
    tokens_out = usage_daily.tokens_out + p_tokens_out,
    tool_calls_count = usage_daily.tool_calls_count + p_tool_calls,
    cost_est = usage_daily.cost_est + p_cost;
END;
$$;
*/

// Feature flags
export async function getFeatureFlags(userRole = 'user') {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .or(`target_roles='{}',target_roles.cs.{${userRole}}`)
    .eq('enabled', true);
  if (error) throw error;
  const flags = {};
  for (const f of data) {
    if (f.rollout_pct >= 100 || Math.random() * 100 < f.rollout_pct) {
      flags[f.key] = true;
    }
  }
  return flags;
}

// Announcements
export async function getAnnouncements(userRole = 'user') {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .lte('starts_at', new Date().toISOString())
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .or(`target_roles='{}',target_roles.cs.{${userRole}}`)
    .order('severity', { ascending: false })
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Admin helpers
export async function isAdmin(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  return data?.role === 'admin' || data?.role === 'owner';
}

export async function adminListUsers(options = {}) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, subscriptions(*)')
    .order('created_at', { ascending: false })
    .range(options.offset || 0, (options.offset || 0) + (options.limit || 50) - 1);
  if (error) throw error;
  return data;
}

export async function adminUpdateUserRole(userId, role) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Realtime subscriptions
export function subscribeToConversation(conversationId, callback) {
  return supabase
    .channel(`conversation:${conversationId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, callback)
    .subscribe();
}

export function subscribeToToolJob(jobId, callback) {
  return supabase
    .channel(`tool_job:${jobId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tool_jobs',
      filter: `id=eq.${jobId}`
    }, callback)
    .subscribe();
}

export function subscribeToOrders(userId, callback) {
  return supabase
    .channel(`orders:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders',
      filter: `user_id=eq.${userId}`
    }, callback)
    .subscribe();
}