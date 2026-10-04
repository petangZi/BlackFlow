/**
 * Black Flow - Admin Health Map
 */

export class AdminHealth {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('adminContent');
    if (!content) return;

    const healthData = this.getMockHealthData();

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1400px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <h1 style="margin: 0;">${this.i18n.t('admin.health_map')}</h1>
          <div style="display: flex; gap: 12px;">
            <select class="input select" id="healthFilterClass" style="min-width: 150px;">
              <option value="all">${this.i18n.t('common.all')}</option>
              <option value="model">Model</option>
              <option value="vendor">Vendor Tool</option>
              <option value="scrape">Scrape</option>
            </select>
            <button class="btn btn-secondary" id="refreshHealth">${this.i18n.t('admin.refresh')}</button>
          </div>
        </div>

        <!-- Health Grid -->
        <div class="health-grid" id="healthGrid">
          ${healthData.map(h => this.renderHealthCard(h)).join('')}
        </div>

        <!-- Legend -->
        <div class="card" style="margin-top: 24px;">
          <div class="card-body" style="display: flex; flex-wrap: wrap; gap: 24px; align-items: center;">
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
              <span style="display: flex; align-items: center; gap: 8px;"><span class="status-dot healthy"></span>Sehat</span>
              <span style="display: flex; align-items: center; gap: 8px;"><span class="status-dot degraded"></span>Degradasi</span>
              <span style="display: flex; align-items: center; gap: 8px;"><span class="status-dot down"></span>Mati</span>
              <span style="display: flex; align-items: center; gap: 8px;"><span class="status-dot unknown"></span>Tidak Diketahui</span>
            </div>
            <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: var(--color-text-muted);">
              <span>Hijau: Semua endpoint sehat</span>
              <span>Kuning: Beberapa endpoint bermasalah</span>
              <span>Merah: Semua endpoint gagal</span>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('refreshHealth')?.addEventListener('click', () => this.refreshHealth());
    document.getElementById('healthFilterClass')?.addEventListener('change', () => this.filterHealth());
  }

  getMockHealthData() {
    return [
      { target: 'model:gemini-3.8', class: 'model', vendor: 'google', entries: 3, healthy: 2, degraded: 1, down: 0, status: 'healthy' },
      { target: 'model:gpt-4o', class: 'model', vendor: 'openrouter', entries: 2, healthy: 2, degraded: 0, down: 0, status: 'healthy' },
      { target: 'model:claude-3.5-sonnet', class: 'model', vendor: 'anthropic', entries: 1, healthy: 0, degraded: 1, down: 0, status: 'degraded' },
      { target: 'vendor:pdf.compress', class: 'vendor', vendor: 'ilovepdf', entries: 2, healthy: 1, degraded: 0, down: 1, status: 'degraded' },
      { target: 'vendor:pdf.optimize', class: 'vendor', vendor: 'ilovepdf', entries: 1, healthy: 1, degraded: 0, down: 0, status: 'healthy' },
      { target: 'scrape:web.search', class: 'scrape', vendor: 'vendor_s', entries: 2, healthy: 1, degraded: 1, down: 0, status: 'degraded' },
      { target: 'scrape:web.page', class: 'scrape', vendor: 'vendor_s', entries: 2, healthy: 0, degraded: 0, down: 2, status: 'down' }
    ];
  }

  renderHealthCard(h) {
    const statusClass = h.status === 'healthy' ? 'healthy' : h.status === 'degraded' ? 'degraded' : h.status === 'down' ? 'down' : 'unknown';
    const total = h.healthy + h.degraded + h.down;
    const healthyPct = total > 0 ? Math.round((h.healthy / total) * 100) : 0;

    return `
      <div class="health-card" data-class="${h.class}" data-target="${h.target}">
        <div class="health-card-header">
          <span class="health-card-name">${h.target}</span>
          <span class="health-card-status">
            <span class="status-dot ${h.status}"></span>
            ${h.status === 'healthy' ? 'Sehat' : h.status === 'degraded' ? 'Degradasi' : h.status === 'down' ? 'Mati' : 'Tidak Diketahui'}
          </span>
        </div>
        <div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 12px;">${h.class} • ${h.vendor} • ${h.entries} entry</div>
        <div class="health-card-metrics">
          <div class="health-metric">
            <span class="health-metric-label">${this.i18n.t('admin.healthy')}</span>
            <span class="health-metric-value" style="color: var(--color-success);">${h.healthy}/${h.entries}</span>
          </div>
          <div class="health-metric">
            <span class="health-metric-label">${this.i18n.t('admin.degraded')}</span>
            <span class="health-metric-value" style="color: var(--color-warning);">${h.degraded}</span>
          </div>
          <div class="health-metric">
            <span class="health-metric-label">${this.i18n.t('admin.down')}</span>
            <span class="health-metric-value" style="color: var(--color-error);">${h.down}</span>
          </div>
          <div class="health-metric">
            <span class="health-metric-label">${this.i18n.t('admin.healthy_pct')}</span>
            <span class="health-metric-value">${healthyPct}%</span>
          </div>
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px;">
          <button class="btn btn-ghost btn-sm" data-action="disable-target" data-target="${h.target}">${this.i18n.t('admin.disable')}</button>
          <button class="btn btn-ghost btn-sm" data-action="enable-target" data-target="${h.target}">${this.i18n.t('admin.enable')}</button>
          <button class="btn btn-ghost btn-sm" data-action="test-target" data-target="${h.target}">${this.i18n.t('admin.test')}</button>
        </div>
      </div>
    `;
  }

  filterHealth() {
    const filter = document.getElementById('healthFilterClass')?.value || 'all';
    document.querySelectorAll('#healthGrid .health-card').forEach(card => {
      const cls = card.dataset.class;
      card.style.display = filter === 'all' || cls === filter ? '' : 'none';
    });
  }

  refreshHealth() {
    this.ui.toast(this.i18n.t('admin.refreshing'), 'info');
    // In production: call health check API
    setTimeout(() => {
      this.ui.toast(this.i18n.t('admin.refresh_complete'), 'success');
    }, 1000);
  }
}