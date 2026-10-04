/**
 * Black Flow - Chat View
 */

import { listConversations, createConversation, listMessages, createMessage, updateMessage } from '../lib/supabase.js';

export class Chat {
  constructor(store, ui, i18n) {
    this.store = store;
    this.ui = ui;
    this.i18n = i18n;
    this.composer = null;
    this.abortController = null;
    this.messageIdCounter = 0;
  }

  async render() {
    await this.loadConversations();
    this.renderSidebar();
    this.renderEmptyState();
    this.setupComposer();
  }

  async loadConversations() {
    if (!this.store.user) return;
    try {
      const conversations = await listConversations(this.store.user.id, { archived: false, limit: 50 });
      this.store.set('conversations', conversations);
    } catch (err) {
      console.error('[Chat] Failed to load conversations:', err);
    }
  }

  renderSidebar() {
    const today = document.getElementById('sbToday');
    const week = document.getElementById('sbWeek');
    if (!today || !week) return;

    const conversations = this.store.get('conversations') || [];
    const now = new Date();
    const todayStr = now.toDateString();
    const weekAgo = new Date(now - 7 * 86400000);

    const todayConvs = conversations.filter(c => new Date(c.created_at).toDateString() === todayStr);
    const weekConvs = conversations.filter(c => {
      const d = new Date(c.created_at);
      return d >= weekAgo && d.toDateString() !== todayStr;
    });

    const renderList = (list, container) => {
      container.innerHTML = list.map(c => `
        <button class="sb-chat${c.pinned ? ' active' : ''}" data-conv-id="${c.id}" title="${this.ui.escapeHtml(c.title || 'Tanpa judul')}">
          ${this.ui.escapeHtml(c.title || this.i18n.t('chat.new_chat'))}
        </button>
      `).join('') || `<div style="padding: 8px; color: var(--color-text-muted); font-size: 13px;">${this.i18n.t('chat.no_conversations')}</div>`;
    };

    renderList(todayConvs, today);
    renderList(weekConvs, week);

    // Bind click events
    document.querySelectorAll('.sb-chat[data-conv-id]').forEach(btn => {
      btn.addEventListener('click', () => this.loadConversation(btn.dataset.convId));
    });
  }

  async loadConversation(conversationId) {
    try {
      const messages = await listMessages(conversationId);
      this.store.set('currentConversation', conversationId);
      this.store.set('messages', messages);
      this.enterChat();
      this.renderMessages();
      this.scrollBottom();
    } catch (err) {
      console.error('[Chat] Failed to load conversation:', err);
      this.ui.toast(this.i18n.t('errors.unexpected'), 'error');
    }
  }

  async newChat() {
    if (!this.store.user) return;

    // Clear current state
    this.store.set('currentConversation', null);
    this.store.set('messages', []);
    this.abortController = null;

    this.enterEmpty();
    this.renderEmptyState();
    this.setupComposer();

    const greetingEl = document.getElementById('greeting');
    if (greetingEl) {
      const greetings = this.i18n.t('chat.greetings');
      greetingEl.textContent = greetings[Math.floor(Math.random() * greetings.length)];
    }

    if (this.ui.isMobile()) this.ui.closeSidebar();
  }

  enterChat() {
    const emptyState = document.getElementById('emptyState');
    const chatState = document.getElementById('chatState');
    if (emptyState) emptyState.style.display = 'none';
    if (chatState) chatState.style.display = 'flex';
  }

  enterEmpty() {
    const emptyState = document.getElementById('emptyState');
    const chatState = document.getElementById('chatState');
    if (chatState) chatState.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
  }

  renderEmptyState() {
    const slot = document.getElementById('emptySlot');
    const chips = document.getElementById('promptChips');
    if (!slot || !chips) return;

    // Composer in empty state
    this.setupComposer('#emptySlot');

    // Prompt chips
    const suggestions = this.i18n.t('chat.prompt_suggestions');
    chips.innerHTML = Object.entries(suggestions).map(([key, label]) => `
      <button class="chip" data-prompt="${key}">
        ${this.getChipIcon(key)}
        ${this.ui.escapeHtml(label)}
      </button>
    `).join('');

    chips.querySelectorAll('.chip[data-prompt]').forEach(chip => {
      chip.addEventListener('click', () => {
        const ta = this.composer?.querySelector('textarea');
        if (ta) {
          ta.value = chip.dataset.prompt + ' ';
          ta.dispatchEvent(new Event('input'));
          ta.focus();
        }
      });
    });
  }

