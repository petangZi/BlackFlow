/**
 * Black Flow - Admin Announcements
 */

export class AdminAnnouncements {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('adminContent');
    if (!content) return;

    const announcements = this.getMockAnnouncements();

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1000px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <h1 style="margin: 0;">${this.i18n.t('admin.announcements')}</h1>
          <button class="btn btn-primary" id="createAnnouncementBtn">${this.i18n.t('admin.create_announcement')}</button>
        </div>

        <div class="card">
          <div class="card-body" style="padding: 0;">
            <div style="display: flex; flex-direction: column; gap: 16px; padding: 16px;">
              ${announcements.map(a => this.renderAnnouncement(a)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('createAnnouncementBtn')?.addEventListener('click', () => this.showCreateModal());
  }

  getMockAnnouncements() {
    return [
      { id: '1', title: 'Selamat datang di Black Flow v1.0!', body: 'Black Flow sekarang live dengan fitur multi-model, failover otomatis, dan API registry. Baca <a href="#/docs/changelog">changelog</a> untuk detail lengkap.', severity: 'info', target_roles: [], starts_at: new Date(Date.now() - 86400000).toISOString(), ends_at: null },
      { id: '2', title: 'Pemeliharaan terjadwal', body: 'Akan ada pemeliharaan sistem pada 15 Januari 2024 pukul 02:00-04:00 WIB. Layanan mungkin mengalami gangguan singkat.', severity: 'warning', target_roles: [], starts_at: new Date(Date.now() - 172800000).toISOString(), ends_at: new Date(Date.now() + 86400000).toISOString() },
      { id: '3', title: 'Model Gemini 3.8 tidak tersedia sementara', body: 'Endpoint Google mengalami degradasi. Failover ke model lain aktif. ETA perbaikan 2 jam.', severity: 'critical', target_roles: [], starts_at: new Date(Date.now() - 3600000).toISOString(), ends_at: new Date(Date.now() + 7200000).toISOString() }
    ];
  }

  renderAnnouncement(a) {
    const severityColors = { info: 'info', warning: 'warning', critical: 'error' };
    const severityLabels = { info: 'Info', warning: 'Peringatan', critical: 'Kritis' };
    const isActive = new Date(a.starts_at) <= new Date() && (!a.ends_at || new Date(a.ends_at) > new Date());

    return `
      <div style="border: 1px solid var(--color-border); border-radius: 12px; padding: 16px; background: var(--color-surface);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px;">
              <h3 style="margin: 0; font-size: 16px;">${this.ui.escapeHtml(a.title)}</h3>
              <span class="badge badge-${severityColors[a.severity]}">${severityLabels[a.severity]}</span>
              <span class="badge badge-${isActive ? 'success' : 'neutral'}">${isActive ? 'Aktif' : 'Tidak Aktif'}</span>
            </div>
            <div style="font-size: 13px; color: var(--color-text-muted);">Mulai: ${this.ui.formatDate(a.starts_at)} ${a.ends_at ? '• Berakhir: ' + this.ui.formatDate(a.ends_at) : ''}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-ghost btn-sm" data-action="edit-announcement" data-id="${a.id}">${this.i18n.t('common.edit')}</button>
            <button class="btn btn-ghost btn-sm" data-action="delete-announcement" data-id="${a.id}">${this.i18n.t('common.delete')}</button>
          </div>
        </div>
        <div style="font-size: 14px; line-height: 1.6; color: var(--color-text-secondary);">${a.body}</div>
      </div>
    `;
  }

  showCreateModal() {
    const modal = this.ui.showModal(`
      <form id="createAnnouncementForm">
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('admin.announcement_title')}</label>
          <input type="text" name="title" class="input" required placeholder="Judul pengumuman">
        </div>
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('admin.announcement_body')}</label>
          <textarea name="body" class="textarea" rows="6" required placeholder="Isi pengumuman (HTML didukung)"></textarea>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('admin.announcement_severity')}</label>
          <select name="severity" class="input select" required>
            <option value="info">${this.i18n.t('common.info')}</option>
            <option value="warning">${this.i18n.t('common.warning')}</option>
            <option value="critical">${this.i18n.t('common.critical')}</option>
          </select>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('admin.announcement_roles')}</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
            ${['user', 'admin', 'owner'].map(r => `
              <label class="checkbox-wrapper">
                <input type="checkbox" name="roles" value="${r}" />
                <span class="checkbox-custom"></span>
                <span class="checkbox-label">${r}</span>
              </label>
            `).join('')}
          </div>
          <p class="helper-text">Kosongkan untuk semua role</p>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('admin.starts_at')}</label>
          <input type="datetime-local" name="starts_at" class="input" required>
        </div>
        <div style="margin-bottom: 16px;">
          <label class="label">${this.i18n.t('admin.ends_at')}</label>
          <input type="datetime-local" name="ends_at" class="input">
          <p class="helper-text">Kosongkan untuk tidak berakhir</p>
        </div>
      </form>
    `, {
      title: this.i18n.t('admin.create_announcement'),
      footer: `<button class="btn btn-secondary" id="cancelAnnouncement">${this.i18n.t('common.cancel')}</button><button class="btn btn-primary" id="confirmAnnouncement">${this.i18n.t('common.create')}</button>`
    });

    document.getElementById('cancelAnnouncement')?.addEventListener('click', () => modal.close());
    document.getElementById('confirmAnnouncement')?.addEventListener('click', () => this.createAnnouncement(modal));
  }

  createAnnouncement(modal) {
    this.ui.toast(this.i18n.t('admin.announcement_created'), 'success');
    modal.close();
  }
}