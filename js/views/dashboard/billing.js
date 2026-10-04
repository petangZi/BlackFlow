/**
 * Black Flow - Dashboard Billing (WhatsApp Manual)
 */

export class Billing {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('dashboardContent');
    if (!content) return;

    const currentPlan = this.store.profile?.plan_id || 'free';
    const plans = this.getPlans();

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1000px; margin: 0 auto;">
        <h1 style="margin: 0 0 24px;">${this.i18n.t('dashboard.billing')}</h1>

        <!-- Current Plan -->
        <div class="card" style="margin-bottom: 32px; border: 2px solid var(--color-accent);">
          <div class="card-header">
            <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('dashboard.current_plan')}</h3>
          </div>
          <div class="card-body">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
              <div>
                <div style="font-size: 24px; font-weight: 600; text-transform: capitalize;">${currentPlan}</div>
                <div style="color: var(--color-text-muted); margin-top: 4px;">${this.i18n.t('dashboard.plan_' + currentPlan + '_desc') || ''}</div>
              </div>
              ${currentPlan !== 'team' ? `
                <button class="btn btn-primary" id="upgradeBtn">${this.i18n.t('dashboard.upgrade')}</button>
              ` : `
                <span class="badge badge-success" style="font-size: 14px; padding: 8px 16px;">${this.i18n.t('dashboard.max_plan')}</span>
              `}
            </div>
          </div>
        </div>

        <!-- Plans Comparison -->
        <div class="card" style="margin-bottom: 32px;">
          <div class="card-header">
            <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('dashboard.plans') || 'Available Plans'}</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; padding: 16px;">
              ${plans.map(p => this.renderPlanCard(p, currentPlan)).join('')}
            </div>
          </div>
        </div>

        <!-- Order History -->
        <div class="card">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('dashboard.orders')}</h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div id="ordersList">
              <div class="empty-state" style="padding: 40px;">
                <p style="margin: 0;">${this.i18n.t('dashboard.no_orders')}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment Info -->
        <div class="card">
          <div class="card-header">
            <h3 style="margin: 0; font-size: 16px;">${this.i18n.t('dashboard.payment_method')}</h3>
          </div>
          <div class="card-body">
            <div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--color-accent-muted); border-radius: 12px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: #25D366; display: flex; align-items: center; justify-content: center; color: white;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.48-1.653-1.816-.173-.336-.053-.372-.053-.536s.172-.398.223-.472c.099-.149.32-.973.543-1.378.223-.4.57-1.04.866-1.346.297-.297.373-.347.448-.422.15-.15.2-.2.3-.223.273-.099.67-.074 1.09.248.422.323 1.09 1.19 1.216 1.417.074.1.248.497.347 1.04.1.597.1 1.193-.025 1.693-.149.598-.524 1.143-1.07 1.496-.546.35-1.167.523-1.416.573-.248.05-.62.074-1.018.074-.125 0-.2-.025-.373-.1-.173-.05-.398-.223-.72-.522-.422-.4-.797-.94-.922-1.417-.125-.448-.15-.947-.15-1.446 0-.546.025-1.067.15-1.52.124-.448.323-.997.547-1.395.223-.398.597-.797.996-1.07.422-.297.916-.297 1.346-.173.373.124.747.423 1.047.894.297.447.472 1.02.497 1.164.05.15.1.248.025.348-.073.1-.248.05-.523-.025-.347-.1-.996-.174-1.37-.223-.523-.074-1.02-.1-1.495-.025-.573-.025-.92-.025-1.243 0-.347-.025-.547-.1-1.046-.15-.448-.472-1.12-.87-.87-.173-.173-.523-.397-.97-.472-.149-.025-.274-.025-.472-.025-.248 0-.472.025-.72.075-.248.025-.523.125-.67.274-.148.149-.248.323-.248.572 0 .398.323.947.92 1.347.573.448.747.67 1.047 1.07.298.397.547.82.82 1.242.273.423.497.82.672 1.216.173.398.248.894.173 1.216-.074.323-.323.948-.797 1.195-.473.273-1.37.273-1.647.1-.247-.1-.498-.323-.748-.522z"/></svg>
              </div>
              <div>
                <div style="font-weight: 600;">${this.i18n.t('dashboard.whatsapp_payment')}</div>
                <div style="color: var(--color-text-muted); font-size: 13px;">${this.i18n.t('dashboard.whatsapp_number')}</div>
              </div>
            </div>
            <p style="margin: 16px 0 0; font-size: 13px; color: var(--color-text-muted);">${this.i18n.t('dashboard.payment_info')}</p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('upgradeBtn')?.addEventListener('click', () => this.showUpgradeModal());
  }

  getPlans() {
    return [
      { id: 'free', name: 'Free', price: { monthly: 0, yearly: 0 }, limits: { messages_per_day: 30, tools_per_turn: 1, max_file_mb: 10 }, features: ['Basic models', 'Web search', 'File create/read', '1 concurrent'], popular: false },
      { id: 'pro', name: 'Pro', price: { monthly: 100000, yearly: 1000000 }, limits: { messages_per_day: 1000, tools_per_turn: 6, max_file_mb: 100 }, features: ['All models', 'All tools', 'Priority routing', '3 concurrent', 'API access'], popular: true },
      { id: 'team', name: 'Team', price: { monthly: 300000, yearly: 3000000 }, limits: { messages_per_day: 5000, tools_per_turn: 10, max_file_mb: 500 }, features: ['Everything in Pro', 'Workspaces', 'Shared pools', 'Admin controls', '5 concurrent', 'SLA'], popular: false }
    ];
  }

  renderPlanCard(p, currentPlan) {
    const isCurrent = p.id === currentPlan;
    const isPopular = p.popular;
    const monthly = p.price.monthly;
    const yearly = p.price.yearly;
    const monthlyPerYear = yearly / 12;

    return `
      <div class="card ${isCurrent ? 'popular' : ''}" style="${isCurrent ? 'border: 2px solid var(--color-accent);' : ''} ${isPopular ? 'position: relative;' : ''}">
        ${isPopular ? '<div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--color-warning); color: var(--color-text-inverse); padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 600;">Popular</div>' : ''}
        <div class="card-body">
          <div style="text-align: center; margin-bottom: 24px;">
            <h3 style="margin: 0 0 8px; text-transform: capitalize;">${p.name}</h3>
            <div style="font-size: 32px; font-weight: 600; color: var(--color-text-primary);">
              ${monthly > 0 ? `Rp ${monthly.toLocaleString('id-ID')}` : 'Gratis'}
              <span style="font-size: 14px; font-weight: 400; color: var(--color-text-muted);">/bulan</span>
            </div>
            ${yearly > 0 ? `<div style="font-size: 13px; color: var(--color-success); margin-top: 4px;">Rp ${yearly.toLocaleString('id-ID')}/tahun (hemat Rp ${(monthly * 12 - yearly).toLocaleString('id-ID')})</div>` : ''}
          </div>
          <ul style="list-style: none; padding: 0; margin: 0 0 24px; display: flex; flex-direction: column; gap: 10px;">
            ${Object.entries(p.limits).map(([key, value]) => `
              <li style="display: flex; justify-content: space-between; font-size: 13px;">
                <span style="color: var(--color-text-secondary);">${this.formatLimitKey(key)}</span>
                <span style="font-weight: 500;">${typeof value === 'number' ? value.toLocaleString() : value}</span>
              </li>
            `).join('')}
          </ul>
          <div style="border-top: 1px solid var(--color-divider); padding-top: 16px; margin-bottom: 16px;">
            ${p.features.map(f => `<div style="font-size: 12px; color: var(--color-text-secondary); display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>${f}</div>`).join('')}
          </div>
          <button class="btn ${isCurrent ? 'btn-secondary' : 'btn-primary'}" style="width: 100%;" ${isCurrent ? 'disabled' : ''} data-plan="${p.id}" data-period="monthly">
            ${isCurrent ? this.i18n.t('dashboard.current_plan') : `${this.i18n.t('dashboard.upgrade')} - Rp ${monthly.toLocaleString('id-ID')}/bln`}
          </button>
        </div>
      </div>
    `;
  }

  formatLimitKey(key) {
    const labels = {
      messages_per_day: 'Pesan/hari',
      tools_per_turn: 'Tools/giliran',
      max_file_mb: 'Max file (MB)'
    };
    return labels[key] || key;
  }

  showUpgradeModal() {
    this.ui.toast(this.i18n.t('dashboard.whatsapp_payment_info'), 'info');
    // In production, show plan selection modal with WhatsApp payment flow
  }
}