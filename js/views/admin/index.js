/**
 * Black Flow - Admin Index
 */

import { AdminPool } from './pool.js';
import { AdminHealth } from './health.js';
import { AdminUsers } from './users.js';
import { AdminOrders } from './orders.js';
import { AdminFlags } from './flags.js';
import { AdminAudit } from './audit.js';
import { AdminAnnouncements } from './announcements.js';

export class Admin {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
    this.views = {
      'admin-pool': new AdminPool(store, ui, i18n),
      'admin-health': new AdminHealth(store, ui, i18n),
      'admin-users': new AdminUsers(store, ui, i18n),
      'admin-orders': new AdminOrders(store, ui, i18n),
      'admin-flags': new AdminFlags(store, ui, i18n),
      'admin-audit': new AdminAudit(store, ui, i18n),
      'admin-announcements': new AdminAnnouncements(store, ui, i18n)
    };
  }

  async render(view, params) {
    const content = document.getElementById('adminContent');
    if (!content) return;

    const adminView = this.views[view];
    if (adminView) {
      await adminView.render(params);
    } else {
      content.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px;">
          <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/></svg></div>
          <h3 class="empty-state-title">${this.i18n.t('admin.api_pool')}</h3>
          <p class="empty-state-text">Admin view not implemented: ${view}</p>
        </div>
      `;
    }
  }
}