  getChipIcon(key) {
    const icons = {
      create_image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
      summarize_text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18h-5"/><path d="M18 14h-8"/><path d="M21 10h-11"/><path d="M3 6h18"/></svg>',
      analyze_data: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
      make_plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>',
      write_code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
      explain_concept: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
      translate_text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6"/><path d="M4 14l6-6"/><path d="M2 5h12"/><path d="M7 19h10"/></svg>',
      debug_code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 21h-4"/><path d="M16 3h4"/><path d="M10 3h.01"/><path d="M10 9h.01"/></svg>'
    };
    return icons[key] || '';
  }

  setupComposer(where = '#chatSlot') {
    const container = document.querySelector(where);
    if (!container) return;

    // Remove existing composer
    if (this.composer && this.composer.parentNode) {
      this.composer.parentNode.removeChild(this.composer);
    }

    this.composer = document.createElement('div');
    this.composer.innerHTML = `
      <div class="composer">
        <button class="c-btn" data-act="attach" aria-label="${this.i18n.t('chat.attach_files')}" title="${this.i18n.t('chat.attach_files')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        </button>
        <textarea rows="1" placeholder="${this.i18n.t('chat.placeholder')}" aria-label="${this.i18n.t('chat.placeholder')}"></textarea>
        <div style="display:flex;align-items:center;gap:2px">
          <button class="c-btn" data-act="dictate" aria-label="${this.i18n.t('chat.dictate')}" title="${this.i18n.t('chat.dictate')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>
          </button>
          <button class="c-btn" data-act="voice" aria-label="${this.i18n.t('chat.voice_mode')}" title="${this.i18n.t('chat.voice_mode')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/></svg>
          </button>
          <button class="c-btn primary" data-act="send" aria-label="${this.i18n.t('chat.send')}" title="${this.i18n.t('chat.send')}" style="display:none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
          </button>
          <button class="c-btn primary" data-act="stop" aria-label="${this.i18n.t('chat.stop')}" title="${this.i18n.t('chat.stop')}" style="display:none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="11" height="11" x="6.5" y="6.5" rx="2"/></svg>
          </button>
        </div>
      </div>
    `;

    container.appendChild(this.composer.firstElementChild);
    this.composer = container.querySelector('.composer');
    this.bindComposerEvents();
    this.syncComposer();
  }

  bindComposerEvents() {
    if (!this.composer) return;

    const ta = this.composer.querySelector('textarea');
    const sendBtn = this.composer.querySelector('[data-act="send"]');
    const stopBtn = this.composer.querySelector('[data-act="stop"]');
    const dictateBtn = this.composer.querySelector('[data-act="dictate"]');
    const voiceBtn = this.composer.querySelector('[data-act="voice"]');
    const attachBtn = this.composer.querySelector('[data-act="attach"]');

    ta.addEventListener('input', () => {
      this.autoGrow(ta);
      this.syncComposer();
    });

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    sendBtn.addEventListener('click', () => this.sendMessage());
    stopBtn.addEventListener('click', () => this.stopGeneration());
    dictateBtn.addEventListener('click', () => this.startDictation());
    voiceBtn.addEventListener('click', () => this.ui.toast(this.i18n.t('chat.voice_mode'), 'info'));
    attachBtn.addEventListener('click', () => this.ui.toast(this.i18n.t('chat.attach_files'), 'info'));
  }

