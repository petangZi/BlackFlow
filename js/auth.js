/**
 * Black Flow - Authentication Module
 */

import { signUp, signIn, signInWithOAuth, signOut, getProfile, updateProfile, onAuthStateChange } from './lib/supabase.js';

export class Auth {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
    this.currentView = 'login';
  }

  async setUser(user) {
    this.store.set('user', user);
    const profile = await getProfile(user.id);
    this.store.set('profile', profile);
    this.ui.toast(this.i18n.t('auth.login'), 'success');
  }

  async clearUser() {
    this.store.set('user', null);
    this.store.set('profile', null);
    this.store.set('conversations', []);
    this.store.set('currentConversation', null);
    this.store.set('messages', []);
  }

  async signOut() {
    await signOut();
    await this.clearUser();
    this.ui.toast(this.i18n.t('auth.logout'), 'info');
    window.location.hash = 'auth/login';
  }

  async render(view) {
    this.currentView = view.replace('auth/', '');
    const slot = document.getElementById('authSlot');
    if (!slot) return;

    switch (this.currentView) {
      case 'login':
        slot.innerHTML = this.renderLogin();
        this.bindLoginForm();
        break;
      case 'register':
        slot.innerHTML = this.renderRegister();
        this.bindRegisterForm();
        break;
      case 'reset-password':
        slot.innerHTML = this.renderResetPassword();
        this.bindResetPasswordForm();
        break;
      case 'callback':
        slot.innerHTML = this.renderCallback();
        break;
      default:
        slot.innerHTML = this.renderLogin();
        this.bindLoginForm();
    }
  }

  renderLogin() {
    return `
      <div class="card" style="max-width: 400px; margin: 0 auto;">
        <div class="card-body" style="padding: 40px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div class="avatar" style="width: 56px; height: 56px; margin: 0 auto 16px; font-size: 24px;">BF</div>
            <h1 style="margin: 0 0 8px;">${this.i18n.t('auth.login')}</h1>
            <p style="color: var(--color-text-muted); margin: 0;">${this.i18n.t('common.app_tagline')}</p>
          </div>

          <form id="loginForm" novalidate>
            <div style="margin-bottom: 20px;">
              <label class="label">${this.i18n.t('auth.email')}</label>
              <input type="email" name="email" class="input" placeholder="${this.i18n.t('auth.enter_email')}" required autocomplete="email" />
            </div>
            <div style="margin-bottom: 20px;">
              <label class="label">${this.i18n.t('auth.password')}</label>
              <input type="password" name="password" class="input" placeholder="${this.i18n.t('auth.enter_password')}" required autocomplete="current-password" />
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
              <label class="checkbox-wrapper">
                <input type="checkbox" name="remember" />
                <span class="checkbox-custom"></span>
                <span class="checkbox-label">Ingat saya</span>
              </label>
              <a href="#auth/forgot-password" style="font-size: 13px; color: var(--color-accent);">${this.i18n.t('auth.forgot_password')}</a>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; height: 44px;">${this.i18n.t('auth.login')}</button>
          </form>

          <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--color-divider);">
            <div style="display: flex; gap: 12px; justify-content: center; margin-bottom: 16px;">
              <button type="button" class="btn btn-secondary" style="flex: 1;" data-provider="google">
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google
              </button>
              <button type="button" class="btn btn-secondary" style="flex: 1;" data-provider="github">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                GitHub
              </button>
            </div>
            <p style="text-align: center; font-size: 13px; color: var(--color-text-muted);">
              ${this.i18n.t('auth.no_account')} <a href="#auth/register" style="color: var(--color-accent);">${this.i18n.t('auth.create_account')}</a>
            </p>
          </div>
        </div>
      </div>
    `;
  }

  renderRegister() {
    return `
      <div class="card" style="max-width: 400px; margin: 0 auto;">
        <div class="card-body" style="padding: 40px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div class="avatar" style="width: 56px; height: 56px; margin: 0 auto 16px; font-size: 24px;">BF</div>
            <h1 style="margin: 0 0 8px;">${this.i18n.t('auth.register')}</h1>
            <p style="color: var(--color-text-muted); margin: 0;">${this.i18n.t('common.app_tagline')}</p>
          </div>

          <form id="registerForm" novalidate>
            <div style="margin-bottom: 20px;">
              <label class="label">${this.i18n.t('auth.email')}</label>
              <input type="email" name="email" class="input" placeholder="${this.i18n.t('auth.enter_email')}" required autocomplete="email" />
            </div>
            <div style="margin-bottom: 20px;">
              <label class="label">${this.i18n.t('auth.password')}</label>
              <input type="password" name="password" class="input" placeholder="${this.i18n.t('auth.enter_password')}" required autocomplete="new-password" minlength="8" />
              <p class="helper-text">${this.i18n.t('auth.password_min_length')}</p>
            </div>
            <div style="margin-bottom: 20px;">
              <label class="label">${this.i18n.t('auth.confirm_password')}</label>
              <input type="password" name="confirmPassword" class="input" placeholder="${this.i18n.t('auth.confirm_password')}" required autocomplete="new-password" />
            </div>
            <div style="margin-bottom: 24px;">
              <label class="checkbox-wrapper">
                <input type="checkbox" name="terms" required />
                <span class="checkbox-custom"></span>
                <span class="checkbox-label">Saya setuju dengan <a href="#" style="color: var(--color-accent);">Syarat & Ketentuan</a> dan <a href="#" style="color: var(--color-accent);">Kebijakan Privasi</a></span>
              </label>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; height: 44px;">${this.i18n.t('auth.create_account')}</button>
          </form>

          <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--color-divider);">
            <p style="text-align: center; font-size: 13px; color: var(--color-text-muted);">
              ${this.i18n.t('auth.has_account')} <a href="#auth/login" style="color: var(--color-accent);">${this.i18n.t('auth.login')}</a>
            </p>
          </div>
        </div>
      </div>
    `;
  }

  renderResetPassword() {
    return `
      <div class="card" style="max-width: 400px; margin: 0 auto;">
        <div class="card-body" style="padding: 40px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div class="avatar" style="width: 56px; height: 56px; margin: 0 auto 16px; font-size: 24px;">BF</div>
            <h1 style="margin: 0 0 8px;">${this.i18n.t('auth.reset_password')}</h1>
            <p style="color: var(--color-text-muted); margin: 0;">${this.i18n.t('auth.enter_email')}</p>
          </div>

          <form id="resetPasswordForm" novalidate>
            <div style="margin-bottom: 24px;">
              <label class="label">${this.i18n.t('auth.email')}</label>
              <input type="email" name="email" class="input" placeholder="${this.i18n.t('auth.enter_email')}" required autocomplete="email" />
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; height: 44px;">${this.i18n.t('auth.reset_password')}</button>
          </form>

          <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--color-divider);">
            <p style="text-align: center; font-size: 13px; color: var(--color-text-muted);">
              <a href="#auth/login" style="color: var(--color-accent);">${this.i18n.t('auth.back')}</a>
            </p>
          </div>
        </div>
      </div>
    `;
  }

  renderCallback() {
    return `
      <div style="text-align: center; padding: 40px;">
        <div class="spinner spinner-lg" style="margin: 0 auto 16px;"></div>
        <h2 style="margin: 0 0 8px;">${this.i18n.t('auth.login')}</h2>
        <p style="color: var(--color-text-muted);">Mengalihkan...</p>
      </div>
    `;
  }

  bindLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const email = fd.get('email');
      const password = fd.get('password');

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = this.i18n.t('common.loading');

      try {
        const { data, error } = await signIn(email, password);
        if (error) throw error;
        await this.setUser(data.user);
        window.location.hash = 'chat';
      } catch (err) {
        this.ui.toast(err.message || this.i18n.t('auth.invalid_credentials'), 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = this.i18n.t('auth.login');
      }
    });

    // OAuth buttons
    form.querySelectorAll('[data-provider]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const provider = btn.dataset.provider;
        try {
          await signInWithOAuth(provider);
        } catch (err) {
          this.ui.toast(err.message, 'error');
        }
      });
    });
  }

  bindRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const email = fd.get('email');
      const password = fd.get('password');
      const confirmPassword = fd.get('confirmPassword');

      if (password !== confirmPassword) {
        this.ui.toast(this.i18n.t('auth.passwords_not_match'), 'error');
        return;
      }
      if (password.length < 8) {
        this.ui.toast(this.i18n.t('auth.password_min_length'), 'error');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = this.i18n.t('common.loading');

      try {
        const { data, error } = await signUp(email, password);
        if (error) throw error;
        this.ui.toast(this.i18n.t('auth.signup_success'), 'success');
        window.location.hash = 'auth/login';
      } catch (err) {
        this.ui.toast(err.message || this.i18n.t('auth.email_taken'), 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = this.i18n.t('auth.create_account');
      }
    });
  }

  bindResetPasswordForm() {
    const form = document.getElementById('resetPasswordForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const email = fd.get('email');

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = this.i18n.t('common.loading');

      try {
        const { error } = await import('./lib/supabase.js').then(m => m.resetPassword(email));
        if (error) throw error;
        this.ui.toast(this.i18n.t('auth.reset_email_sent'), 'success');
      } catch (err) {
        this.ui.toast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = this.i18n.t('auth.reset_password');
      }
    });
  }
}