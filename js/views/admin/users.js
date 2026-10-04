/**
 * Black Flow - Admin Users & Plans
 */

export class AdminUsers {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('adminContent');
    if (!content) return;

    const users = this.getMockUsers();

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1400px; margin: 0 auto;">
        <h1 style="margin: 0 0 24px;">${this.i18n.t('admin.users_plans')}</h1>

        <div class="card">
          <div class="card-body" style="padding: 0;">
            <div style="overflow-x: auto;">
              <table class="table" style="font-size: 13px;">
                <thead>
                  <tr>
                    <th>${this.i18n.t('admin.user_role')}</th>
                    <th>${this.i18n.t('auth.email')}</th>
                    <th>${this.i18n.t('admin.user_plan')}</th>
                    <th>${this.i18n.t('admin.user_status')}</th>
                    <th>${this.i18n.t('admin.user_created')}</th>
                    <th style="width: 150px;">${this.i18n.t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${users.map(u => `
                    <tr>
                      <td><span class="badge badge-${u.role === 'owner' ? 'warning' : u.role === 'admin' ? 'error' : 'neutral'}">${u.role}</span></td>
                      <td>${this.ui.escapeHtml(u.email)}</td>
                      <td><span class="plan-badge plan-${u.plan_id}">${u.plan_id}</span></td>
                      <td><span class="badge badge-${u.status === 'active' ? 'success' : 'neutral'}">${u.status}</span></td>
                      <td>${this.ui.formatDate(u.created_at)}</td>
                      <td>
                        <button class="btn btn-ghost btn-sm" data-action="edit-user" data-id="${u.id}">${this.i18n.t('common.edit')}</button>
                        <button class="btn btn-ghost btn-sm" data-action="view-logs" data-id="${u.id}">${this.i18n.t('admin.view_logs')}</button>
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

    document.querySelectorAll('[data-action="edit-user"]').forEach(btn => {
      btn.addEventListener('click', () => this.editUser(btn.dataset.id));
    });
  }

  getMockUsers() {
    return [
      { id: '1', email: 'owner@blackflow.example', role: 'owner', plan_id: 'team', status: 'active', created_at: '2024-01-15' },
      { id: '2', email: 'admin@blackflow.example', role: 'admin', plan_id: 'pro', status: 'active', created_at: '2024-02-20' },
      { id: '3', email: 'user1@example.com', role: 'user', plan_id: 'free', status: 'active', created_at: '2024-03-10' },
      { id: '4', email: 'user2@example.com', role: 'user', plan_id: 'pro', status: 'active', created_at: '2024-03-25' },
      { id: '5', email: 'user3@example.com', role: 'user', plan_id: 'free', status: 'past_due', created_at: '2024-04-01' }
    ];
  }

  editUser(userId) {
    this.ui.toast(`Edit user ${userId} - coming soon`, 'info');
  }
}