/**
 * Black Flow - Dashboard Files
 */

export class Files {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('dashboardContent');
    if (!content) return;

    const files = await this.fetchFiles();

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1200px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <h1 style="margin: 0;">${this.i18n.t('dashboard.files_list')}</h1>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-primary" id="uploadFileBtn">${this.i18n.t('dashboard.upload_file')}</button>
          </div>
        </div>

        <!-- Dropzone -->
        <div class="card dropzone" id="fileDropzone" style="margin-bottom: 24px;">
          <div class="dropzone-content">
            <div class="dropzone-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h3 class="dropzone-title">${this.i18n.t('dashboard.drag_drop')}</h3>
            <p class="dropzone-text">${this.i18n.t('dashboard.max_file_size', { size: '100 MB' })}</p>
            <input type="file" id="fileInput" multiple style="display: none;">
          </div>
        </div>

        <!-- Files List -->
        <div class="card">
          <div class="card-body" style="padding: 0;">
            <div id="filesList">
              ${files.length > 0 ? `
                <div class="file-list">
                  ${files.map(f => this.renderFileItem(f)).join('')}
                </div>
              ` : `
                <div class="empty-state" style="padding: 60px 20px;">
                  <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div>
                  <h3 class="empty-state-title">${this.i18n.t('dashboard.no_files')}</h3>
                  <p class="empty-state-text">${this.i18n.t('dashboard.upload_first_file')}</p>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindDropzone();
    document.getElementById('uploadFileBtn')?.addEventListener('click', () => document.getElementById('fileInput')?.click());
    document.getElementById('fileInput')?.addEventListener('change', (e) => this.handleFiles(e.target.files));
  }

  async fetchFiles() {
    // Mock data
    return [
      { id: '1', name: 'document.pdf', mime: 'application/pdf', bytes: 2048576, storage_path: 'user/123/doc.pdf', created_at: new Date(Date.now() - 86400000).toISOString(), source: 'upload' },
      { id: '2', name: 'image.png', mime: 'image/png', bytes: 512000, storage_path: 'user/123/img.png', created_at: new Date(Date.now() - 172800000).toISOString(), source: 'tool' },
      { id: '3', name: 'data.csv', mime: 'text/csv', bytes: 102400, storage_path: 'user/123/data.csv', created_at: new Date(Date.now() - 259200000).toISOString(), source: 'tool' }
    ];
  }

  renderFileItem(f) {
    const icon = this.getFileIcon(f.mime);
    return `
      <div class="file-item" data-id="${f.id}">
        <div class="file-item-icon">${icon}</div>
        <div class="file-item-info">
          <div class="file-item-name">${this.ui.escapeHtml(f.name)}</div>
          <div class="file-item-meta">${this.ui.formatBytes(f.bytes)} • ${this.ui.formatRelativeTime(f.created_at)} • ${f.source}</div>
        </div>
        <div class="file-item-actions">
          <button class="file-item-action" data-action="preview" data-id="${f.id}" title="${this.i18n.t('dashboard.preview')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="file-item-action" data-action="download" data-id="${f.id}" title="${this.i18n.t('dashboard.download')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/></svg></button>
          <button class="file-item-action" data-action="delete" data-id="${f.id}" title="${this.i18n.t('common.delete')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
      </div>
    `;
  }

  getFileIcon(mime) {
    if (mime.startsWith('image/')) return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
    if (mime === 'application/pdf') return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>';
    if (mime === 'text/csv' || mime === 'application/json') return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
    return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>';
  }

  bindDropzone() {
    const dropzone = document.getElementById('fileDropzone');
    const input = document.getElementById('fileInput');

    if (!dropzone || !input) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
      dropzone.addEventListener(event, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(event => {
      dropzone.addEventListener(event, () => dropzone.classList.add('drag-active'));
    });

    ['dragleave', 'drop'].forEach(event => {
      dropzone.addEventListener(event, () => dropzone.classList.remove('drag-active'));
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length) this.handleFiles(files);
    });

    dropzone.addEventListener('click', () => input.click());
  }

  async handleFiles(files) {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      if (file.size > 100 * 1024 * 1024) {
        this.ui.toast(`${this.ui.escapeHtml(file.name)}: ${this.i18n.t('errors.file_too_large')}`, 'error');
        continue;
      }

      // In production: upload to Supabase Storage
      this.ui.toast(`${this.ui.escapeHtml(file.name)} uploaded`, 'success');
    }
    // Refresh list
    // this.render();
  }
}