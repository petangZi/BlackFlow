/**
 * Black Flow - Dashboard Settings
 */

export class Settings {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('dashboardContent');
    if (!content) return;

    content.innerHTML = `
      <div style="padding: 24px; max-width: 800px; margin: 0 auto;">
        <h1 style="margin: 0 0 24px;">${this.i18n.t('dashboard.settings')}</h1>

        <!-- Profile -->
        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header">
            <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('dashboard.settings_profile')}</h3>
          </div>
          <div class="card-body">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
              <div class="avatar avatar-xl" style="background: var(--color-accent-muted); color: var(--color-accent);">${(this.store.profile?.email || 'U')[0].toUpperCase()}</div>
              <div>
                <div style="font-weight: 600; font-size: 18px;">${this.ui.escapeHtml(this.store.profile?.email || 'User')}</div>
                <div style="color: var(--color-text-muted);">${this.store.profile?.plan_id || 'free'}</div>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
              <div>
                <label class="label">${this.i18n.t('auth.email')}</label>
                <input type="email" class="input" value="${this.ui.escapeHtml(this.store.profile?.email || '')}" disabled>
              </div>
              <div>
                <label class="label">${this.i18n.t('dashboard.settings_language')}</label>
                <select class="input select" id="settingLanguage">
                  <option value="id" ${this.store.locale === 'id' ? 'selected' : ''}>Indonesia</option>
                  <option value="en" ${this.store.locale === 'en' ? 'selected' : ''}>English</option>
                </select>
              </div>
              <div>
                <label class="label">${this.i18n.t('dashboard.settings_theme')}</label>
                <select class="input select" id="settingTheme">
                  <option value="dark" ${this.store.theme === 'dark' ? 'selected' : ''}>${this.i18n.t('dashboard.theme_dark')}</option>
                  <option value="light" ${this.store.theme === 'light' ? 'selected' : ''}>${this.i18n.t('dashboard.theme_light')}</option>
                  <option value="system" ${this.store.theme === 'system' ? 'selected' : ''}>${this.i18n.t('dashboard.theme_system')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Global Instructions -->
        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header">
            <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('dashboard.settings_instructions')}</h3>
          </div>
          <div class="card-body">
            <textarea class="textarea" id="globalInstructions" rows="6" placeholder="${this.i18n.t('dashboard.settings_instructions_placeholder') || 'Global instructions for all chats...'}">${this.ui.escapeHtml(this.store.profile?.prefs?.globalInstructions || '')}</textarea>
            <p class="helper-text">${this.i18n.t('dashboard.settings_instructions_help')}</p>
          </div>
        </div>

        <!-- Data & Privacy -->
        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header">
            <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('dashboard.settings_data')}</h3>
          </div>
          <div class="card-body">
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <button class="btn btn-secondary" style="justify-content: flex-start; text-align: left;" id="exportDataBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg>
                ${this.i18n.t('dashboard.export_data')}
              </button>
              <button class="btn btn-secondary" style="justify-content: flex-start; text-align: left; border: 1px solid var(--color-error); color: var(--color-error);" id="deleteAccountBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                ${this.i18n.t('dashboard.delete_account')}
              </button>
            </div>
            <p class="helper-text">${this.i18n.t('dashboard.data_retention_info')}</p>
          </div>
        </div>

        <!-- Save Button -->
        <div style="display: flex; justify-content: flex-end;">
          <button class="btn btn-primary" id="saveSettingsBtn">${this.i18n.t('common.save')}</button>
        </div>
      </div>
    `;

    // Bind events
    document.getElementById('settingLanguage')?.addEventListener('change', (e) => this.ui.setLocale(e.target.value));
    document.getElementById('settingTheme')?.addEventListener('change', (e) => this.ui.applyTheme(e.target.value));
    document.getElementById('saveSettingsBtn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('exportDataBtn')?.addEventListener('click', () => this.exportData());
    document.getElementById('deleteAccountBtn')?.addEventListener('click', () => this.deleteAccount());
    document.getElementById('globalInstructions')?.addEventListener('input', (e) => {
      this.store.profile.prefs = this.store.profile.prefs || {};
      this.store.profile.prefs.globalInstructions = e.target.value;
    });
  }

  async saveSettings() {
    this.ui.toast(this.i18n.t('common.success'), 'success');
    // In production: call updateProfile API
  }

  async exportData() {
    this.ui.toast(this.i18n.t('dashboard.export_data') + ' - coming soon', 'info');
  }

  async deleteAccount() {
    if (!confirm(this.i18n.t('dashboard.delete_account_confirm'))) return;
    if (!confirm(this.i18n.t('dashboard.delete_account_confirm2'))) return;
    this.ui.toast(this.i18n.t('dashboard.delete_account') + ' - coming soon', 'warning');
  }
}