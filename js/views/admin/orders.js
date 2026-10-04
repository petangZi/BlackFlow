/**
 * Black Flow - Admin Orders
 */

export class AdminOrders {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('adminContent');
    if (!content) return;

    const orders = this.getMockOrders();

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1400px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <h1 style="margin: 0;">${this.i18n.t('admin.orders')}</h1>
          <div style="display: flex; gap: 12px;">
            <select class="input select" id="orderFilterStatus" style="min-width: 150px;">
              <option value="all">${this.i18n.t('common.all')}</option>
              <option value="pending">${this.i18n.t('dashboard.payment_pending')}</option>
              <option value="paid">${this.i18n.t('dashboard.payment_paid')}</option>
              <option value="expired">${this.i18n.t('dashboard.payment_expired')}</option>
              <option value="rejected">${this.i18n.t('admin.rejected')}</option>
              <option value="needs_review">${this.i18n.t('admin.needs_review')}</option>
            </select>
            <button class="btn btn-secondary" id="exportOrders">${this.i18n.t('admin.export_csv')}</button>
          </div>
        </div>

        <div class="card">
          <div class="card-body" style="padding: 0;">
            <div id="ordersList">
              ${orders.map(o => this.renderOrderCard(o)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('orderFilterStatus')?.addEventListener('change', () => this.filterOrders());
    document.getElementById('exportOrders')?.addEventListener('click', () => this.exportCSV());
  }

  getMockOrders() {
    return [
      { id: 'BF-240115-A1B2', user_id: '3', user_email: 'user1@example.com', plan_id: 'pro', period: 'monthly', price_idr: 100000, unique_code: 123, total_idr: 100123, status: 'paid', method: 'transfer', proof_path: 'proofs/abc123.jpg', note: 'Paid via BCA', confirmed_by: '1', confirmed_at: '2024-01-16T10:30:00Z', expires_at: '2024-01-16T10:30:00Z', created_at: '2024-01-15T14:22:00Z' },
      { id: 'BF-240116-C3D4', user_id: '4', user_email: 'user2@example.com', plan_id: 'pro', period: 'yearly', price_idr: 1000000, unique_code: 456, total_idr: 1000456, status: 'pending', method: null, proof_path: null, note: null, confirmed_by: null, confirmed_at: null, expires_at: '2024-01-17T14:22:00Z', created_at: '2024-01-16T14:22:00Z' },
      { id: 'BF-240116-E5F6', user_id: '5', user_email: 'user3@example.com', plan_id: 'team', period: 'monthly', price_idr: 300000, unique_code: 789, total_idr: 300789, status: 'expired', method: null, proof_path: null, note: null, confirmed_by: null, confirmed_at: null, expires_at: '2024-01-16T14:22:00Z', created_at: '2024-01-15T14:22:00Z' }
    ];
  }

  renderOrderCard(o) {
    const statusLabels = {
      pending: this.i18n.t('dashboard.payment_pending'),
      paid: this.i18n.t('dashboard.payment_paid'),
      expired: this.i18n.t('dashboard.payment_expired'),
      rejected: this.i18n.t('admin.rejected'),
      needs_review: this.i18n.t('admin.needs_review')
    };
    const statusColors = {
      pending: 'warning',
      paid: 'success',
      expired: 'neutral',
      rejected: 'error',
      needs_review: 'info'
    };

    return `
      <div class="order-card">
        <div class="order-card-header">
          <span class="order-card-id">${o.id}</span>
          <span class="order-card-status ${o.status}">${statusLabels[o.status] || o.status}</span>
        </div>
        <div class="order-card-details">
          <div class="order-detail">
            <span class="order-detail-label">${this.i18n.t('auth.email')}</span>
            <span class="order-detail-value">${this.ui.escapeHtml(o.user_email)}</span>
          </div>
          <div class="order-detail">
            <span class="order-detail-label">${this.i18n.t('admin.user_plan')}</span>
            <span class="order-detail-value"><span class="plan-badge plan-${o.plan_id}">${o.plan_id} (${o.period})</span></span>
          </div>
          <div class="order-detail">
            <span class="order-detail-label">${this.i18n.t('dashboard.order_amount')}</span>
            <span class="order-detail-value">Rp ${o.total_idr.toLocaleString('id-ID')}</span>
          </div>
          <div class="order-detail">
            <span class="order-detail-label">${this.i18n.t('dashboard.order_date')}</span>
            <span class="order-detail-value">${this.ui.formatDate(o.created_at)}</span>
          </div>
        </div>
        <div class="order-card-actions">
          ${o.status === 'pending' ? `
            <button class="btn btn-primary btn-sm" data-action="confirm-order" data-id="${o.id}">${this.i18n.t('admin.confirm_order')}</button>
            <button class="btn btn-secondary btn-sm" data-action="reject-order" data-id="${o.id}">${this.i18n.t('admin.reject_order')}</button>
            <button class="btn btn-ghost btn-sm" data-action="review-order" data-id="${o.id}">${this.i18n.t('admin.needs_review')}</button>
            <button class="btn btn-ghost btn-sm" data-action="copy-wa" data-id="${o.id}">${this.i18n.t('admin.copy_whatsapp_reply')}</button>
          ` : o.status === 'paid' ? `
            <button class="btn btn-secondary btn-sm" data-action="refund-order" data-id="${o.id}">${this.i18n.t('admin.refund_order')}</button>
            <button class="btn btn-ghost btn-sm" data-action="view-proof" data-id="${o.id}">${this.i18n.t('admin.view_proof')}</button>
          ` : `
            <button class="btn btn-ghost btn-sm" data-action="view-proof" data-id="${o.id}">${this.i18n.t('admin.view_proof')}</button>
          `}
        </div>
      </div>
    `;
  }

  filterOrders() {
    const filter = document.getElementById('orderFilterStatus')?.value || 'all';
    document.querySelectorAll('.order-card').forEach(card => {
      const status = card.querySelector('.order-card-status')?.classList[1];
      card.style.display = filter === 'all' || status === filter ? '' : 'none';
    });
  }

  exportCSV() {
    this.ui.toast(this.i18n.t('admin.export_csv') + ' downloaded', 'success');
  }
}