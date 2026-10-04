/**
 * Black Flow - Admin Audit Log
 */

export class AdminAudit {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('adminContent');
    if (!content) return;

    const logs = this.getMockAuditLogs();

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1400px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <h1 style="margin: 0;">${this.i18n.t('admin.audit_log')}</h1>
          <button class="btn btn-secondary" id="exportAudit">${this.i18n.t('admin.export_csv')}</button>
        </div>

        <div class="card">
          <div class="card-body" style="padding: 0;">
            <div style="overflow-x: auto;">
              <table class="table" style="font-size: 12px;">
                <thead>
                  <tr>
                    <th>${this.i18n.t('admin.audit_time')}</th>
                    <th>${this.i18n.t('admin.audit_actor')}</th>
                    <th>${this.i18n.t('admin.audit_action')}</th>
                    <th>${this.i18n.t('admin.audit_target')}</th>
                    <th>${this.i18n.t('admin.audit_before')}</th>
                    <th>${this.i18n.t('admin.audit_after')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${logs.map(l => `
                    <tr>
                      <td style="white-space: nowrap;">${this.ui.formatRelativeTime(l.at)}</td>
                      <td>${l.actor ? this.ui.escapeHtml(l.actor) : 'System'}</td>
                      <td><code style="font-size: 11px;">${l.action}</code></td>
                      <td>${l.target_type ? `${l.target_type}: ${l.target_id}` : '-'}</td>
                      <td><pre style="margin: 0; font-size: 10px; max-height: 100px; overflow: auto; white-space: pre-wrap;">${l.before ? JSON.stringify(l.before, null, 2) : '-'}</pre></td>
                      <td><pre style="margin: 0; font-size: 10px; max-height: 100px; overflow: auto; white-space: pre-wrap;">${l.after ? JSON.stringify(l.after, null, 2) : '-'}</pre></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('exportAudit')?.addEventListener('click', () => this.exportCSV());
  }

  getMockAuditLogs() {
    return [
      { at: new Date(Date.now() - 3600000), actor: 'admin@blackflow.example', action: 'pool_entry.created', target_type: 'pool_entry', target_id: 'model:new-model/google/direct', before: null, after: { id: 'model:new-model/google/direct', target_id: 'model:new-model', adapter: 'openai_compat' } },
      { at: new Date(Date.now() - 7200000), actor: 'owner@blackflow.example', action: 'user.role_updated', target_type: 'user', target_id: 'user-123', before: { role: 'user' }, after: { role: 'admin' } },
      { at: new Date(Date.now() - 86400000), actor: 'admin@blackflow.example', action: 'order.confirmed', target_type: 'order', target_id: 'BF-240115-A1B2', before: { status: 'pending' }, after: { status: 'paid', confirmed_by: 'admin@blackflow.example' } }
    ];
  }

  exportCSV() {
    this.ui.toast(this.i18n.t('admin.export_csv') + ' downloaded', 'success');
  }
}