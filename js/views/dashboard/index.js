/**
 * Black Flow - Dashboard Index
 */

import { Overview } from './overview.js';
import { UsageLogs } from './usage-logs.js';
import { APIKeys } from './api-keys.js';
import { BYOK } from './byok.js';
import { Models } from './models.js';
import { Files } from './files.js';
import { Billing } from './billing.js';
import { Settings } from './settings.js';

export class Dashboard {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
    this.views = {
      'dashboard-overview': new Overview(store, ui, i18n),
      'dashboard-usage': new UsageLogs(store, ui, i18n),
      'dashboard-keys': new APIKeys(store, ui, i18n),
      'dashboard-byok': new BYOK(store, ui, i18n),
      'dashboard-models': new Models(store, ui, i18n),
      'dashboard-files': new Files(store, ui, i18n),
      'dashboard-billing': new Billing(store, ui, i18n),
      'dashboard-settings': new Settings(store, ui, i18n)
    };
  }

  async render(view, params) {
    const content = document.getElementById('dashboardContent');
    if (!content) return;

    const dashboardView = this.views[view];
    if (dashboardView) {
      await dashboardView.render(params);
    } else {
      content.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px;">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
          </div>
          <h3 class="empty-state-title">${this.i18n.t('dashboard.overview')}</h3>
          <p class="empty-state-text">View not implemented: ${view}</p>
        </div>
      `;
    }
  }
}