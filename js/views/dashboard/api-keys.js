/**
 * Black Flow - Dashboard API Keys
 */

export class APIKeys {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('dashboardContent');
    if (!content) return;

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1000px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <h1 style="margin: 0;">${this.i18n.t('dashboard.api_keys')}</h1>
          <button class="btn btn-primary" id="createApiKeyBtn">${this.i18n.t('dashboard.create_api_key')}</button>
        </div>

        <div class="card">
          <div class="card-body" style="padding: 0;">
            <div id="apiKeysList">
              <div class="empty-state" style="padding: 40px;">
                <div class="empty-state-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="12" x2="12.01" y1="11" y2="11"/></svg>
                </div>
                <h3 class="empty-state-title">${this.i18n.t('dashboard.no_api_keys')}</h3>
                <p class="empty-state-text">${this.i18n.t('dashboard.api_keys_desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Load keys
    this.loadKeys();

    // Bind events
    document.getElementById('createApiKeyBtn')?.addEventListener('click', () => this.showCreateModal());
  }

  async loadKeys() {
    // Mock data
    const keys = [
      { id: '1', prefix: 'bf_live_abc1', scopes: ['chat', 'models'], rpm: 60, lastUsed: new Date(Date.now() - 86400000), expiresAt: null },
      { id: '2', prefix: 'bf_test_xyz7', scopes: ['chat', 'tools'], rpm: 30, lastUsed: new Date(Date.now() - 172800000), expiresAt: new Date(Date.now() + 86400000 * 30) }
    ];
    this.renderKeys(keys);
  }

  renderKeys(keys) {
    const container = document.getElementById('apiKeysList');
    if (!container) return;

    if (keys.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 40px;">
          <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="20" height="14" x="2" y="5" rx="2"/></svg></div>
          <h3 class="empty-state-title">${this.i18n.t('dashboard.no_api_keys')}</h3>
          <p class="empty-state-text">${this.i18n.t('dashboard.api_keys_desc')}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = keys.map(key => `
      <div class="api-key-card">
        <div class="api-key-header">
          <div>
            <code class="api-key-prefix">${key.prefix}****</code>
            <div class="api-key-scopes" style="margin-top: 8px;">
              ${key.scopes.map(s => `<span class="api-key-scope">${s}</span>`).join('')}
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-ghost btn-sm" data-action="revoke" data-id="${key.id}">${this.i18n.t('dashboard.revoke_key')}</button>
          </div>
        </div>
        <div class="api-key-meta">
          <div class="api-key-meta-item">
            <span class="api-key-meta-label">${this.i18n.t('dashboard.api_key_last_used')}</span>
            <span class="api-key-meta-value">${key.lastUsed ? this.ui.formatRelativeTime(key.lastUsed) : this.i18n.t('common.never')}</span>
          </div>
          <div class="api-key-meta-item">
            <span class="api-key-meta-label">${this.i18n.t('dashboard.api_key_expires')}</span>
            <span class="api-key-meta-value">${key.expiresAt ? this.ui.formatDate(key.expiresAt) : this.i18n.t('common.never')}</span>
          </div>
        </div>
        <div class="api-key-actions">
          <button class="btn btn-ghost btn-sm" data-action="revoke" data-id="${key.id}">${this.i18n.t('dashboard.revoke_key')}</button>
        </div>
      </div>
    `).join('');

    // Bind revoke buttons
    container.querySelectorAll('[data-action="revoke"]').forEach(btn => {
      btn.addEventListener('click', () => this.revokeKey(btn.dataset.id));
    });
  }

  showCreateModal() {
    const modal = this.ui.showModal(`
      <form id="createApiKeyForm">
        <div style="margin-bottom: 20px;">
          <label class="label">${this.i18n.t('dashboard.api_key_name')}</label>
          <input type="text" name="name" class="input" placeholder="My API Key" required>
        </div>
        <div style="margin-bottom: 20px;">
          <label class="label">${this.i18n.t('dashboard.api_key_scopes')}</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
            ${['chat', 'models', 'tools', 'files', 'debug'].map(s => `
              <label class="checkbox-wrapper">
                <input type="checkbox" name="scopes" value="${s}" ${['chat', 'models'].includes(s) ? 'checked' : ''} />
                <span class="checkbox-custom"></span>
                <span class="checkbox-label">${s}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div style="margin-bottom: 20px;">
          <label class="label">${this.i18n.t('dashboard.api_key_expires')}</label>
          <input type="date" name="expiresAt" class="input" style="max-width: 200px;">
          <p class="helper-text">${this.i18n.t('dashboard.api_key_expires_help')}</p>
        </div>
      </form>
    `, {
      title: this.i18n.t('dashboard.create_api_key'),
      footer: `
        <button class="btn btn-secondary" id="cancelCreateKey">${this.i18n.t('common.cancel')}</button>
        <button class="btn btn-primary" id="confirmCreateKey">${this.i18n.t('common.create')}</button>
      `
    });

    document.getElementById('cancelCreateKey')?.addEventListener('click', () => modal.close());
    document.getElementById('confirmCreateKey')?.addEventListener('click', () => this.createKey(modal));
  }

  async createKey(modal) {
    const form = document.getElementById('createApiKeyForm');
    if (!form) return;

    const fd = new FormData(form);
    const name = fd.get('name');
    const scopes = fd.getAll('scopes');
    const expiresAt = fd.get('expiresAt') || null;

    modal.overlay.querySelector('#confirmCreateKey').disabled = true;
    modal.overlay.querySelector('#confirmCreateKey').textContent = this.i18n.t('common.loading');

    try {
      // In production, call API to create key
      // const { data } = await createApiKey({ name, scopes, expiresAt });
      
      // Mock response
      const mockKey = 'bf_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      modal.close();
      
      // Show key once
      this.ui.showModal(`
        <div style="text-align: center;">
          <p style="margin-bottom: 16px;">${this.i18n.t('dashboard.api_key_created')}</p>
          <div style="background: var(--color-surface-elevated); padding: 16px; border-radius: 8px; font-family: monospace; word-break: break-all; margin-bottom: 16px;">
            <code>${mockKey}</code>
          </div>
          <p style="color: var(--color-text-muted); font-size: 13px;">${this.i18n.t('dashboard.copy_key')}</p>
        </div>
      `, { title: this.i18n.t('dashboard.api_key_created') });

      this.loadKeys();
    } catch (err) {
      this.ui.toast(err.message, 'error');
    }
  }

  async revokeKey(keyId) {
    if (!confirm(this.i18n.t('dashboard.revoke_key_confirm') || 'Revoke this API key?')) return;
    
    try {
      // await revokeApiKey(keyId);
      this.ui.toast(this.i18n.t('dashboard.api_key_revoked'), 'success');
      this.loadKeys();
    } catch (err) {
      this.ui.toast(err.message, 'error');
    }
  }
}