  autoGrow(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  syncComposer() {
    if (!this.composer) return;
    const ta = this.composer.querySelector('textarea');
    const sendBtn = this.composer.querySelector('[data-act="send"]');
    const stopBtn = this.composer.querySelector('[data-act="stop"]');
    const dictateBtn = this.composer.querySelector('[data-act="dictate"]');
    const voiceBtn = this.composer.querySelector('[data-act="voice"]');

    const hasText = ta.value.trim().length > 0;
    const isRunning = !!this.abortController;

    sendBtn.style.display = !isRunning && hasText ? 'flex' : 'none';
    stopBtn.style.display = isRunning ? 'flex' : 'none';
    dictateBtn.style.display = !isRunning ? 'flex' : 'none';
    voiceBtn.style.display = !isRunning && !hasText ? 'flex' : 'none';
  }

  async sendMessage() {
    if (!this.composer) return;
    const ta = this.composer.querySelector('textarea');
    const text = ta.value.trim();
    if (!text || this.abortController) return;

    // Create or get conversation
    let conversationId = this.store.get('currentConversation');
    if (!conversationId) {
      try {
        const conv = await createConversation(this.store.user.id, {
          title: text.slice(0, 50),
          model_id: this.store.get('selectedModel') || 'model:auto'
        });
        conversationId = conv.id;
        this.store.set('currentConversation', conversationId);
        await this.loadConversations();
        this.renderSidebar();
      } catch (err) {
        console.error('[Chat] Failed to create conversation:', err);
        this.ui.toast(this.i18n.t('errors.unexpected'), 'error');
        return;
      }
    }

    // Add user message
    const userMessage = {
      id: `msg-${++this.messageIdCounter}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    this.store.state.messages.push(userMessage);
    this.renderMessages();
    this.scrollBottom();

    // Clear input
    ta.value = '';
    ta.style.height = 'auto';
    this.syncComposer();

    // Enter chat view if in empty state
    this.enterChat();

    // Start streaming
    this.abortController = new AbortController();
    await this.streamResponse(conversationId, text);
  }

  async streamResponse(conversationId, userMessage) {
    const messages = this.store.get('messages');
    const modelId = this.store.get('selectedModel') || 'model:auto';

    // Add assistant message placeholder
    const assistantMessage = {
      id: `msg-${++this.messageIdCounter}`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      streaming: true
    };
    messages.push(assistantMessage);
    this.renderMessages();
    this.scrollBottom();

    try {
      const body = {
        model: modelId,
        messages: messages.filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content })),
        stream: true
      };

      const response = await fetch('/.netlify/edge-functions/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.store.get('session')?.access_token || ''}`
        },
        body: JSON.stringify(body),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'delta' && parsed.text) {
                fullContent += parsed.text;
                assistantMessage.content = fullContent;
                this.renderMessages();
                this.scrollBottom();
              } else if (parsed.type === 'tool_call') {
                // Handle tool calls
                this.handleToolCall(parsed.data);
              } else if (parsed.type === 'tool_result') {
                this.handleToolResult(parsed.data);
              } else if (parsed.type === 'error') {
                throw new Error(parsed.message);
              } else if (parsed.type === 'done') {
                // Save messages
                await this.saveMessages(conversationId, userMessage, fullContent);
                assistantMessage.streaming = false;
                this.renderMessages();
                this.scrollBottom();
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        assistantMessage.content = this.i18n.t('chat.partial_response') + '\n\n' + assistantMessage.content;
      } else {
        assistantMessage.content = `${this.i18n.t('errors.unexpected')}: ${err.message}`;
        this.ui.toast(this.i18n.t('errors.unexpected'), 'error');
      }
      assistantMessage.streaming = false;
      this.renderMessages();
      this.scrollBottom();
    } finally {
      this.abortController = null;
      this.syncComposer();
    }
  }

  handleToolCall(data) {
    // Add tool call indicator to UI
    console.log('[Chat] Tool call:', data);
  }

  handleToolResult(data) {
    console.log('[Chat] Tool result:', data);
  }

  async saveMessages(conversationId, userMessage, assistantContent) {
    try {
      await createMessage(conversationId, {
        role: 'user',
        content: userMessage,
        request_id: `req-${Date.now()}`
      });
      await createMessage(conversationId, {
        role: 'assistant',
        content: assistantContent,
        request_id: `req-${Date.now()}`
      });
    } catch (err) {
      console.error('[Chat] Failed to save messages:', err);
    }
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.syncComposer();
    }
  }

  renderMessages() {
    const thread = document.getElementById('thread');
    if (!thread) return;

    const messages = this.store.get('messages') || [];
    thread.innerHTML = messages.map(msg => this.renderMessage(msg)).join('');

    // Bind action buttons
    thread.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const messageId = btn.closest('[data-message-id]')?.dataset.messageId;
        this.handleMessageAction(action, messageId, btn);
      });
    });
  }

  renderMessage(msg) {
    const isUser = msg.role === 'user';
    const time = this.ui.formatRelativeTime(msg.timestamp);

    if (isUser) {
      return `
        <div class="msg-user fade" data-message-id="${msg.id}">
          <div>
            <div class="bubble">${this.ui.escapeHtml(msg.content)}</div>
            <div class="user-actions">
              <button class="act" data-action="edit" data-message-id="${msg.id}" title="${this.i18n.t('chat.edit')}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a1 1 0 0 1 3 3l-9 9a2 2 0 0 1-.9.5l-2.9.8a.5.5 0 0 1-.6-.6l.8-2.9a2 2 0 0 1 .5-.8z"/></svg>
              </button>
              <button class="act" data-action="copy" data-message-id="${msg.id}" title="${this.i18n.t('chat.copy')}">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="msg-assistant fade" data-message-id="${msg.id}">
        <div class="assistant-body" data-body>${this.renderMarkdown(msg.content)}</div>
        <div class="actions">
          <button class="act" data-action="copy" data-message-id="${msg.id}" title="${this.i18n.t('chat.copy')}" aria-label="${this.i18n.t('chat.copy')}">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          </button>
          <button class="act" data-action="good" data-message-id="${msg.id}" title="${this.i18n.t('chat.good_response')}" aria-label="${this.i18n.t('chat.good_response')}">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>
          </button>
          <button class="act" data-action="bad" data-message-id="${msg.id}" title="${this.i18n.t('chat.bad_response')}" aria-label="${this.i18n.t('chat.bad_response')}">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>
          </button>
          <button class="act" data-action="read_aloud" data-message-id="${msg.id}" title="${this.i18n.t('chat.read_aloud')}" aria-label="${this.i18n.t('chat.read_aloud')}">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 18.4a9 9 0 0 0 0-12.7"/></svg>
          </button>
          <button class="act" data-action="share" data-message-id="${msg.id}" title="${this.i18n.t('chat.share')}" aria-label="${this.i18n.t('chat.share')}">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
          </button>
          <button class="act" data-action="regenerate" data-message-id="${msg.id}" title="${this.i18n.t('chat.regenerate')}" aria-label="${this.i18n.t('chat.regenerate')}">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          </button>
          <button class="act" data-action="more" data-message-id="${msg.id}" title="${this.i18n.t('chat.more_options')}" aria-label="${this.i18n.t('chat.more_options')}">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="1"/><circle cx="15" cy="8" r="1"/><circle cx="1" cy="8" r="1"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  renderMarkdown(text) {
    // Simple markdown rendering - in production use a proper library
    return this.ui.escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  handleMessageAction(action, messageId, btn) {
    const msg = this.store.get('messages').find(m => m.id === messageId);
    if (!msg) return;

    switch (action) {
      case 'copy':
        this.ui.copyToClipboard(msg.content);
        break;
      case 'edit':
        this.editMessage(messageId);
        break;
      case 'regenerate':
        this.regenerateMessage(messageId);
        break;
      case 'read_aloud':
        this.ui.toast(this.i18n.t('chat.read_aloud'), 'info');
        break;
      case 'share':
        this.ui.toast(this.i18n.t('chat.share_copied'), 'success');
        break;
      case 'good':
      case 'bad':
        this.ui.toast(this.i18n.t(`chat.${action}_response`), 'success');
        break;
    }
  }

  editMessage(messageId) {
    // TODO: Implement message editing with branching
    this.ui.toast('Edit message - coming soon', 'info');
  }

  regenerateMessage(messageId) {
    const idx = this.store.get('messages').findIndex(m => m.id === messageId);
    if (idx > 0) {
      // Remove this and subsequent messages
      this.store.state.messages = this.store.state.messages.slice(0, idx);
      // Re-send the user message before this
      const userMsg = this.store.state.messages[idx - 1];
      if (userMsg?.role === 'user') {
        this.sendMessage();
      }
    }
  }

  retryMessage(messageId) {
    this.regenerateMessage(messageId);
  }

  deleteConversation(conversationId) {
    if (!confirm(this.i18n.t('chat.delete_confirm'))) return;
    // TODO: Implement delete
    this.ui.toast('Delete conversation - coming soon', 'info');
  }

  pinConversation(conversationId) {
    // TODO: Implement pin
    this.ui.toast('Pin conversation - coming soon', 'info');
  }

  archiveConversation(conversationId) {
    // TODO: Implement archive
    this.ui.toast('Archive conversation - coming soon', 'info');
  }

  downloadFile(fileId) {
    // TODO: Implement download
    this.ui.toast('Download file - coming soon', 'info');
  }

  showModelMenu() {
    const menu = document.getElementById('modelMenu');
    if (menu) menu.classList.toggle('show');
  }

  async selectModel(modelId) {
    this.store.set('selectedModel', modelId);
    const menu = document.getElementById('modelMenu');
    if (menu) menu.classList.remove('show');

    // Update UI
    const modelName = document.getElementById('modelName');
    const modelPillName = document.getElementById('modelPillName');
    const target = this.store.get('models').find(m => m.id === modelId);
    if (modelName) modelName.textContent = target?.title || modelId;
    if (modelPillName) modelPillName.textContent = target?.title || modelId;

    this.ui.toast(`${this.i18n.t('model.select_model')}: ${target?.title || modelId}`, 'success');
  }

  scrollBottom() {
    const scroller = document.getElementById('scroller');
    if (scroller) {
      requestAnimationFrame(() => {
        scroller.scrollTop = scroller.scrollHeight;
      });
    }
  }
}