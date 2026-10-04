/**
 * Black Flow - Admin API Pool
 */

export class AdminPool {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
    this.activeTab = 'targets';
  }

  async render() {
    const content = document.getElementById('adminContent');
    if (!content) return;

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1400px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <h1 style="margin: 0;">${this.i18n.t('admin.api_pool')}</h1>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-primary" id="importPoolBtn">${this.i18n.t('admin.import_json')}</button>
            <button class="btn btn-secondary" id="exportPoolBtn">${this.i18n.t('admin.export_json')}</button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs" id="poolTabs">
          <button class="tab active" data-tab="targets">${this.i18n.t('admin.targets')}</button>
          <button class="tab" data-tab="entries">${this.i18n.t('admin.entries')}</button>
          <button class="tab" data-tab="vendors">${this.i18n.t('admin.vendors')}</button>
          <button class="tab" data-tab="credentials">${this.i18n.t('admin.credentials')}</button>
          <button class="tab" data-tab="policies">${this.i18n.t('admin.policies')}</button>
          <button class="tab" data-tab="health">${this.i18n.t('admin.health')}</button>
        </div>

        <!-- Tab Panels -->
        <div id="poolTabPanel">
          ${this.renderTargetsTab()}
        </div>
      </div>
    `;

    this.bindTabs();
    this.bindActions();
  }

  renderTargetsTab() {
    const targets = this.getMockTargets();
    return `
      <div class="card" style="margin-top: 16px;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('admin.targets')}</h3>
          <button class="btn btn-primary btn-sm" id="addTargetBtn">${this.i18n.t('admin.add_target')}</button>
        </div>
        <div class="card-body" style="padding: 0;">
          <div style="overflow-x: auto;">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>${this.i18n.t('admin.target_id')}</th>
                  <th>${this.i18n.t('admin.target_class')}</th>
                  <th>${this.i18n.t('admin.title')}</th>
                  <th>${this.i18n.t('dashboard.plan')}</th>
                  <th>${this.i18n.t('dashboard.features')}</th>
                  <th>${this.i18n.t('admin.similar_to')}</th>
                  <th>${this.i18n.t('admin.status')}</th>
                  <th style="width: 120px;">${this.i18n.t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                ${targets.map(t => `
                  <tr>
                    <td><code style="font-size: 12px;">${t.id}</code></td>
                    <td><span class="badge badge-${t.class === 'model' ? 'primary' : t.class === 'vendor' ? 'success' : 'info'}">${t.class}</span></td>
                    <td>${this.ui.escapeHtml(t.title)}</td>
                    <td><span class="plan-badge plan-${t.plan_tier}">${t.plan_tier}</span></td>
                    <td>${t.features.map(f => `<span class="badge badge-neutral" style="font-size: 11px;">${f}</span>`).join(' ')}</td>
                    <td>${t.similar_to?.map(s => `<span class="badge badge-info" style="font-size: 11px;">${s.target} (${Math.round(s.similarity * 100)}%)</span>`).join(' ') || '-'}</td>
                    <td><span class="badge badge-${t.status === 'active' ? 'success' : 'neutral'}">${t.status}</span></td>
                    <td>
                      <button class="btn btn-ghost btn-sm" data-action="edit-target" data-id="${t.id}">${this.i18n.t('common.edit')}</button>
                      <button class="btn btn-ghost btn-sm" data-action="test-target" data-id="${t.id}">${this.i18n.t('admin.test_entry')}</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  renderEntriesTab() {
    const entries = this.getMockEntries();
    return `
      <div class="card" style="margin-top: 16px;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('admin.entries')}</h3>
          <button class="btn btn-primary btn-sm" id="addEntryBtn">${this.i18n.t('admin.add_entry')}</button>
        </div>
        <div class="card-body" style="padding: 0;">
          <div style="overflow-x: auto;">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>${this.i18n.t('admin.entry_id')}</th>
                  <th>${this.i18n.t('admin.target_id')}</th>
                  <th>${this.i18n.t('admin.vendors')}</th>
                  <th>${this.i18n.t('admin.adapter')}</th>
                  <th>${this.i18n.t('admin.priority')}</th>
                  <th>${this.i18n.t('admin.quality')}</th>
                  <th>${this.i18n.t('admin.status')}</th>
                  <th style="width: 120px;">${this.i18n.t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                ${entries.map(e => `
                  <tr>
                    <td><code style="font-size: 12px;">${e.id}</code></td>
                    <td><code style="font-size: 12px;">${e.target_id}</code></td>
                    <td>${e.vendor_id}</td>
                    <td><code style="font-size: 12px;">${e.adapter}</code></td>
                    <td>${e.priority}</td>
                    <td>${e.quality}</td>
                    <td><span class="badge badge-${e.status === 'active' ? 'success' : 'neutral'}">${e.status}</span></td>
                    <td>
                      <button class="btn btn-ghost btn-sm" data-action="edit-entry" data-id="${e.id}">${this.i18n.t('common.edit')}</button>
                      <button class="btn btn-ghost btn-sm" data-action="test-entry" data-id="${e.id}">${this.i18n.t('admin.test_entry')}</button>
                      <button class="btn btn-ghost btn-sm" data-action="dry-run" data-id="${e.id}">${this.i18n.t('admin.dry_run_route')}</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  renderVendorsTab() {
    const vendors = this.getMockVendors();
    return `
      <div class="card" style="margin-top: 16px;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('admin.vendors')}</h3>
          <button class="btn btn-primary btn-sm" id="addVendorBtn">${this.i18n.t('admin.add_vendor')}</button>
        </div>
        <div class="card-body" style="padding: 0;">
          <div style="overflow-x: auto;">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>${this.i18n.t('admin.vendors')}</th>
                  <th>${this.i18n.t('admin.kinds')}</th>
                  <th>${this.i18n.t('admin.base_urls')}</th>
                  <th>${this.i18n.t('admin.data_policy')}</th>
                  <th>${this.i18n.t('admin.status')}</th>
                  <th style="width: 100px;">${this.i18n.t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                ${vendors.map(v => `
                  <tr>
                    <td><code style="font-size: 12px;">${v.id}</code></td>
                    <td>${v.kinds.map(k => `<span class="badge badge-info" style="font-size: 11px;">${k}</span>`).join(' ')}</td>
                    <td><code style="font-size: 11px;">${JSON.stringify(v.base_urls)}</code></td>
                    <td><code style="font-size: 11px;">${JSON.stringify(v.data_policy)}</code></td>
                    <td><span class="badge badge-${v.status === 'active' ? 'success' : 'neutral'}">${v.status}</span></td>
                    <td>
                      <button class="btn btn-ghost btn-sm" data-action="edit-vendor" data-id="${v.id}">${this.i18n.t('common.edit')}</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  renderCredentialsTab() {
    const creds = this.getMockCredentials();
    return `
      <div class="card" style="margin-top: 16px;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('admin.credentials')}</h3>
          <button class="btn btn-primary btn-sm" id="addCredentialBtn">${this.i18n.t('admin.add_credential')}</button>
        </div>
        <div class="card-body" style="padding: 0;">
          <div style="overflow-x: auto;">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>${this.i18n.t('admin.vendors')}</th>
                  <th>${this.i18n.t('admin.credential_tier')}</th>
                  <th>${this.i18n.t('admin.hint')}</th>
                  <th>${this.i18n.t('admin.credential_status')}</th>
                  <th>${this.i18n.t('admin.credential_limits')}</th>
                  <th style="width: 120px;">${this.i18n.t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                ${creds.map(c => `
                  <tr>
                    <td>${c.vendor_id}</td>
                    <td><span class="badge badge-${c.tier === 'byok' ? 'warning' : c.tier === 'pro' ? 'success' : 'info'}">${c.tier}</span></td>
                    <td>${c.hint}</td>
                    <td><span class="badge badge-${c.status === 'active' ? 'success' : c.status === 'invalid' ? 'error' : 'neutral'}">${c.status}</span></td>
                    <td><code style="font-size: 11px;">${JSON.stringify(c.limits)}</code></td>
                    <td>
                      <button class="btn btn-ghost btn-sm" data-action="test-credential" data-id="${c.id}">${this.i18n.t('admin.test')}</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  renderPoliciesTab() {
    const policies = this.getMockPolicies();
    return `
      <div class="card" style="margin-top: 16px;">
        <div class="card-header">
          <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('admin.policies')}</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          <div style="overflow-x: auto;">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>${this.i18n.t('admin.scope')}</th>
                  <th>${this.i18n.t('admin.ref_id')}</th>
                  <th>${this.i18n.t('admin.weights')}</th>
                  <th>${this.i18n.t('admin.max_attempts')}</th>
                  <th>${this.i18n.t('admin.deadline_ms')}</th>
                  <th>${this.i18n.t('admin.fallback_mode')}</th>
                  <th>${this.i18n.t('admin.domain_allow')}</th>
                  <th>${this.i18n.t('admin.domain_deny')}</th>
                </tr>
              </thead>
              <tbody>
                ${policies.map(p => `
                  <tr>
                    <td>${p.scope}</td>
                    <td>${p.ref_id}</td>
                    <td><code style="font-size: 11px;">${JSON.stringify(p.weights)}</code></td>
                    <td>${p.max_attempts}</td>
                    <td>${p.deadline_ms}ms</td>
                    <td>${p.fallback_mode}</td>
                    <td>${p.domain_allow?.join(', ') || '-'}</td>
                    <td>${p.domain_deny?.join(', ') || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  renderHealthTab() {
    const health = this.getMockHealth();
    return `
      <div class="card" style="margin-top: 16px;">
        <div class="card-header">
          <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('admin.health')}</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          <div style="overflow-x: auto;">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>${this.i18n.t('admin.scope')}</th>
                  <th>${this.i18n.t('admin.ref_id')}</th>
                  <th>${this.i18n.t('admin.circuit_state')}</th>
                  <th>${this.i18n.t('admin.consecutive_failures')}</th>
                  <th>${this.i18n.t('admin.cooldown_until')}</th>
                  <th>${this.i18n.t('admin.latency_ewma')}</th>
                  <th>${this.i18n.t('admin.success_rate')}</th>
                  <th>${this.i18n.t('admin.last_error')}</th>
                </tr>
              </thead>
              <tbody>
                ${health.map(h => `
                  <tr>
                    <td>${h.scope}</td>
                    <td><code style="font-size: 12px;">${h.ref_id}</code></td>
                    <td><span class="badge badge-${h.state === 'closed' ? 'success' : h.state === 'open' ? 'error' : 'warning'}">${h.state}</span></td>
                    <td>${h.consecutive_failures}</td>
                    <td>${h.cooldown_until ? this.ui.formatRelativeTime(h.cooldown_until) : '-'}</td>
                    <td>${h.latency_ewma ? Math.round(h.latency_ewma) + 'ms' : '-'}</td>
                    <td>${h.success_rate ? (h.success_rate * 100).toFixed(1) + '%' : '-'}</td>
                    <td>${h.last_error_class || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  getMockTargets() {
    return [
      { id: 'model:gemini-3.8', title: 'Gemini 3.8', class: 'model', plan_tier: 'free', features: ['vision', 'tools', 'reasoning'], similar_to: [], status: 'active' },
      { id: 'model:gpt-4o', title: 'GPT-4o', class: 'model', plan_tier: 'pro', features: ['vision', 'tools', 'reasoning'], similar_to: [], status: 'active' },
      { id: 'vendor:pdf.compress', title: 'PDF Compress', class: 'vendor', plan_tier: 'free', features: ['compress'], similar_to: [{ target: 'vendor:pdf.optimize', similarity: 0.8 }], status: 'active' },
      { id: 'scrape:web.search', title: 'Web Search', class: 'scrape', plan_tier: 'free', features: ['search'], similar_to: [{ target: 'scrape:web.search_lite', similarity: 0.7 }], status: 'active' }
    ];
  }

  getMockEntries() {
    return [
      { id: 'model:gemini-3.8/google/direct', target_id: 'model:gemini-3.8', vendor_id: 'google', adapter: 'openai_compat', priority: 10, quality: 1.0, status: 'active' },
      { id: 'vendor:pdf.compress/ilovepdf/std', target_id: 'vendor:pdf.compress', vendor_id: 'ilovepdf', adapter: 'http_manifest', priority: 10, quality: 0.9, status: 'active' },
      { id: 'scrape:web.search/vendor_s/js', target_id: 'scrape:web.search', vendor_id: 'vendor_s', adapter: 'http_manifest', priority: 10, quality: 0.85, status: 'active' }
    ];
  }

  getMockVendors() {
    return [
      { id: 'google', kinds: ['model'], base_urls: { default: 'https://generativelanguage.googleapis.com' }, data_policy: { retention: 'zero' }, status: 'active' },
      { id: 'openrouter', kinds: ['model'], base_urls: { default: 'https://openrouter.ai/api/v1' }, data_policy: { retention: 'zero' }, status: 'active' },
      { id: 'ilovepdf', kinds: ['vendor'], base_urls: { default: 'https://api.ilovepdf.com/v1' }, data_policy: { retention: 'deleted_after_2h' }, status: 'active' }
    ];
  }

  getMockCredentials() {
    return [
      { id: '1', vendor_id: 'google', tier: 'pro', hint: 'AIza****1234', status: 'active', limits: { rpm: 60, tpm: 100000 } },
      { id: '2', vendor_id: 'openrouter', tier: 'pro', hint: 'sk-or-****5678', status: 'active', limits: { rpm: 100, tpm: 200000 } },
      { id: '3', vendor_id: 'ilovepdf', tier: 'pro', hint: 'pub_****9012', status: 'active', limits: { rpm: 60 } }
    ];
  }

  getMockPolicies() {
    return [
      { scope: 'class', ref_id: 'model', weights: { health: 0.4, latency: 0.3, cost: 0.3 }, max_attempts: 6, deadline_ms: 55000, fallback_mode: 'ask_model', domain_allow: [], domain_deny: [] },
      { scope: 'class', ref_id: 'vendor', weights: { quality: 0.4, health: 0.3, cost: 0.15, latency: 0.15 }, max_attempts: 6, deadline_ms: 55000, fallback_mode: 'ask_model', domain_allow: [], domain_deny: [] },
      { scope: 'class', ref_id: 'scrape', weights: { health: 0.3, success_rate: 0.3, cost: 0.25, latency: 0.15 }, max_attempts: 6, deadline_ms: 55000, fallback_mode: 'ask_model', domain_allow: [], domain_deny: ['localhost', '127.0.0.1', '169.254.169.254'] }
    ];
  }

  getMockHealth() {
    return [
      { scope: 'entry', ref_id: 'model:gemini-3.8/google/direct', state: 'closed', consecutive_failures: 0, cooldown_until: null, latency_ewma: 1200, success_rate: 0.99, last_error_class: null },
      { scope: 'entry', ref_id: 'vendor:pdf.compress/ilovepdf/std', state: 'closed', consecutive_failures: 0, cooldown_until: null, latency_ewma: 2300, success_rate: 0.98, last_error_class: null },
      { scope: 'credential', ref_id: '1', state: 'closed', consecutive_failures: 0, cooldown_until: null, latency_ewma: 1100, success_rate: 0.995, last_error_class: null }
    ];
  }

  bindTabs() {
    document.querySelectorAll('#poolTabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#poolTabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeTab = tab.dataset.tab;
        this.renderTabPanel();
      });
    });
  }

  renderTabPanel() {
    const panel = document.getElementById('poolTabPanel');
    if (!panel) return;

    switch (this.activeTab) {
      case 'targets': panel.innerHTML = this.renderTargetsTab(); break;
      case 'entries': panel.innerHTML = this.renderEntriesTab(); break;
      case 'vendors': panel.innerHTML = this.renderVendorsTab(); break;
      case 'credentials': panel.innerHTML = this.renderCredentialsTab(); break;
      case 'policies': panel.innerHTML = this.renderPoliciesTab(); break;
      case 'health': panel.innerHTML = this.renderHealthTab(); break;
    }
    this.bindActions();
  }

  bindActions() {
    // Add target
    document.getElementById('addTargetBtn')?.addEventListener('click', () => this.showAddTargetModal());
    document.getElementById('addEntryBtn')?.addEventListener('click', () => this.showAddEntryModal());
    document.getElementById('addVendorBtn')?.addEventListener('click', () => this.showAddVendorModal());
    document.getElementById('addCredentialBtn')?.addEventListener('click', () => this.showAddCredentialModal());
    document.getElementById('importPoolBtn')?.addEventListener('click', () => this.importJSON());
    document.getElementById('exportPoolBtn')?.addEventListener('click', () => this.exportJSON());

    // Table actions
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        this.handleAction(action, id);
      });
    });
  }

  showAddTargetModal() {
    const modal = this.ui.showModal(`
      <form id="addTargetForm">
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('admin.target_id')}</label>
          <input type="text" name="id" class="input" placeholder="model:my-model" required pattern="^(model|vendor|scrape):[a-z0-9_.-]+$">
          <p class="helper-text">Format: model:|vendor:|scrape: followed by lowercase alphanumeric, dots, underscores, hyphens</p>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('admin.target_class')}</label>
          <select name="class" class="input select" required>
            <option value="model">Model</option>
            <option value="vendor">Vendor Tool</option>
            <option value="scrape">Scrape</option>
          </select>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('admin.title')}</label>
          <input type="text" name="title" class="input" required>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('dashboard.plan')}</label>
          <select name="plan_tier" class="input select" required>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="team">Team</option>
          </select>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('dashboard.features')}</label>
          <input type="text" name="features" class="input" placeholder="vision,tools,reasoning (comma-separated)">
        </div>
      </form>
    `, {
      title: this.i18n.t('admin.add_target'),
      footer: `<button class="btn btn-secondary" id="cancelTarget">${this.i18n.t('common.cancel')}</button><button class="btn btn-primary" id="confirmTarget">${this.i18n.t('common.save')}</button>`
    });

    document.getElementById('cancelTarget')?.addEventListener('click', () => modal.close());
    document.getElementById('confirmTarget')?.addEventListener('click', () => this.addTarget(modal));
  }

  showAddEntryModal() { this.ui.toast('Add Entry - coming soon', 'info'); }
  showAddVendorModal() { this.ui.toast('Add Vendor - coming soon', 'info'); }
  showAddCredentialModal() { this.ui.toast('Add Credential - coming soon', 'info'); }

  handleAction(action, id) {
    this.ui.toast(`${action} for ${id} - coming soon`, 'info');
  }

  importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            JSON.parse(e.target.result);
            this.ui.toast('Import successful', 'success');
            this.renderTabPanel();
          } catch {
            this.ui.toast('Invalid JSON', 'error');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  exportJSON() {
    const data = {
      targets: this.getMockTargets(),
      entries: this.getMockEntries(),
      vendors: this.getMockVendors(),
      credentials: this.getMockCredentials(),
      policies: this.getMockPolicies()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blackflow-pool-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.ui.toast(this.i18n.t('admin.export_json') + ' downloaded', 'success');
  }
}