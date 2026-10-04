/**
 * Black Flow - State Store
 * Simple pub/sub state management
 */

export class Store {
  constructor() {
    this.state = {
      user: null,
      profile: null,
      session: null,
      conversations: [],
      currentConversation: null,
      messages: [],
      models: [],
      selectedModel: 'model:auto',
      currentView: 'chat',
      viewParams: [],
      featureFlags: {},
      announcements: [],
      sidebarOpen: false,
      sidebarCollapsed: false,
      theme: 'dark',
      locale: 'id',
      isLoading: false,
      error: null
    };
    this.listeners = new Map();
  }

  getState() {
    return { ...this.state };
  }

  setState(partial) {
    const prev = { ...this.state };
    this.state = { ...this.state, ...partial };
    this.emit('change', this.state, prev);
    this.emit(`change:${Object.keys(partial).join(',')}`, this.state, prev);
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.setState({ [key]: value });
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => this.unsubscribe(key, callback);
  }

  unsubscribe(key, callback) {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  emit(key, ...args) {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach(cb => cb(...args));
    }
  }

  // Convenience methods
  async setUser(user) {
    this.setState({ user });
    if (user) {
      const profile = await this.fetchProfile(user.id);
      this.setState({ profile });
    }
  }

  async fetchProfile(userId) {
    try {
      const { data } = await import('./lib/supabase.js').then(m => m.supabase)
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      return data;
    } catch {
      return null;
    }
  }

  clearUser() {
    this.setState({ user: null, profile: null, session: null });
  }

  setFeatureFlags(flags) {
    this.setState({ featureFlags: flags });
  }

  setAnnouncements(announcements) {
    this.setState({ announcements });
  }

  isFeatureEnabled(flag) {
    return this.state.featureFlags[flag] === true;
  }
}

// Singleton instance
export const store = new Store();