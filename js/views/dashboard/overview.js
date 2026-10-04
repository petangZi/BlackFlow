/**
 * Black Flow - Dashboard Overview
 */

export class Overview {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('dashboardContent');
    if (!content) return;

    const stats = await this.fetchStats();
    const recentActivity = await this.fetchRecentActivity();

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1200px; margin: 0 auto;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="margin: 0 0 4px;">${this.i18n.t('dashboard.overview')}</h1>
            <p style="margin: 0; color: var(--color-text-muted);">${this.i18n.t('common.app_tagline')}</p>
          </div>
          <div style="display: flex; gap: 12px;">
            <span class="plan-badge plan-${this.store.profile?.plan_id || 'free'}">${this.store.profile?.plan_id || 'free'}</span>
          </div>
        </div>

        <!-- Stats Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
          <div class="card">
            <div class="card-body">
              <div style="font-size: 12px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">${this.i18n.t('dashboard.total_messages')}</div>
              <div style="font-size: 32px; font-weight: 600; color: var(--color-text-primary);">${stats.totalMessages.toLocaleString()}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <div style="font-size: 12px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">${this.i18n.t('dashboard.total_tokens')}</div>
              <div style="font-size: 32px; font-weight: 600; color: var(--color-text-primary);">${stats.totalTokens.toLocaleString()}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <div style="font-size: 12px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">${this.i18n.t('dashboard.total_cost')}</div>
              <div style="font-size: 32px; font-weight: 600; color: var(--color-text-primary);">Rp ${stats.totalCost.toLocaleString('id-ID')}</div>
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <div style="font-size: 12px; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">${this.i18n.t('dashboard.success_rate')}</div>
              <div style="font-size: 32px; font-weight: 600; color: var(--color-success);">${stats.successRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        <!-- Quota Usage -->
        <div class="card" style="margin-bottom: 32px;">
          <div class="card-header">
            <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('dashboard.quota_usage')}</h3>
          </div>
          <div class="card-body">
            <div style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>${this.i18n.t('dashboard.daily_limit')}</span>
                <span>${stats.usedToday}/${stats.dailyLimit}</span>
              </div>
              <div class="progress">
                <div class="progress-bar" style="width: ${Math.min(100, (stats.usedToday / stats.dailyLimit) * 100)}%; background: ${stats.usedToday >= stats.dailyLimit * 0.8 ? 'var(--color-warning)' : 'var(--color-accent)'};"></div>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; font-size: 13px; color: var(--color-text-secondary);">
              <div><strong>${this.i18n.t('dashboard.total_tokens')}</strong> ${stats.tokensToday.toLocaleString()}</div>
              <div><strong>${this.i18n.t('dashboard.tool_calls')}</strong> ${stats.toolCallsToday}</div>
            </div>
          </div>
        </div>

        <!-- Top Models & Recent Activity -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <!-- Top Models -->
          <div class="card">
            <div class="card-header">
              <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('dashboard.top_models')}</h3>
            </div>
            <div class="card-body" style="padding: 0;">
              ${stats.topModels.length > 0 ? `
                <ul style="list-style: none; padding: 0; margin: 0;">
                  ${stats.topModels.slice(0, 5).map((m, i) => `
                    <li style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--color-divider);">
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 13px; color: var(--color-text-muted);">${i + 1}.</span>
                        <span style="font-weight: 500;">${this.ui.escapeHtml(m.title)}</span>
                      </div>
                      <span style="font-size: 12px; color: var(--color-text-muted);">${m.count} ${this.i18n.t('chat.prompt_suggestions') || 'requests'}</span>
                    </li>
                  `).join('')}
                </ul>
              ` : `
                <div class="empty-state" style="padding: 32px;">
                  <p style="margin: 0;">${this.i18n.t('dashboard.no_data')}</p>
                </div>
              `}
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="card">
            <div class="card-header">
              <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('dashboard.recent_activity')}</h3>
            </div>
            <div class="card-body" style="padding: 0;">
              ${recentActivity.length > 0 ? `
                <ul style="list-style: none; padding: 0; margin: 0;">
                  ${recentActivity.slice(0, 10).map(a => `
                    <li style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--color-divider);">
                      <div class="status-dot ${a.status}"></div>
                      <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.ui.escapeHtml(a.title)}</div>
                        <div style="font-size: 12px; color: var(--color-text-muted);">${this.ui.formatRelativeTime(a.timestamp)}</div>
                      </div>
                      <span class="badge badge-${a.type}">${a.type}</span>
                    </li>
                  `).join('')}
                </ul>
              ` : `
                <div class="empty-state" style="padding: 32px;">
                  <p style="margin: 0;">${this.i18n.t('dashboard.no_recent_activity')}</p>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async fetchStats() {
    // In production, fetch from API
    return {
      totalMessages: 1247,
      totalTokens: 456789,
      totalCost: 125000,
      successRate: 99.2,
      usedToday: 23,
      dailyLimit: 30,
      tokensToday: 45678,
      toolCallsToday: 12,
      topModels: [
        { title: 'Gemini 3.8', count: 456 },
        { title: 'GPT-4o', count: 312 },
        { title: 'Claude 3.5 Sonnet', count: 289 },
        { title: 'Llama 3.3 70B', count: 190 }
      ]
    };
  }

  async fetchRecentActivity() {
    return [
      { title: 'Chat: "Explain quantum computing"', status: 'healthy', type: 'model', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { title: 'Tool: PDF Compress (iLovePDF)', status: 'healthy', type: 'vendor', timestamp: new Date(Date.now() - 7200000).toISOString() },
      { title: 'Web Search: "Latest AI news"', status: 'healthy', type: 'scrape', timestamp: new Date(Date.now() - 10800000).toISOString() },
      { title: 'Chat: "Write Python script"', status: 'healthy', type: 'model', timestamp: new Date(Date.now() - 86400000).toISOString() }
    ];
  }
}