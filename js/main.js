/**
 * Black Flow - Main Application Entry Point
 * Vanilla JS ES Modules, no framework, no bundler
 */

import { supabase, getSession, getUser, signUp, signIn, signInWithOAuth, signOut, onAuthStateChange, getProfile, updateProfile, listConversations, createConversation, listMessages, getFeatureFlags, getAnnouncements } from './lib/supabase.js';
import { Router } from './router.js';
import { Store } from './store.js';
import { UI } from './ui.js';
import { I18n } from './i18n.js';
import { Auth } from './auth.js';
import { Chat } from './views/chat.js';
import { Dashboard } from './views/dashboard/index.js';
import { Admin } from './views/admin/index.js';

// Global state
const store = new Store();
const ui = new UI(store);
const i18n = new I18n();
const auth = new Auth(store, ui, i18n);
const chat = new Chat(store, ui, i18n);
const dashboard = new Dashboard(store, ui, i18n);
const admin = new Admin(store, ui, i18n);

// Initialize app
async function init() {
  try {
    // Load locale
    await i18n.init();
    ui.setLocale(i18n.locale);

    // Check for existing session
    const session = await getSession();
    if (session) {
      await auth.setUser(session.user);
    }

    // Listen for auth changes
    onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await auth.setUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        await auth.clearUser();
      }
    });

    // Setup router
    setupRouter();

    // Load feature flags
    const flags = await getFeatureFlags(store.user?.role || 'user');
    store.setFeatureFlags(flags);

    // Load announcements
    const announcements = await getAnnouncements(store.user?.role || 'user');
    store.setAnnouncements(announcements);

    // Render initial view
    renderView();

    // Register global error handler
    window.addEventListener('error', (e) => {
      console.error('Global error:', e.error);
      ui.toast(i18n.t('error.unexpected'), 'error');
    });

    window.addEventListener('unhandledrejection', (e) => {
      console.error('Unhandled rejection:', e.reason);
      ui.toast(i18n.t('error.unexpected'), 'error');
    });

    console.log('[Black Flow] Initialized');
  } catch (err) {
    console.error('[Black Flow] Init failed:', err);
    ui.toast(i18n.t('error.init_failed'), 'error');
  }
}

// Hash-based router
function setupRouter() {
  const handleHashChange = () => {
    const hash = window.location.hash.slice(1) || 'chat';
    const [view, ...params] = hash.split('/');
    store.setState({ currentView: view, viewParams: params });
    renderView();
  };

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange(); // Initial
}

async function renderView() {
  const { currentView, viewParams } = store.state;
  const isAuth = !!store.user;

  // Show/hide main sections
  const emptyState = document.getElementById('emptyState');
  const chatState = document.getElementById('chatState');
  const dashboardState = document.getElementById('dashboardState');
  const adminState = document.getElementById('adminState');
  const authState = document.getElementById('authState');

  // Hide all
  [emptyState, chatState, dashboardState, adminState, authState].forEach(el => {
    if (el) el.style.display = 'none';
  });

  // Handle auth-required views
  const authRequiredViews = ['chat', 'dashboard-overview', 'dashboard-usage', 'dashboard-keys', 'dashboard-byok', 'dashboard-models', 'dashboard-files', 'dashboard-billing', 'dashboard-settings'];
  const adminViews = ['admin-pool', 'admin-health', 'admin-users', 'admin-orders', 'admin-flags', 'admin-audit', 'admin-announcements'];

  if (authRequiredViews.includes(currentView) && !isAuth) {
    // Redirect to auth
    window.location.hash = 'auth/login';
    return;
  }

  if (adminViews.includes(currentView) && store.user?.role !== 'admin' && store.user?.role !== 'owner') {
    // Redirect to dashboard
    window.location.hash = 'dashboard-overview';
    return;
  }

  // Render appropriate view
  switch (currentView) {
    case 'chat':
      emptyState.style.display = 'flex';
      chatState.style.display = 'flex';
      await chat.render();
      break;
    case 'dashboard-overview':
    case 'dashboard-usage':
    case 'dashboard-keys':
    case 'dashboard-byok':
    case 'dashboard-models':
    case 'dashboard-files':
    case 'dashboard-billing':
    case 'dashboard-settings':
      dashboardState.style.display = 'flex';
      await dashboard.render(currentView, viewParams);
      break;
    case 'admin-pool':
    case 'admin-health':
    case 'admin-users':
    case 'admin-orders':
    case 'admin-flags':
    case 'admin-audit':
    case 'admin-announcements':
      adminState.style.display = 'flex';
      await admin.render(currentView, viewParams);
      break;
    case 'auth/login':
    case 'auth/register':
    case 'auth/reset-password':
    case 'auth/callback':
      authState.style.display = 'flex';
      await auth.render(currentView);
      break;
    default:
      emptyState.style.display = 'flex';
      await chat.render();
  }

  // Update sidebar active state
  ui.updateSidebarActive(currentView);
}

// Global functions for inline handlers
window.blackflow = {
  newChat: () => chat.newChat(),
  sendMessage: () => chat.sendMessage(),
  stopGeneration: () => chat.stopGeneration(),
  toggleSidebar: () => ui.toggleSidebar(),
  closeSidebar: () => ui.closeSidebar(),
  toggleTheme: () => ui.toggleTheme(),
  showModelMenu: () => chat.showModelMenu(),
  selectModel: (modelId) => chat.selectModel(modelId),
  copyText: (text) => ui.copyToClipboard(text),
  downloadFile: (fileId) => chat.downloadFile(fileId),
  deleteConversation: (conversationId) => chat.deleteConversation(conversationId),
  pinConversation: (conversationId) => chat.pinConversation(conversationId),
  archiveConversation: (conversationId) => chat.archiveConversation(conversationId),
  signOut: () => auth.signOut(),
  openSettings: () => { window.location.hash = 'dashboard-settings'; },
  retryMessage: (messageId) => chat.retryMessage(messageId),
  editMessage: (messageId) => chat.editMessage(messageId),
  regenerateMessage: (messageId) => chat.regenerateMessage(messageId)
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.__BLACKFLOW__ = { store, ui, i18n, auth, chat, dashboard, admin };