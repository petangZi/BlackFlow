/**
 * Black Flow - Dashboard Models
 */

export class Models {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
  }

  async render() {
    const content = document.getElementById('dashboardContent');
    if (!content) return;

    const models = await this.fetchModels();

    content.innerHTML = `
      <div style="padding: 24px; max-width: 1200px; margin: 0 auto;">
        <h1 style="margin: 0 0 24px;">${this.i18n.t('dashboard.models_catalog')}</h1>

        <!-- Filters -->
        <div class="card" style="margin-bottom: 24px;">
          <div class="card-body" style="padding: 16px;">
            <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: end;">
              <div style="flex: 1; min-width: 200px;">
                <input type="text" class="input" id="modelSearch" placeholder="${this.i18n.t('common.search')} models...">
              </div>
              <div style="min-width: 150px;">
                <select class="input select" id="modelFilterClass">
                  <option value="all">${this.i18n.t('common.all')}</option>
                  <option value="model">Model</option>
                  <option value="vendor">Vendor Tool</option>
                  <option value="scrape">Scrape</option>
                </select>
              </div>
              <div style="min-width: 150px;">
                <select class="input select" id="modelFilterPlan">
                  <option value="all">${this.i18n.t('common.all')} Plans</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="team">Team</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Models Grid -->
        <div class="card">
          <div class="card-body" style="padding: 0;">
            <div style="overflow-x: auto;">
              <table class="table" style="font-size: 13px;">
                <thead>
                  <tr>
                    <th style="width: 40px;"></th>
                    <th>${this.i18n.t('dashboard.target_id') || 'ID'}</th>
                    <th>${this.i18n.t('dashboard.target_class') || 'Class'}</th>
                    <th>${this.i18n.t('dashboard.plan')}</th>
                    <th>${this.i18n.t('dashboard.features')}</th>
                    <th>${this.i18n.t('dashboard.context')}</th>
                    <th>${this.i18n.t('dashboard.max_output')}</th>
                    <th>${this.i18n.t('dashboard.status')}</th>
                    <th style="width: 120px;">${this.i18n.t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody id="modelsTableBody">
                  ${models.map(m => this.renderModelRow(m)).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind filters
    this.bindFilters();
  }

  async fetchModels() {
    // Mock data
    return [
      { id: 'model:gemini-3.8', title: 'Gemini 3.8', class: 'model', plan_tier: 'free', features: ['vision', 'tools', 'reasoning'], context: 2000000, max_output: 8192, status: 'active', favorite: true },
      { id: 'model:gpt-4o', title: 'GPT-4o', class: 'model', plan_tier: 'pro', features: ['vision', 'tools', 'reasoning'], context: 128000, max_output: 4096, status: 'active', favorite: false },
      { id: 'model:claude-3.5-sonnet', title: 'Claude 3.5 Sonnet', class: 'model', plan_tier: 'pro', features: ['vision', 'tools', 'reasoning'], context: 200000, max_output: 8192, status: 'active', favorite: true },
      { id: 'vendor:pdf.compress', title: 'PDF Compress', class: 'vendor', plan_tier: 'free', features: ['compress'], context: 0, max_output: 0, status: 'active', favorite: false },
      { id: 'scrape:web.search', title: 'Web Search', class: 'scrape', plan_tier: 'free', features: ['search'], context: 0, max_output: 0, status: 'active', favorite: false }
    ];
  }

  renderModelRow(m) {
    const canAccess = this.canAccessModel(m);
    return `
      <tr data-id="${m.id}" ${!canAccess ? 'style="opacity: 0.5;"' : ''}>
        <td>
          ${m.favorite ? '<button class="btn btn-ghost btn-sm" data-action="unfavorite" data-id="${m.id}" title="Remove from favorites"><svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-warning)" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>' : '<button class="btn btn-ghost btn-sm" data-action="favorite" data-id="${m.id}" title="Add to favorites"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>'}
        </td>
        <td><code style="font-size: 12px;">${m.id}</code></td>
        <td><span class="badge badge-${m.class === 'model' ? 'primary' : m.class === 'vendor' ? 'success' : 'info'}">${m.class}</span></td>
        <td><span class="plan-badge plan-${m.plan_tier}">${m.plan_tier}</span></td>
        <td>${m.features.map(f => `<span class="badge badge-neutral" style="font-size: 11px;">${f}</span>`).join(' ')}</td>
        <td>${m.context > 0 ? m.context.toLocaleString() : '-'}</td>
        <td>${m.max_output > 0 ? m.max_output.toLocaleString() : '-'}</td>
        <td><span class="badge badge-${m.status === 'active' ? 'success' : 'neutral'}">${m.status}</span></td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-ghost btn-sm" data-action="set-default" data-id="${m.id}" title="Set as default" ${!canAccess ? 'disabled' : ''}>${this.i18n.t('dashboard.model_default')}</button>
          </div>
        </td>
      </tr>
    `;
  }

  canAccessModel(model) {
    if (!this.store.profile) return false;
    const tiers = { free: 0, pro: 1, team: 2 };
    return tiers[this.store.profile.plan_id] >= tiers[model.plan_tier];
  }

  bindFilters() {
    const search = document.getElementById('modelSearch');
    const filterClass = document.getElementById('modelFilterClass');
    const filterPlan = document.getElementById('modelFilterPlan');

    const filter = () => {
      const searchTerm = search?.value.toLowerCase() || '';
      const classFilter = filterClass?.value || 'all';
      const planFilter = filterPlan?.value || 'all';

      document.querySelectorAll('#modelsTableBody tr').forEach(row => {
        const id = row.dataset.id.toLowerCase();
        const rowClass = row.cells[2].textContent.trim().toLowerCase();
        const rowPlan = row.cells[3].textContent.trim().toLowerCase();

        const matchSearch = id.includes(searchTerm);
        const matchClass = classFilter === 'all' || rowClass === classFilter;
        const matchPlan = planFilter === 'all' || rowPlan === planFilter;

        row.style.display = matchSearch && matchClass && matchPlan ? '' : 'none';
      });
    };

    search?.addEventListener('input', filter);
    filterClass?.addEventListener('change', filter);
    filterPlan?.addEventListener('change', filter);
  }
}