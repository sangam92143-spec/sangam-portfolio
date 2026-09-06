/**
 * Sangam Singh - AI Portfolio Chatbot Client
 * Modern Black & Purple Theme, Centered Welcome Hero, Horizontal Suggestion Pills, Capsule Input
 */
(function() {
  'use strict';

  if (window.__SANGAM_CHATBOT_INITIALIZED__) return;
  window.__SANGAM_CHATBOT_INITIALIZED__ = true;

  var STORAGE_KEY = '__sangam_chat_history__';
  var isOpen = false;
  var isGenerating = false;
  var conversationHistory = [];

  // Professional human AI specialist avatar image
  var AVATAR_IMG_HTML = '<img src="/images/ai-avatar.jpg" alt="AI Specialist" class="scb-avatar-photo" />';

  // Sleek SVG Icons for Suggestion Pills
  var ICON_FILM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>';
  var ICON_PRICING = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>';
  var ICON_LIGHTNING = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>';
  var ICON_CALENDAR = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';

  // DOM Elements
  var rootEl, triggerWrapper, triggerBtn, chatboxEl, messagesEl, inputEl, sendBtn, closeBtn, resetBtn, suggestionDockEl;

  // Load conversation from persistent localStorage & sessionStorage
  function loadHistoryFromStorage() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          conversationHistory = parsed;
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function saveHistoryToStorage() {
    try {
      var json = JSON.stringify(conversationHistory);
      localStorage.setItem(STORAGE_KEY, json);
      sessionStorage.setItem(STORAGE_KEY, json);
    } catch (e) {}
  }

  function clearHistoryStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    conversationHistory = [];
    renderInitialState();
  }

  // Compact markdown parser
  function parseMarkdown(text) {
    if (!text) return '';
    var escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Links: [text](url)
    escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, function(match, label, href) {
      return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    });

    // Bold: **text**
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    var lines = escaped.split('\n');
    var inList = false;
    var output = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var listMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
      var numMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);

      if (listMatch) {
        if (!inList) {
          output.push('<ul>');
          inList = true;
        }
        output.push('<li>' + listMatch[2] + '</li>');
      } else if (numMatch) {
        if (!inList) {
          output.push('<ol>');
          inList = 'ol';
        }
        output.push('<li>' + numMatch[2] + '</li>');
      } else {
        if (inList) {
          output.push(inList === 'ol' ? '</ol>' : '</ul>');
          inList = false;
        }
        if (line.trim().length > 0) {
          output.push('<p>' + line + '</p>');
        }
      }
    }

    if (inList) {
      output.push(inList === 'ol' ? '</ol>' : '</ul>');
    }

    return output.join('');
  }

  function scrollToBottom() {
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderInitialState() {
    if (!messagesEl) return;
    // Centered Welcome Hero with circular human specialist avatar
    messagesEl.innerHTML = [
      '<div class="scb-welcome-hero" id="scb-welcome-hero">',
      '  <div class="scb-welcome-avatar-wrap">',
      '    <div class="scb-welcome-glow"></div>',
      '    <div class="scb-welcome-avatar-ring">',
      '      <img src="/images/ai-avatar.jpg" alt="Sangam AI Specialist" class="scb-welcome-avatar-img" />',
      '      <span class="scb-welcome-online-badge"></span>',
      '    </div>',
      '  </div>',
      '  <h2 class="scb-welcome-title">What would you like to create today?</h2>',
      '  <div class="scb-bubble scb-welcome-bubble">',
      '    <p>Hey, what are you looking to get done?</p>',
      '  </div>',
      '</div>'
    ].join('\n');

    if (suggestionDockEl) {
      suggestionDockEl.style.display = 'flex';
    }
  }

  function renderSavedHistory() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';
    conversationHistory.forEach(function(msg) {
      appendMessage(msg.role, msg.content, false);
    });
    if (suggestionDockEl) {
      suggestionDockEl.style.display = 'flex';
    }
    scrollToBottom();
  }

  function createWidgetDOM() {
    rootEl = document.createElement('div');
    rootEl.id = 'sangam-chatbot-root';

    rootEl.innerHTML = [
      '<!-- Floating Trigger Button with Human Avatar -->',
      '<div class="scb-trigger-wrapper" id="scb-trigger-wrapper">',
      '  <div class="scb-trigger-pill">Ask me anything</div>',
      '  <button type="button" class="scb-trigger-btn" id="scb-trigger-btn" aria-label="Open AI Assistant" title="Ask me anything">',
      '    <div class="scb-trigger-pulse"></div>',
      '    <div class="scb-avatar-img">' + AVATAR_IMG_HTML + '</div>',
      '    <svg class="scb-trigger-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
      '      <line x1="18" y1="6" x2="6" y2="18"></line>',
      '      <line x1="6" y1="6" x2="18" y2="18"></line>',
      '    </svg>',
      '    <span class="scb-trigger-dot" aria-hidden="true"></span>',
      '  </button>',
      '</div>',
      '',
      '<!-- Chatbox Container (Black & Purple Theme) -->',
      '<div class="scb-chatbox" id="scb-chatbox" role="dialog" aria-modal="false" aria-label="Sangam AI Chat">',
      '  <!-- Header -->',
      '  <div class="scb-header">',
      '    <div class="scb-header-left">',
      '      <div class="scb-header-avatar" aria-hidden="true">' + AVATAR_IMG_HTML + '</div>',
      '      <div class="scb-header-text">',
      '        <div class="scb-header-title-row">',
      '          <span class="scb-header-name">Sangam AI</span>',
      '          <span class="scb-badge-pro">SPECIALIST</span>',
      '        </div>',
      '        <div class="scb-header-status">',
      '          <span class="scb-status-indicator" aria-hidden="true"></span>',
      '          <span>Online &bull; Video Specialist</span>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div class="scb-header-actions">',
      '      <button type="button" class="scb-icon-btn" id="scb-reset-btn" aria-label="Restart conversation" title="Restart conversation">',
      '        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
      '          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>',
      '          <path d="M3 3v5h5"></path>',
      '        </svg>',
      '      </button>',
      '      <button type="button" class="scb-icon-btn" id="scb-close-btn" aria-label="Close Chat" title="Close Chat">',
      '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
      '          <line x1="18" y1="6" x2="6" y2="18"></line>',
      '          <line x1="6" y1="6" x2="18" y2="18"></line>',
      '        </svg>',
      '      </button>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- Messages Scroll Area -->',
      '  <div class="scb-messages" id="scb-messages"></div>',
      '',
      '  <!-- Horizontal Suggestion Pills Dock (Sitting right above the input bar) -->',
      '  <div class="scb-suggestion-dock" id="scb-suggestion-dock">',
      '    <div class="scb-pills-row">',
      '      <button type="button" class="scb-dock-pill" data-query="What services do you offer?">',
      '        <span class="scb-dock-icon">' + ICON_FILM + '</span>',
      '        <span>What services do you offer?</span>',
      '      </button>',
      '      <button type="button" class="scb-dock-pill" data-query="How much do you charge?">',
      '        <span class="scb-dock-icon">' + ICON_PRICING + '</span>',
      '        <span>How much do you charge?</span>',
      '      </button>',
      '      <button type="button" class="scb-dock-pill" data-query="What is your typical turnaround time?">',
      '        <span class="scb-dock-icon">' + ICON_LIGHTNING + '</span>',
      '        <span>Turnaround time</span>',
      '      </button>',
      '      <button type="button" class="scb-dock-pill" data-query="How can I book a discovery call?">',
      '        <span class="scb-dock-icon">' + ICON_CALENDAR + '</span>',
      '        <span>Book a call</span>',
      '      </button>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- Modern Floating Pill Input Bar (Matching Reference) -->',
      '  <div class="scb-footer-wrap">',
      '    <form class="scb-input-pill-bar" id="scb-form">',
      '      <button type="button" class="scb-input-action-btn" id="scb-plus-btn" aria-label="Add attachment" title="Creative prompts">',
      '        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
      '          <line x1="12" y1="5" x2="12" y2="19"></line>',
      '          <line x1="5" y1="12" x2="19" y2="12"></line>',
      '        </svg>',
      '      </button>',
      '      <input type="text" class="scb-input" id="scb-input" placeholder="Type a message..." autocomplete="off" />',
      '      <div class="scb-input-right-actions">',
      '        <button type="button" class="scb-sparkle-action-btn" id="scb-sparkle-btn" aria-label="Quick Prompts" title="Explore services">',
      '          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
      '            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
      '          </svg>',
      '        </button>',
      '        <button type="submit" class="scb-send-btn" id="scb-send-btn" aria-label="Send message">',
      '          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">',
      '            <line x1="5" y1="12" x2="19" y2="12"></line>',
      '            <polyline points="12 5 19 12 12 19"></polyline>',
      '          </svg>',
      '        </button>',
      '      </div>',
      '    </form>',
      '  </div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(rootEl);

    triggerWrapper = document.getElementById('scb-trigger-wrapper');
    triggerBtn = document.getElementById('scb-trigger-btn');
    chatboxEl = document.getElementById('scb-chatbox');
    messagesEl = document.getElementById('scb-messages');
    inputEl = document.getElementById('scb-input');
    sendBtn = document.getElementById('scb-send-btn');
    closeBtn = document.getElementById('scb-close-btn');
    resetBtn = document.getElementById('scb-reset-btn');
    suggestionDockEl = document.getElementById('scb-suggestion-dock');

    // Restore conversation from sessionStorage if available
    var hasSaved = loadHistoryFromStorage();
    if (hasSaved) {
      renderSavedHistory();
    } else {
      renderInitialState();
    }

    attachEventListeners();
  }

  function toggleChatbox() {
    if (isOpen) {
      closeChatbox();
    } else {
      openChatbox();
    }
  }

  function openChatbox() {
    isOpen = true;
    chatboxEl.classList.add('is-open');
    triggerBtn.classList.add('is-active');
    triggerWrapper.classList.add('is-chat-open');
    triggerBtn.setAttribute('aria-expanded', 'true');
    scrollToBottom();
    if (window.innerWidth > 600) {
      setTimeout(function() { inputEl.focus(); }, 120);
    }
  }

  function closeChatbox() {
    isOpen = false;
    chatboxEl.classList.remove('is-open');
    triggerBtn.classList.remove('is-active');
    triggerWrapper.classList.remove('is-chat-open');
    triggerBtn.setAttribute('aria-expanded', 'false');
  }

  function appendMessage(role, rawContent, shouldAnimate) {
    // Hide initial welcome hero once conversation starts
    var hero = document.getElementById('scb-welcome-hero');
    if (hero) hero.style.display = 'none';

    var row = document.createElement('div');
    row.className = 'scb-message-row is-' + (role === 'user' ? 'user' : 'assistant');
    if (shouldAnimate === false) {
      row.style.animation = 'none';
    }

    if (role === 'assistant') {
      var av = document.createElement('div');
      av.className = 'scb-msg-avatar';
      av.innerHTML = AVATAR_IMG_HTML;
      row.appendChild(av);
    }

    var bubble = document.createElement('div');
    bubble.className = 'scb-bubble';
    bubble.innerHTML = parseMarkdown(rawContent);

    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollToBottom();

    return bubble;
  }

  function showTypingIndicator() {
    var typingEl = document.createElement('div');
    typingEl.className = 'scb-message-row is-assistant scb-typing-row';
    typingEl.id = 'scb-typing-indicator';
    typingEl.innerHTML = '<div class="scb-msg-avatar">' + AVATAR_IMG_HTML + '</div>' +
      '<div class="scb-bubble scb-typing-bubble"><span class="scb-typing-dot"></span><span class="scb-typing-dot"></span><span class="scb-typing-dot"></span></div>';
    messagesEl.appendChild(typingEl);
    scrollToBottom();
    return typingEl;
  }

  function removeTypingIndicator() {
    var typingEl = document.getElementById('scb-typing-indicator');
    if (typingEl) typingEl.remove();
  }

  function getCurrentContext() {
    var sectionName = 'Hero / General';
    try {
      var sections = document.querySelectorAll('section, [data-framer-name], main > div');
      var scrollY = window.scrollY || window.pageYOffset || 0;
      var midScreen = scrollY + window.innerHeight / 3;

      for (var i = 0; i < sections.length; i++) {
        var sec = sections[i];
        var top = sec.offsetTop;
        var height = sec.offsetHeight;
        if (top <= midScreen && (top + height) >= midScreen) {
          var name = sec.getAttribute('data-framer-name') || sec.id || sec.className;
          if (name && typeof name === 'string' && name.trim().length > 0) {
            sectionName = name.trim();
            break;
          }
        }
      }
    } catch (e) {}

    return {
      currentPage: window.location.pathname || '/',
      currentSection: sectionName,
      currentUrl: window.location.href || ''
    };
  }

  async function sendMessage(userText) {
    if (!userText || typeof userText !== 'string') return;
    var trimmed = userText.trim();
    if (trimmed.length === 0 || isGenerating) return;

    appendMessage('user', trimmed);
    conversationHistory.push({ role: 'user', content: trimmed });
    saveHistoryToStorage();

    inputEl.value = '';
    isGenerating = true;
    sendBtn.disabled = true;

    var typingEl = showTypingIndicator();

    try {
      var clientContext = getCurrentContext();
      var response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          context: clientContext
        })
      });

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var fullResponseText = '';
      var assistantBubble = null;
      var buffer = '';

      while (true) {
        var result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop();

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.startsWith('data: ')) {
            var dataPayload = line.slice(6);
            if (dataPayload === '[DONE]') continue;

            try {
              var parsed = JSON.parse(dataPayload);
              if (parsed.text) {
                if (typingEl) {
                  removeTypingIndicator();
                  typingEl = null;
                }

                if (!assistantBubble) {
                  assistantBubble = appendMessage('assistant', '');
                }

                fullResponseText += parsed.text;
                assistantBubble.innerHTML = parseMarkdown(fullResponseText);
                scrollToBottom();
              }
            } catch (jsonErr) {}
          }
        }
      }

      if (!assistantBubble) {
        removeTypingIndicator();
        assistantBubble = appendMessage('assistant', 'Something went wrong while getting that answer. Try again in a moment.');
        fullResponseText = 'Something went wrong while getting that answer. Try again in a moment.';
      }

      conversationHistory.push({ role: 'assistant', content: fullResponseText });
      saveHistoryToStorage();

    } catch (err) {
      removeTypingIndicator();
      appendMessage('assistant', 'Something went wrong while getting that answer. Try again in a moment.');
    } finally {
      isGenerating = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  function attachEventListeners() {
    triggerBtn.addEventListener('click', toggleChatbox);
    closeBtn.addEventListener('click', closeChatbox);
    resetBtn.addEventListener('click', clearHistoryStorage);

    var formEl = document.getElementById('scb-form');
    formEl.addEventListener('submit', function(e) {
      e.preventDefault();
      sendMessage(inputEl.value);
    });

    // Handle suggestion pills click
    rootEl.addEventListener('click', function(e) {
      var pill = e.target.closest('.scb-dock-pill') || e.target.closest('.scb-quick-btn');
      if (pill) {
        var query = pill.getAttribute('data-query');
        if (query) sendMessage(query);
      }
    });

    // Sparkle quick action
    var sparkleBtn = document.getElementById('scb-sparkle-btn');
    if (sparkleBtn) {
      sparkleBtn.addEventListener('click', function() {
        sendMessage('What services do you offer?');
      });
    }

    // Plus quick action
    var plusBtn = document.getElementById('scb-plus-btn');
    if (plusBtn) {
      plusBtn.addEventListener('click', function() {
        inputEl.value = 'I need video editing for ';
        inputEl.focus();
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isOpen) closeChatbox();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidgetDOM);
  } else {
    createWidgetDOM();
  }
})();
