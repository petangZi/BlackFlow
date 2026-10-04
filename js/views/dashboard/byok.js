/**
 * Black Flow - Dashboard BYOK (Bring Your Own Key)
 */

export class BYOK {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('dashboardContent');
    if (!content) return;

    if (!this.store.isFeatureEnabled('byok_enabled')) {
      content.innerHTML = `
        <div style="padding: 24px; max-width: 800px; margin: 0 auto;">
          <div class="empty-state" style="padding: 60px 20px;">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.5 21H8a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1.9"/><path d="M16 7h5"/><path d="M18.5 5V3"/></svg>
            </div>
            <h3 class="empty-state-title">${this.i18n.t('dashboard.byok')}</h3>
            <p class="empty-state-text">${this.i18n.t('dashboard.byok_not_enabled')}</p>
          </div>
        </div>
      </div>
      `;
      return;
    }

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1000px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <h1 style="margin: 0;">${this.i18n.t('dashboard.byok')}</h1>
          <button class="btn btn-primary" id="addByokBtn">${this.i18n.t('dashboard.byok_add')}</button>
        </div>

        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header">
            <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('dashboard.byok_use_first')}</h3>
          </div>
          <div class="card-body">
            <label class="switch">
              <input type="checkbox" id="useOwnKeyFirst" />
              <span class="switch-slider"></span>
            </label>
            <p style="margin: 8px 0 0; font-size: 13px; color: var(--color-text-muted);">${this.i18n.t('dashboard.byok_use_first_desc')}</p>
          </div>
        </div>

        <div class="card">
          <div class="card-body" style="padding: 0;">
            <div id="byokList">
              <div class="empty-state" style="padding: 40px;">
                <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.5 21H8a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1.9"/></svg></div>
                <h3 class="empty-state-title">${this.i18n.t('dashboard.no_byok_keys')}</h3>
                <p class="empty-state-text">${this.i18n.t('dashboard.byok_desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.loadKeys();
    document.getElementById('addByokBtn')?.addEventListener('click', () => this.showAddModal());
    document.getElementById('useOwnKeyFirst')?.addEventListener('change', (e) => this.saveUseFirst(e.target.checked));
  }

  async loadKeys() {
    // Mock data
    const keys = [
      { id: '1', vendor: 'openai', tier: 'byok', hint: 'sk-****1234', status: 'active', useFirst: false },
      { id: '2', vendor: 'anthropic', tier: 'byok', hint: 'sk-ant-****5678', status: 'active', useFirst: true }
    ];
    this.renderKeys(keys);
  }

  renderKeys(keys) {
    const container = document.getElementById('byokList');
    if (!container) return;

    if (keys.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 40px;">
          <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.5 21H8a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1.9"/></svg></div>
          <h3 class="empty-state-title">${this.i18n.t('dashboard.no_byok_keys')}</h3>
          <p class="empty-state-text">${this.i18n.t('dashboard.byok_desc')}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = keys.map(key => `
      <div class="key-item">
        <div class="key-item-info">
          <div class="key-item-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15.5 21H8a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1.9"/></svg>
          </div>
          <div class="key-item-details">
            <div class="key-item-label">${this.vendorLabel(key.vendor)}</div>
            <div class="key-item-hint">${key.hint} · ${this.i18n.t('common.' + key.status)}</div>
          </div>
        </div>
        <div class="key-item-status">
          <span class="badge badge-${key.status === 'active' ? 'success' : 'neutral'}">${key.status}</span>
        </div>
        <div class="key-item-actions">
          <button class="btn btn-ghost btn-sm" data-action="test" data-id="${key.id}" title="${this.i18n.t('dashboard.byok_test')}">${this.i18n.t('dashboard.byok_test')}</button>
          <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${key.id}" title="${this.i18n.t('common.delete')}">${this.i18n.t('common.delete')}</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-action="test"]').forEach(btn => {
      btn.addEventListener('click', () => this.testKey(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => this.deleteKey(btn.dataset.id));
    });
  }

  vendorLabel(vendor) {
    const labels = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google (Gemini)',
      groq: 'Groq',
      openrouter: 'OpenRouter',
      ilovepdf: 'iLovePDF',
      vendor_s: 'Vendor S'
    };
    return labels[vendor] || vendor;
  }

  showAddModal() {
    const modal = this.ui.showModal(`
      <form id="addByokForm">
        <div style="margin-bottom: 20px;">
          <label class="label">${this.i18n.t('dashboard.byok_vendor')}</label>
          <select name="vendor" class="input select" required>
            <option value="">${this.i18n.t('common.select')}...</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google (Gemini)</option>
            <option value="groq">Groq</option>
            <option value="openrouter">OpenRouter</option>
            <option value="ilovepdf">iLovePDF</option>
          </select>
        </div>
        <div style="margin-bottom: 20px;">
          <label class="label">${this.i18n.t('dashboard.byok_key')}</label>
          <input type="password" name="key" class="input" placeholder="sk-..." required autocomplete="off">
        </div>
        <div style="margin-bottom: 20px;">
          <label class="checkbox-wrapper">
            <input type="checkbox" name="useFirst" id="byokUseFirst" />
            <span class="checkbox-custom"></span>
            <span class="checkbox-label">${this.i18n.t('dashboard.byok_use_first')}</span>
          </label>
        </div>
      </form>
    `, {
      title: this.i18n.t('dashboard.byok_add'),
      footer: `
        <button class="btn btn-secondary" id="cancelByok">${this.i18n.t('common.cancel')}</button>
        <button class="btn btn-primary" id="confirmByok">${this.i18n.t('common.save')}</button>
      `
    });

    document.getElementById('cancelByok')?.addEventListener('click', () => modal.close());
    document.getElementById('confirmByok')?.addEventListener('click', () => this.addKey(modal));
  }

  async addKey(modal) {
    const form = document.getElementById('addByokForm');
    if (!form) return;

    const fd = new FormData(form);
    const vendor = fd.get('vendor');
    const key = fd.get('key');
    const useFirst = fd.get('useFirst') === 'on';

    modal.overlay.querySelector('#confirmByok').disabled = true;
    modal.overlay.querySelector('#confirmByok').textContent = this.i18n.t('common.loading');

    try {
      // await addBYOKKey({ vendor, key, useFirst });
      this.ui.toast(this.i18n.t('dashboard.byok_added'), 'success');
      modal.close();
      this.loadKeys();
    } catch (err) {
      this.ui.toast(err.message, 'error');
    }
  }

  async testKey(keyId) {
    this.ui.toast(this.i18n.t('dashboard.byok_testing'), 'info');
    // await testBYOKKey(keyId);
    setTimeout(() => this.ui.toast(this.i18n.t('dashboard.byok_test_success'), 'success'), 1000);
  }

  async deleteKey(keyId) {
    if (!confirm(this.i18n.t('dashboard.byok_delete_confirm'))) return;
    try {
      // await deleteBYOKKey(keyId);
      this.ui.toast(this.i18n.t('dashboard.byok_deleted'), 'success');
      this.loadKeys();
    } catch (err) {
      this.ui.toast(err.message, 'error');
    }
  }

  saveUseFirst(enabled) {
    // await updateProfile({ byok_use_first: enabled });
    this.ui.toast(enabled ? this.i18n.t('dashboard.byok_use_first_on') : this.i18n.t('dashboard.byok_use_first_off'), 'success');
  }
}