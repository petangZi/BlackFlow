/**
 * Black Flow - Admin Feature Flags
 */

export class AdminFlags {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('adminContent');
    if (!content) return;

    const flags = this.getMockFlags();

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1000px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <h1 style="margin: 0;">${this.i18n.t('admin.feature_flags')}</h1>
          <button class="btn btn-primary" id="createFlagBtn">${this.i18n.t('admin.create_flag')}</button>
        </div>

        <div class="card">
          <div class="card-body" style="padding: 0;">
            <div style="overflow-x: auto;">
              <table class="table" style="font-size: 13px;">
                <thead>
                  <tr>
                    <th>${this.i18n.t('admin.key')}</th>
                    <th>${this.i18n.t('admin.flag_enabled')}</th>
                    <th>${this.i18n.t('admin.flag_rollout')}</th>
                    <th>${this.i18n.t('admin.flag_roles')}</th>
                    <th>${this.i18n.t('common.description')}</th>
                    <th style="width: 120px;">${this.i18n.t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${flags.map(f => `
                    <tr>
                      <td><code style="font-size: 12px;">${f.key}</code></td>
                      <td>
                        <label class="switch">
                          <input type="checkbox" ${f.enabled ? 'checked' : ''} data-action="toggle-flag" data-key="${f.key}" />
                          <span class="switch-slider"></span>
                        </label>
                      </td>
                      <td>
                        <input type="range" min="0" max="100" value="${f.rollout_pct}" class="input" style="width: 120px;" data-action="update-rollout" data-key="${f.key}">
                        <span style="font-size: 12px; color: var(--color-text-muted); margin-left: 8px;">${f.rollout_pct}%</span>
                      </td>
                      <td>${f.target_roles.length > 0 ? f.target_roles.map(r => `<span class="badge badge-info" style="font-size: 11px;">${r}</span>`).join(' ') : '<span style="color: var(--color-text-muted); font-size: 12px;">All</span>'}</td>
                      <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.description || '-'}</td>
                      <td>
                        <button class="btn btn-ghost btn-sm" data-action="edit-flag" data-key="${f.key}">${this.i18n.t('common.edit')}</button>
                        <button class="btn btn-ghost btn-sm" data-action="delete-flag" data-key="${f.key}">${this.i18n.t('common.delete')}</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('createFlagBtn')?.addEventListener('click', () => this.showCreateFlagModal());
    document.querySelectorAll('[data-action="toggle-flag"]').forEach(cb => {
      cb.addEventListener('change', (e) => this.toggleFlag(e.target.dataset.key, e.target.checked));
    });
    document.querySelectorAll('[data-action="update-rollout"]').forEach(input => {
      input.addEventListener('change', (e) => this.updateRollout(e.target.dataset.key, e.target.value));
      input.addEventListener('input', (e) => {
        const span = e.target.nextElementSibling;
        if (span) span.textContent = e.target.value + '%';
      });
    });
  }

  getMockFlags() {
    return [
      { key: 'billing_enabled', enabled: true, rollout_pct: 100, target_roles: [], description: 'Enable billing/order system' },
      { key: 'byok_enabled', enabled: false, rollout_pct: 0, target_roles: [], description: 'Enable BYOK (bring your own key)' },
      { key: 'workspace_enabled', enabled: false, rollout_pct: 0, target_roles: [], description: 'Enable workspace/team features' },
      { key: 'canvas_enabled', enabled: false, rollout_pct: 0, target_roles: [], description: 'Enable canvas panel for documents/code' },
      { key: 'code_run_enabled', enabled: false, rollout_pct: 0, target_roles: [], description: 'Enable code.run tool (Pyodide)' },
      { key: 'voice_enabled', enabled: false, rollout_pct: 0, target_roles: [], description: 'Enable voice mode' },
      { key: 'memory_enabled', enabled: false, rollout_pct: 0, target_roles: [], description: 'Enable cross-chat memory' },
      { key: 'share_link_enabled', enabled: false, rollout_pct: 0, target_roles: [], description: 'Enable read-only share links' },
      { key: 'model_fallback_opt_in', enabled: false, rollout_pct: 0, target_roles: [], description: 'Allow fallback to different model (opt-in)' },
      { key: 'private_mode', enabled: false, rollout_pct: 0, target_roles: [], description: 'Enable private mode (data policy filtering)' }
    ];
  }

  showCreateFlagModal() {
    const modal = this.ui.showModal(`
      <form id="createFlagForm">
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('admin.key')}</label>
          <input type="text" name="key" class="input" placeholder="feature_name" required pattern="^[a-z_]+$">
          <p class="helper-text">Lowercase with underscores only</p>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('common.description')}</label>
          <textarea name="description" class="textarea" rows="3" required></textarea>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('admin.flag_rollout')}</label>
          <input type="range" name="rollout" class="input" min="0" max="100" value="0" style="width: 100%;">
          <span id="rolloutValue" style="font-size: 12px; color: var(--color-text-muted);">0%</span>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('admin.flag_roles')}</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
            ${['user', 'admin', 'owner'].map(r => `
              <label class="checkbox-wrapper">
                <input type="checkbox" name="roles" value="${r}" />
                <span class="checkbox-custom"></span>
                <span class="checkbox-label">${r}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </form>
    `, {
      title: this.i18n.t('admin.create_flag'),
      footer: `<button class="btn btn-secondary" id="cancelFlag">${this.i18n.t('common.cancel')}</button><button class="btn btn-primary" id="confirmFlag">${this.i18n.t('common.create')}</button>`
    });

    document.getElementById('cancelFlag')?.addEventListener('click', () => modal.close());
    document.getElementById('confirmFlag')?.addEventListener('click', () => this.createFlag(modal));
  }

  toggleFlag(key, enabled) {
    this.ui.toast(`Flag ${key} ${enabled ? 'enabled' : 'disabled'}`, 'success');
    // In production: call API to update flag
  }

  updateRollout(key, value) {
    this.ui.toast(`Flag ${key} rollout: ${value}%`, 'success');
    // In production: call API to update flag
  }

  createFlag(modal) {
    const form = document.getElementById('createFlagForm');
    if (!form) return;
    const fd = new FormData(form);
    this.ui.toast(`Flag ${fd.get('key')} created`, 'success');
    modal.close();
  }
}