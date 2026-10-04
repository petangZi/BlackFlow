/**
 * Black Flow - UI Utilities
 * DOM manipulation, toasts, modals, sidebar, theme
 */

import { i18n } from './i18n.js';

export class UI {
  constructor(store) {
    this.store = store;
    this.toastContainer = null;
    this.modalStack = [];
    this.init();
  }

  init() {
    this.createToastContainer();
    this.bindGlobalEvents();
    this.applyTheme(this.store.get('theme') || 'dark');
    this.applyLocale(this.store.get('locale') || 'id');
  }

  createToastContainer() {
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'toast-container';
    this.toastContainer.setAttribute('role', 'region');
    this.toastContainer.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(this.toastContainer);
  }

  bindGlobalEvents() {
    // Sidebar toggle
    const sbToggle = document.getElementById('sbToggle');
    const sbClose = document.getElementById('sbClose');
    const menuBtn = document.getElementById('menuBtn');
    const backdrop = document.getElementById('backdrop');
    const sidebar = document.getElementById('sidebar');

    if (sbToggle) sbToggle.addEventListener('click', () => this.toggleSidebar());
    if (sbClose) sbClose.addEventListener('click', () => this.closeSidebar());
    if (menuBtn) menuBtn.addEventListener('click', () => this.openSidebar());
    if (backdrop) backdrop.addEventListener('click', () => this.closeSidebar());

    // Theme toggle
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', () => this.toggleTheme());

    // New chat buttons
    const sbNew = document.getElementById('sbNew');
    const newChatBtn = document.getElementById('newChatBtn');
    if (sbNew) sbNew.addEventListener('click', () => window.blackflow?.newChat());
    if (newChatBtn) newChatBtn.addEventListener('click', () => window.blackflow?.newChat());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.focusComposer();
      }
      if (e.key === 'Escape') {
        this.closeSidebar();
        this.closeAllModals();
      }
    });

    // Resize handler
    let lastMobile = this.isMobile();
    window.addEventListener('resize', () => {
      const now = this.isMobile();
      if (now !== lastMobile) {
        lastMobile = now;
        if (!now) this.closeSidebar();
        else sidebar?.classList.remove('collapsed');
      }
    });
  }

  isMobile() {
    return window.matchMedia('(max-width: 767px)').matches;
  }

  // ============ THEME ============
  applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
      themeIcon.innerHTML = theme === 'dark'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
    }
    document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#0A0A0B' : '#FAFAFA');
    localStorage.setItem('theme', theme);
    this.store.set('theme', theme);
  }

  toggleTheme() {
    const current = this.store.get('theme') || 'dark';
    this.applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // ============ LOCALE ============
  applyLocale(locale) {
    document.documentElement.lang = locale;
    localStorage.setItem('locale', locale);
    this.store.set('locale', locale);
    this.translatePage();
  }

  setLocale(locale) {
    this.applyLocale(locale);
  }

  translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = i18n.t(key);
      if (translation) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = translation;
        } else {
          el.textContent = translation;
        }
      }
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.title = i18n.t(key);
    });
  }

  // ============ SIDEBAR ============
  openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('backdrop');
    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('show');
    this.store.set('sidebarOpen', true);
    document.body.style.overflow = 'hidden';
  }

  closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('show');
    this.store.set('sidebarOpen', false);
    document.body.style.overflow = '';
  }

  toggleSidebar() {
    if (this.store.get('sidebarOpen')) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  toggleSidebarCollapsed() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
      this.store.set('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    }
  }

  updateSidebarActive(view) {
    document.querySelectorAll('.sb-item[data-view], .sb-chat').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-view') === view);
    });
  }

  // ============ TOASTS ============
  toast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span>${this.escapeHtml(message)}</span>
    `;

    this.toastContainer.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.animation = 'slideUp 0.3s ease-out';
    });

    // Auto remove
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.2s ease-in forwards';
      setTimeout(() => toast.remove(), 200);
    }, duration);

    return toast;
  }

  // ============ MODALS ============
  showModal(content, options = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${options.title ? 'modal-title' : ''}">
        ${options.title ? `<div class="modal-header"><h3 id="modal-title" class="modal-title">${this.escapeHtml(options.title)}</h3><button class="modal-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>` : ''}
        <div class="modal-body">${content}</div>
        ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
      </div>
    `;

    const modal = overlay.querySelector('.modal');
    const closeBtn = overlay.querySelector('.modal-close');

    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
      this.modalStack = this.modalStack.filter(m => m !== overlay);
    };

    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    document.body.appendChild(overlay);
    this.modalStack.push(overlay);

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('open'));

    // Focus trap
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();

    return { close, overlay, modal };
  }

  closeAllModals() {
    this.modalStack.forEach(m => m.classList.remove('open'));
    setTimeout(() => {
      this.modalStack.forEach(m => m.remove());
      this.modalStack = [];
    }, 200);
  }

  // ============ COMPOSER ============
  focusComposer() {
    const textarea = document.querySelector('.composer textarea');
    if (textarea) textarea.focus();
  }

  // ============ CLIPBOARD ============
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.toast(i18n.t('common.copied'), 'success');
    } catch {
      this.toast(i18n.t('error.copy_failed'), 'error');
    }
  }

  // ============ UTILS ============
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return i18n.t('time.just_now');
    if (diff < 3600000) return i18n.t('time.minutes_ago', { n: Math.floor(diff / 60000) });
    if (diff < 86400000) return i18n.t('time.hours_ago', { n: Math.floor(diff / 3600000) });
    if (diff < 604800000) return i18n.t('time.days_ago', { n: Math.floor(diff / 86400000) });

    return d.toLocaleDateString(this.store.get('locale') || 'id', {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }

  formatRelativeTime(date) {
    return this.formatDate(date);
  }

  debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  throttle(fn, limit) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // ============ SKELETON LOADERS ============
  showSkeleton(container, count = 3, type = 'text') {
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton';
      if (type === 'text') {
        skeleton.classList.add('skeleton-text');
        skeleton.style.width = `${60 + Math.random() * 30}%`;
        skeleton.style.height = '16px';
      } else if (type === 'avatar') {
        skeleton.classList.add('skeleton-avatar');
      } else if (type === 'card') {
        skeleton.classList.add('skeleton-card');
        skeleton.style.height = '120px';
      }
      container.appendChild(skeleton);
    }
  }
}