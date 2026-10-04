/**
 * Rate Limiter - Token bucket via Supabase RPC
 */

export class RateLimiter {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async check(key, type = 'user') {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = type === 'user' ? 60 : 30; // per minute

    const { data, error } = await this.supabase.rpc('check_rate_limit', {
      p_key: key,
      p_type: type,
      p_window_ms: windowMs,
      p_max_requests: maxRequests
    });

    if (error) {
      console.error('[RateLimiter] RPC error:', error);
      return { allowed: true, resetAt: now + windowMs }; // Fail open
    }

    return {
      allowed: data.allowed,
      remaining: data.remaining,
      resetAt: data.reset_at,
      limit: maxRequests
    };
  }

  async increment(key, type = 'user') {
    await this.supabase.rpc('increment_rate_limit', {
      p_key: key,
      p_type: type
    });
  }
}

export default RateLimiter;