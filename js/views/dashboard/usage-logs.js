/**
 * Black Flow - Dashboard Usage & Logs
 */

export class UsageLogs {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('dashboardContent');
    if (!content) return;

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1200px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <h1 style="margin: 0;">${this.i18n.t('dashboard.usage_logs')}</h1>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-secondary" id="exportLogs">${this.i18n.t('dashboard.export_csv')}</button>
          </div>
        </div>

        <!-- Filters -->
        <div class="card" style="margin-bottom: 24px;">
          <div class="card-body" style="padding: 16px;">
            <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: end;">
              <div style="flex: 1; min-width: 200px;">
                <label class="label">${this.i18n.t('common.search')}</label>
                <input type="text" class="input" id="logSearch" placeholder="${this.i18n.t('common.search')}...">
              </div>
              <div style="min-width: 150px;">
                <label class="label">${this.i18n.t('common.filter')}</label>
                <select class="input select" id="logFilter">
                  <option value="all">${this.i18n.t('common.all')}</option>
                  <option value="model">Model</option>
                  <option value="vendor">Vendor Tool</option>
                  <option value="scrape">Scrape</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div style="min-width: 150px;">
                <label class="label">${this.i18n.t('common.sort')}</label>
                <select class="input select" id="logSort">
                  <option value="newest">${this.i18n.t('time.just_now')}</option>
                  <option value="oldest">${this.i18n.t('time.days_ago', { n: 7 })}</option>
                  <option value="cost_desc">${this.i18n.t('dashboard.total_cost')} (High to Low)</option>
                  <option value="latency_desc">${this.i18n.t('dashboard.avg_latency')} (High to Low)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Logs Table -->
        <div class="card">
          <div class="card-body" style="padding: 0;">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th style="width: 160px;">${this.i18n.t('time.hours_ago', { n: 0 })}</th>
                  <th>${this.i18n.t('dashboard.target_type') || 'Target'}</th>
                  <th>${this.i18n.t('dashboard.model') || 'Model/Tool'}</th>
                  <th style="width: 100px;">${this.i18n.t('dashboard.status')}</th>
                  <th style="width: 100px;">${this.i18n.t('dashboard.tokens_in')}</th>
                  <th style="width: 100px;">${this.i18n.t('dashboard.tokens_out')}</th>
                  <th style="width: 100px;">${this.i18n.t('dashboard.avg_latency')}</th>
                  <th style="width: 100px;">${this.i18n.t('dashboard.total_cost')}</th>
                </tr>
              </thead>
              <tbody id="logsTableBody">
                <tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--color-text-muted);">${this.i18n.t('common.loading')}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Load logs
    this.loadLogs();

    // Bind events
    document.getElementById('exportLogs')?.addEventListener('click', () => this.exportCSV());
  }

  async loadLogs() {
    // In production, fetch from API
    const logs = this.getMockLogs();
    this.renderLogs(logs);
  }

  getMockLogs() {
    return [
      { id: 'req-1', timestamp: new Date(Date.now() - 300000), targetType: 'model', target: 'Gemini 3.8', status: 'success', tokensIn: 150, tokensOut: 890, latency: 1200, cost: 0.00012 },
      { id: 'req-2', timestamp: new Date(Date.now() - 600000), targetType: 'vendor', target: 'PDF Compress', status: 'success', tokensIn: 0, tokensOut: 0, latency: 2300, cost: 0.01 },
      { id: 'req-3', timestamp: new Date(Date.now() - 900000), targetType: 'scrape', target: 'Web Search', status: 'success', tokensIn: 45, tokensOut: 230, latency: 1800, cost: 0.002 },
      { id: 'req-4', timestamp: new Date(Date.now() - 1200000), targetType: 'model', target: 'GPT-4o', status: 'error', tokensIn: 200, tokensOut: 0, latency: 5000, cost: 0 },
      { id: 'req-5', timestamp: new Date(Date.now() - 3600000), targetType: 'model', target: 'Claude 3.5 Sonnet', status: 'success', tokensIn: 180, tokensOut: 1200, latency: 1500, cost: 0.00021 }
    ];
  }

  renderLogs(logs) {
    const tbody = document.getElementById('logsTableBody');
    if (!tbody) return;

    tbody.innerHTML = logs.map(log => `
      <tr>
        <td>${this.ui.formatRelativeTime(log.timestamp)}</td>
        <td><span class="badge badge-${log.targetType}">${log.targetType}</span></td>
        <td>${this.ui.escapeHtml(log.target)}</td>
        <td><span class="badge badge-${log.status === 'success' ? 'success' : 'error'}">${log.status}</span></td>
        <td>${log.tokensIn.toLocaleString()}</td>
        <td>${log.tokensOut.toLocaleString()}</td>
        <td>${log.latency}ms</td>
        <td>Rp ${log.cost.toLocaleString('id-ID', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');
  }

  exportCSV() {
    this.ui.toast(this.i18n.t('dashboard.export_csv') + ' - coming soon', 'info');
  }
}