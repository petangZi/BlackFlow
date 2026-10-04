/**
 * Black Flow - Internationalization
 * Simple i18n with locale JSON files
 */

export class I18n {
  constructor() {
    this.locale = 'id';
    this.messages = {};
    this.fallbackLocale = 'en';
  }

  async init() {
    // Get saved locale or detect
    const saved = localStorage.getItem('locale');
    if (saved) {
      this.locale = saved;
    } else {
      const browserLang = navigator.language.split('-')[0];
      this.locale = ['id', 'en'].includes(browserLang) ? browserLang : 'id';
    }

    await this.loadLocale(this.locale);
    await this.loadLocale(this.fallbackLocale); // Load fallback
  }

  async loadLocale(locale) {
    if (this.messages[locale]) return;

    try {
      const response = await fetch(`/locales/${locale}.json`);
      if (response.ok) {
        this.messages[locale] = await response.json();
      }
    } catch {
      // Use empty object if load fails
      this.messages[locale] = {};
    }
  }

  setLocale(locale) {
    if (this.messages[locale] || ['id', 'en'].includes(locale)) {
      this.locale = locale;
      localStorage.setItem('locale', locale);
      document.documentElement.lang = locale;
      return true;
    }
    return false;
  }

  t(key, params = {}) {
    const keys = key.split('.');
    let message = this.messages[this.locale];

    for (const k of keys) {
      if (message && typeof message === 'object' && k in message) {
        message = message[k];
      } else {
        message = undefined;
        break;
      }
    }

    // Fallback to English
    if (message === undefined && this.locale !== this.fallbackLocale) {
      let fallback = this.messages[this.fallbackLocale];
      for (const k of keys) {
        if (fallback && typeof fallback === 'object' && k in fallback) {
          fallback = fallback[k];
        } else {
          fallback = undefined;
          break;
        }
      }
      message = fallback;
    }

    // Return key if not found
    if (message === undefined) {
      console.warn(`[i18n] Missing translation: ${key} (${this.locale})`);
      return key;
    }

    // Interpolate params
    if (typeof message === 'string' && Object.keys(params).length > 0) {
      return message.replace(/\{\{(\w+)\}\}/g, (match, param) => {
        return params[param] !== undefined ? params[param] : match;
      });
    }

    return message;
  }

  // Pluralization helper
  tc(key, count, params = {}) {
    params.count = count;
    const keys = [`${key}.plural`, `${key}.many`, `${key}.one`, `${key}.other`, key];

    for (const k of keys) {
      const msg = this.t(k, params);
      if (msg !== k) return msg;
    }

    return this.t(key, params);
  }

  // Get available locales
  getLocales() {
    return ['id', 'en'];
  }

  // Get locale info
  getLocaleInfo(locale) {
    const names = { id: 'Indonesia', en: 'English' };
    return { code: locale, name: names[locale] || locale };
  }
}