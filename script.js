// ============================================================
// Err0r-AI Pro – Black-Dragon (Improved Camera + Vision + Theme)
// ============================================================

let chatMessages = [];
let isGenerating = false;
let attachedFiles = [];
let cameraStream = null;
let useFrontCamera = false;
let currentZoom = 1.0;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.25;

// DOM
const chatArea = document.getElementById('chat-area');
const messagesEl = document.getElementById('messages');
const welcomeEl = document.getElementById('welcome');
const promptInput = document.getElementById('prompt-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const typingIndicator = document.getElementById('typing-indicator');
const providerBadge = document.getElementById('provider-badge');
const statusPill = document.getElementById('status-pill');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const openSidebarBtn = document.getElementById('open-sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');
const historyList = document.getElementById('history-list');
const attachPreview = document.getElementById('attach-preview');
const fileInput = document.getElementById('file-input');
const imageInput = document.getElementById('image-input');
const pluginsModal = document.getElementById('plugins-modal');
const cameraModal = document.getElementById('camera-modal');
const cameraVideo = document.getElementById('camera-video');
const cameraCanvas = document.getElementById('camera-canvas');
const zoomLabel = document.getElementById('zoom-label');

// ============================================================
// Init
// ============================================================
function init() {
  providerBadge.textContent = 'Black-Dragon';
  if (statusPill) statusPill.textContent = 'Black-Dragon';

  const savedTheme = localStorage.getItem('err0r-ai-theme');
  if (savedTheme) document.body.setAttribute('data-theme', savedTheme);
  updateThemeIcon();

  loadHistory();
  updateHistoryUI();
  promptInput.focus();
}

// ============================================================
// Rendering
// ============================================================
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAIResponse(text) {
  // Extract code blocks first (before HTML escape) so code stays raw then gets escaped inside
  const blocks = [];
  let work = String(text).replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const id = blocks.length;
    blocks.push({ lang: lang || 'text', code: code.replace(/\n$/, '') });
    return `\n%%CODEBLOCK_${id}%%\n`;
  });

  work = escapeHtml(work);

  // Inline code
  work = work.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
  // Bold + italic
  work = work.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  work = work.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  // Simple headers
  work = work.replace(/^### (.+)$/gm, '<div class="md-h3">$1</div>');
  work = work.replace(/^## (.+)$/gm, '<div class="md-h2">$1</div>');
  work = work.replace(/^# (.+)$/gm, '<div class="md-h1">$1</div>');
  // Unordered lists
  work = work.replace(/^[\-\*] (.+)$/gm, '<div class="md-li">• $1</div>');
  // Numbered lists
  work = work.replace(/^\d+\. (.+)$/gm, '<div class="md-li">$1</div>');
  // Links [text](url)
  work = work.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>');

  // Restore code blocks (code is escaped for safety)
  work = work.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => {
    const b = blocks[+i];
    return renderCodeBlock(b.lang, b.code);
  });

  return work.replace(/\n/g, '<br>');
}

function renderCodeBlock(language, code) {
  const safe = escapeHtml(code);
  return `<div class="code-block"><div class="code-header"><span>${escapeHtml(language)}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><pre><code>${safe}</code></pre></div>`;
}

function copyCode(btn) {
  const code = btn.closest('.code-block').querySelector('code').innerText;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = 'Copy'), 1500);
  }).catch(() => {
    // fallback
    btn.textContent = 'Failed';
    setTimeout(() => (btn.textContent = 'Copy'), 1500);
  });
}

// Lightweight toast (no more alert popups)
function showToast(message, type = 'info') {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = message;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 280);
  }, 2800);
}

function addMessage(role, text, skipSave = false, images = []) {
  if (welcomeEl && !welcomeEl.classList.contains('hidden')) {
    welcomeEl.classList.add('hidden');
  }

  const row = document.createElement('div');
  row.className = `msg-row ${role === 'user' ? 'user-row' : 'ai-row'}`;
  // Unique id so history can scroll to this message
  const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  row.id = msgId;
  row.dataset.role = role === 'user' ? 'user' : 'assistant';

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role === 'user' ? 'user-av' : 'ai-av'}`;
  avatar.textContent = role === 'user' ? 'U' : 'AI';

  const wrap = document.createElement('div');
  wrap.className = 'bubble-wrap';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  // Show real photos if any
  if (images && images.length) {
    const imgWrap = document.createElement('div');
    imgWrap.className = 'msg-images';
    images.forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Photo';
      img.className = 'msg-photo';
      img.loading = 'lazy';
      imgWrap.appendChild(img);
    });
    bubble.appendChild(imgWrap);
  }

  if (role === 'user') {
    if (text && text !== '[Photo attached]' && text !== '[Photo attached] 📷') {
      const txt = document.createElement('div');
      txt.className = 'msg-text';
      txt.textContent = text.replace(/\s*📷\s*$/, '').trim();
      if (txt.textContent) bubble.appendChild(txt);
    }
  } else {
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = formatAIResponse(text);
    bubble.appendChild(contentDiv);
  }

  wrap.appendChild(bubble);

  if (role === 'ai') {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const speakBtn = document.createElement('button');
    speakBtn.className = 'action-btn speak-btn';
    speakBtn.textContent = '🔊 Read';
    speakBtn.dataset.speaking = '0';
    speakBtn.onclick = () => toggleSpeak(text, speakBtn);
    actions.appendChild(speakBtn);
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
    };
    actions.appendChild(copyBtn);
    wrap.appendChild(actions);
  }

  row.appendChild(avatar);
  row.appendChild(wrap);
  messagesEl.appendChild(row);

  if (!skipSave) {
    chatMessages.push({ role: role === 'user' ? 'user' : 'assistant', content: text, msgId });
    saveHistory();
    updateHistoryUI();
  } else {
    // When loading from history, always bind fresh DOM id so history click works
    const last = chatMessages[chatMessages.length - 1];
    if (last) last.msgId = msgId;
  }

  scrollToBottom();
  return row;
}

// ============================================================
// History
// ============================================================
function saveHistory() {
  try {
    localStorage.setItem('err0r-ai-history', JSON.stringify(chatMessages));
  } catch (e) {
    console.warn('History save failed', e);
  }
}

function loadHistory() {
  try {
    const saved = localStorage.getItem('err0r-ai-history');
    if (!saved) return;
    const history = JSON.parse(saved);
    chatMessages = [];
    history.forEach(msg => {
      const uiRole = msg.role === 'user' ? 'user' : 'ai';
      // push first so addMessage (skipSave) can attach msgId back
      chatMessages.push(msg);
      addMessage(uiRole, msg.content, true);
    });
  } catch (e) {
    console.error('Load history failed', e);
  }
}

function scrollToMessage(msgId) {
  if (!msgId) return;
  const el = document.getElementById(msgId);
  if (!el) return;
  // Close sidebar on mobile so user sees the message
  closeSidebar();
  // Highlight briefly
  el.classList.add('history-highlight');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => el.classList.remove('history-highlight'), 1800);
}

function updateHistoryUI() {
  if (!historyList) return;
  historyList.innerHTML = '';
  const userMsgs = chatMessages.filter(m => m.role === 'user').slice(-12).reverse();
  if (!userMsgs.length) {
    historyList.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:12px;">No chats yet</div>';
    return;
  }
  userMsgs.forEach(msg => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const preview = typeof msg.content === 'string' ? msg.content : '[Image / mixed]';
    item.textContent = preview.slice(0, 42) + (preview.length > 42 ? '…' : '');
    item.title = preview;
    item.style.cursor = 'pointer';
    // Click → jump to that message in chat
    item.addEventListener('click', () => {
      if (msg.msgId) {
        scrollToMessage(msg.msgId);
      } else {
        // Fallback: find by matching text content
        const rows = messagesEl.querySelectorAll('.msg-row.user-row');
        for (const row of rows) {
          const txt = row.querySelector('.msg-text');
          if (txt && preview.startsWith(txt.textContent.slice(0, 30))) {
            closeSidebar();
            row.classList.add('history-highlight');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => row.classList.remove('history-highlight'), 1800);
            break;
          }
        }
      }
    });
    historyList.appendChild(item);
  });
}

// ============================================================
// TTS – Read / Stop (reliable). Single click = start/stop.
// Double-click also forces stop + reset. No unreliable pause/resume.
// ============================================================
let currentUtterance = null;
let activeSpeakBtn = null;
let ttsState = 'idle'; // idle | speaking
let lastClickTime = 0;
let lastClickBtn = null;
let currentSpeakText = '';
let speakClickTimer = null;

function resetSpeakBtn(btn) {
  if (btn) {
    btn.textContent = '🔊 Read';
    btn.dataset.speaking = '0';
  }
}

function stopSpeaking() {
  try {
    window.speechSynthesis.cancel();
  } catch (e) {}
  // Chrome sometimes needs a tiny delay before next speak works
  try {
    window.speechSynthesis.resume(); // clear any stuck paused state
  } catch (e) {}
  currentUtterance = null;
  ttsState = 'idle';
  currentSpeakText = '';
  if (activeSpeakBtn) {
    resetSpeakBtn(activeSpeakBtn);
    activeSpeakBtn = null;
  }
}

function pickVoice() {
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  const femaleKeywords = ['female', 'woman', 'girl', 'zira', 'samantha', 'susan', 'karen', 'moira', 'tessa', 'fiona', 'veena', 'heera', 'lekha', 'google हिन्दी', 'hindi', 'hi-IN'];
  let chosen = voices.find(v =>
    (v.lang.startsWith('en') || v.lang.startsWith('hi')) &&
    femaleKeywords.some(k => v.name.toLowerCase().includes(k.toLowerCase()))
  );
  if (!chosen) {
    chosen = voices.find(v =>
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('woman') ||
      (v.lang.startsWith('hi') && v.name.toLowerCase().includes('google'))
    );
  }
  if (!chosen) {
    chosen = voices.find(v => v.lang.startsWith('hi')) || voices.find(v => v.lang.startsWith('en')) || voices[0];
  }
  return chosen;
}

function startSpeaking(text, btn) {
  // Fully clean previous state so next speak always works
  try {
    window.speechSynthesis.cancel();
  } catch (e) {}
  try {
    window.speechSynthesis.resume();
  } catch (e) {}

  const clean = String(text)
    .replace(/```[\s\S]*?```/g, ' [Code] ')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return;

  const u = new SpeechSynthesisUtterance(clean);
  const voice = pickVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang || 'en-US';
  }
  u.pitch = 1.1;
  u.rate = 0.95;

  u.onend = () => {
    ttsState = 'idle';
    currentUtterance = null;
    currentSpeakText = '';
    if (btn) resetSpeakBtn(btn);
    if (activeSpeakBtn === btn) activeSpeakBtn = null;
  };
  u.onerror = (ev) => {
    // 'interrupted' is normal when we cancel; ignore it
    if (ev && ev.error === 'interrupted') return;
    ttsState = 'idle';
    currentUtterance = null;
    currentSpeakText = '';
    if (btn) resetSpeakBtn(btn);
    if (activeSpeakBtn === btn) activeSpeakBtn = null;
  };

  currentUtterance = u;
  activeSpeakBtn = btn;
  currentSpeakText = text;
  ttsState = 'speaking';
  if (btn) {
    btn.textContent = '⏹ Stop';
    btn.dataset.speaking = '1';
  }

  // Small delay helps after cancel() on some browsers
  setTimeout(() => {
    try {
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.warn('speak failed', e);
      stopSpeaking();
    }
  }, 40);
}

function toggleSpeak(text, btn) {
  const now = Date.now();
  const isDoubleClick = (lastClickBtn === btn && (now - lastClickTime) < 400);
  lastClickTime = now;
  lastClickBtn = btn;

  // Double-click → force full stop + reset (always works)
  if (isDoubleClick) {
    if (speakClickTimer) {
      clearTimeout(speakClickTimer);
      speakClickTimer = null;
    }
    stopSpeaking();
    return;
  }

  // Debounce single click slightly so double-click can cancel the first action
  if (speakClickTimer) clearTimeout(speakClickTimer);
  speakClickTimer = setTimeout(() => {
    speakClickTimer = null;

    // Same button already speaking → stop
    if (activeSpeakBtn === btn && ttsState === 'speaking') {
      stopSpeaking();
      return;
    }

    // Different button or idle → start this one
    if (activeSpeakBtn && activeSpeakBtn !== btn) {
      stopSpeaking();
    }
    startSpeaking(text, btn);
  }, 220);
}

// Keep old name for safety
function speakText(text) {
  const fakeBtn = { dataset: { speaking: '0' }, textContent: '' };
  toggleSpeak(text, fakeBtn);
}

// Voices load async on many browsers
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => { /* voices ready */ };
  try { window.speechSynthesis.getVoices(); } catch (e) {}
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

// ============================================================
// Send (with multimodal image support)
// ============================================================
async function sendMessage() {
  let userText = promptInput.value.trim();
  if ((!userText && attachedFiles.length === 0) || isGenerating) return;

  // Stop any ongoing TTS when sending
  if (typeof stopSpeaking === 'function') stopSpeaking();

  // Offline check
  if (!navigator.onLine) {
    showToast('Internet nahi hai. Connection check karo.', 'error');
    return;
  }

  // Build content for API (multimodal if images present)
  const hasImages = attachedFiles.some(f => f.type && f.type.startsWith('image/') && f.preview);
  let apiContent;
  let displayText;

  if (hasImages) {
    const parts = [];
    if (userText) {
      parts.push({ type: 'text', text: userText });
    } else {
      parts.push({ type: 'text', text: 'Please analyze this image carefully. Describe what you see, any text, errors, UI, or important details, and tell me what I can do next.' });
    }
    attachedFiles.forEach(f => {
      if (f.type && f.type.startsWith('image/') && f.preview) {
        parts.push({
          type: 'image_url',
          image_url: { url: f.preview }
        });
      } else if (f.content && f.content !== '[image]') {
        parts.push({ type: 'text', text: `--- File: ${f.name} ---\n${f.content}\n--- End ---` });
      }
    });
    apiContent = parts;
    displayText = userText || '📷 Photo';
  } else {
    // Text + files only
    if (attachedFiles.length > 0) {
      const parts = attachedFiles.map(f => {
        if (f.type && f.type.startsWith('image/')) {
          return `[Image: ${f.name}]`;
        }
        return `--- File: ${f.name} ---\n${f.content}\n--- End ---`;
      });
      userText = (userText ? userText + '\n\n' : '') + parts.join('\n\n');
    }
    apiContent = userText;
    displayText = userText.length > 600 ? userText.slice(0, 600) + '…' : userText;
  }

  // Collect real image previews to show in chat
  const imagePreviews = attachedFiles
    .filter(f => f.type && f.type.startsWith('image/') && f.preview)
    .map(f => f.preview);

  promptInput.value = '';
  autoResize();
  sendBtn.disabled = true;
  clearAttachments();

  addMessage('user', displayText, false, imagePreviews);
  // Keep full content in history
  if (chatMessages.length && chatMessages[chatMessages.length - 1].role === 'user') {
    chatMessages[chatMessages.length - 1].content = typeof apiContent === 'string' ? apiContent : displayText;
    saveHistory();
  }

  isGenerating = true;
  if (typingIndicator) {
    typingIndicator.classList.remove('hidden');
    scrollToBottom();
  }
  if (statusPill) statusPill.textContent = 'Thinking…';

  try {
    const response = await getAIResponse(apiContent);
    addMessage('ai', response);
  } catch (err) {
    console.error(err); // full error only in browser console (for developer)
    addMessage('ai', friendlyErrorMessage(err));
  } finally {
    isGenerating = false;
    if (typingIndicator) typingIndicator.classList.add('hidden');
    sendBtn.disabled = false;
    if (statusPill) statusPill.textContent = 'Black-Dragon';
    updateSendButton();
    promptInput.focus();
  }
}

/** User-facing error only — no API keys, model names, or raw JSON */
function friendlyErrorMessage(err) {
  const msg = String(err && err.message ? err.message : err || '').toLowerCase();

  // Rate limit / 429
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('rate_limit') || msg.includes('tokens per minute') || msg.includes('otpm')) {
    return '⏳ Server busy hai. Thodi der (10–15 sec) baad dubara try karo.';
  }

  // Network / fetch failures
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('net::') ||
    msg.includes('load failed') ||
    msg.includes('networkerror') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  ) {
    return '📡 Network problem. Apna internet connection check karo aur dubara try karo.';
  }

  // Auth / API key issues
  if (msg.includes('401') || msg.includes('403') || msg.includes('invalid api') || msg.includes('api key') || msg.includes('unauthorized')) {
    return '🔑 Connection issue. Thodi der baad try karo.';
  }

  // Server errors
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
    return '🛠️ Server temporarily down hai. Thodi der baad try karo.';
  }

  // Generic fallback — still no technical dump
  return '⚠️ Kuch problem aa gayi. Internet check karo aur thodi der baad dubara try karo.';
}

// ============================================================
// API
// ============================================================
async function getAIResponse(userContent) {
  const provider = CONFIG.API_PROVIDER;
  if (provider === 'mock') return mockResponse(typeof userContent === 'string' ? userContent : '[image]');
  if (provider === 'openai') return callOpenAI(userContent);
  if (provider === 'gemini') return callGemini(userContent);
  if (provider === 'groq') return callGroq(userContent);
  throw new Error('Unknown provider: ' + provider);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function callGroq(userContent) {
  if (!CONFIG.API_KEY || CONFIG.API_KEY.includes('YOUR_')) {
    throw new Error('Set your Groq API key in config.js');
  }

  // Build messages – support multimodal content
  const messages = [
    { role: 'system', content: CONFIG.SYSTEM_PROMPT }
  ];

  // Previous text-only history (keep last ~12 turns to reduce tokens)
  const prior = chatMessages.slice(0, -1).slice(-12);
  prior.forEach(m => {
    messages.push({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : String(m.content)
    });
  });

  // Current user message (can be string or array of parts)
  messages.push({
    role: 'user',
    content: userContent
  });

  const body = JSON.stringify({
    model: CONFIG.MODEL.groq,
    temperature: CONFIG.TEMPERATURE,
    max_tokens: CONFIG.MAX_TOKENS,
    messages
  });

  // Auto-retry on rate limit (429) up to 3 times
  const maxAttempts = 3;
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(CONFIG.API_ENDPOINT.groq, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.API_KEY}`
      },
      body
    });

    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content;
    }

    const errText = await res.text();
    lastErr = new Error('Groq ' + res.status + ': ' + errText);

    // Rate limit → wait and retry
    if (res.status === 429 && attempt < maxAttempts) {
      // Parse "try again in X.Ys" if present, else default wait
      let waitMs = 9000 * attempt;
      const m = errText.match(/try again in ([\d.]+)\s*s/i);
      if (m) waitMs = Math.ceil(parseFloat(m[1]) * 1000) + 500;
      if (statusPill) statusPill.textContent = 'Waiting ' + Math.ceil(waitMs / 1000) + 's…';
      await sleep(waitMs);
      if (statusPill) statusPill.textContent = 'Thinking…';
      continue;
    }

    throw lastErr;
  }
  throw lastErr || new Error('Groq request failed');
}

async function callOpenAI(userContent) {
  const res = await fetch(CONFIG.API_ENDPOINT.openai, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.API_KEY}`
    },
    body: JSON.stringify({
      model: CONFIG.MODEL.openai,
      temperature: CONFIG.TEMPERATURE,
      max_tokens: CONFIG.MAX_TOKENS,
      messages: [
        { role: 'system', content: CONFIG.SYSTEM_PROMPT },
        ...chatMessages.slice(0, -1),
        { role: 'user', content: userContent }
      ]
    })
  });
  if (!res.ok) throw new Error('OpenAI ' + res.status + ': ' + await res.text());
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callGemini(userContent) {
  const url = CONFIG.API_ENDPOINT.gemini + '?key=' + CONFIG.API_KEY;
  const text = typeof userContent === 'string' ? userContent : JSON.stringify(userContent);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: CONFIG.SYSTEM_PROMPT + '\n\nUser: ' + text }] }],
      generationConfig: { temperature: CONFIG.TEMPERATURE, maxOutputTokens: CONFIG.MAX_TOKENS }
    })
  });
  if (!res.ok) throw new Error('Gemini ' + res.status + ': ' + await res.text());
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

function mockResponse(userText) {
  return new Promise(r => {
    setTimeout(() => {
      r('**Demo Mode**\n\nYou asked about: "' + String(userText).slice(0, 60) + '..."\n\nPut a real Groq key in config.js to get live answers.\nModel: `qwen/qwen3.8-27b` (vision ready)');
    }, CONFIG.MOCK_DELAY);
  });
}

// ============================================================
// Attachments
// ============================================================
function addFilesFromList(fileList, forceImage) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  files.forEach(file => {
    const isImg = forceImage || (file.type && file.type.startsWith('image/'));
    if (file.size > 8 * 1024 * 1024) {
      showToast('Max 8MB per file', 'error');
      return;
    }
    // Skip non-text for file mode (except images)
    if (!isImg && file.type && !file.type.startsWith('text/') && !/\.(txt|md|js|py|json|csv|log|html|css|xml|sh)$/i.test(file.name)) {
      showToast('Unsupported file type: ' + file.name, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      attachedFiles.push({
        name: file.name || (isImg ? 'photo.jpg' : 'file.txt'),
        type: file.type || (isImg ? 'image/jpeg' : 'text/plain'),
        content: isImg ? '[image]' : ev.target.result,
        preview: isImg ? ev.target.result : null
      });
      renderAttachPreview();
      updateSendButton();
    };
    reader.onerror = () => showToast('File read failed', 'error');
    if (isImg) reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}

function handleFileSelect(e, isImage) {
  addFilesFromList(e.target.files, isImage);
  e.target.value = '';
}

function renderAttachPreview() {
  if (!attachedFiles.length) {
    attachPreview.classList.add('hidden');
    attachPreview.innerHTML = '';
    return;
  }
  attachPreview.classList.remove('hidden');
  attachPreview.innerHTML = attachedFiles.map((f, i) => `
    <div class="attach-chip">
      ${f.preview ? `<img src="${f.preview}" alt="">` : '📄'}
      <span>${f.name}</span>
      <button class="remove" data-idx="${i}">✕</button>
    </div>
  `).join('');
  attachPreview.querySelectorAll('.remove').forEach(btn => {
    btn.onclick = () => {
      attachedFiles.splice(+btn.dataset.idx, 1);
      renderAttachPreview();
      updateSendButton();
    };
  });
}

function clearAttachments() {
  attachedFiles = [];
  renderAttachPreview();
}

// ============================================================
// Live Camera + Zoom
// ============================================================
async function openCamera() {
  try {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }
    currentZoom = 1.0;
    updateZoomUI();
    const constraints = {
      video: {
        facingMode: useFrontCamera ? 'user' : 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraVideo.srcObject = cameraStream;
    cameraVideo.style.transform = `scale(${currentZoom})`;
    cameraModal.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert('Camera access denied or not available. Opening gallery instead.');
    imageInput.click();
  }
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  cameraVideo.srcObject = null;
  cameraVideo.style.transform = 'scale(1)';
  currentZoom = 1.0;
  updateZoomUI();
  cameraModal.classList.add('hidden');
}

function updateZoomUI() {
  if (zoomLabel) zoomLabel.textContent = currentZoom.toFixed(1) + 'x';
  if (cameraVideo) {
    cameraVideo.style.transform = `scale(${currentZoom})`;
  }
}

function zoomIn() {
  if (currentZoom < MAX_ZOOM) {
    currentZoom = Math.min(MAX_ZOOM, currentZoom + ZOOM_STEP);
    updateZoomUI();
  }
}

function zoomOut() {
  if (currentZoom > MIN_ZOOM) {
    currentZoom = Math.max(MIN_ZOOM, currentZoom - ZOOM_STEP);
    updateZoomUI();
  }
}

function capturePhoto() {
  if (!cameraStream) return;
  const video = cameraVideo;
  const canvas = cameraCanvas;
  const w = video.videoWidth;
  const h = video.videoHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Apply digital zoom by cropping center
  if (currentZoom > 1) {
    const sw = w / currentZoom;
    const sh = h / currentZoom;
    const sx = (w - sw) / 2;
    const sy = (h - sh) / 2;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    ctx.drawImage(video, 0, 0, w, h);
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const name = 'camera-' + Date.now() + '.jpg';
  attachedFiles.push({
    name,
    type: 'image/jpeg',
    content: '[image]',
    preview: dataUrl
  });
  renderAttachPreview();
  updateSendButton();
  closeCamera();
}

async function switchCamera() {
  useFrontCamera = !useFrontCamera;
  await openCamera();
}

// ============================================================
// Helpers
// ============================================================
function autoResize() {
  promptInput.style.height = 'auto';
  promptInput.style.height = Math.min(promptInput.scrollHeight, 140) + 'px';
}

function updateSendButton() {
  sendBtn.disabled = isGenerating || (!promptInput.value.trim() && attachedFiles.length === 0);
}

function resetChat() {
  if (chatMessages.length > 0) {
    const ok = confirm('Purani chat clear karna hai?');
    if (!ok) return;
  }
  if (typeof stopSpeaking === 'function') stopSpeaking();
  chatMessages = [];
  localStorage.removeItem('err0r-ai-history');
  messagesEl.innerHTML = '';
  welcomeEl.classList.remove('hidden');
  promptInput.value = '';
  clearAttachments();
  autoResize();
  updateSendButton();
  updateHistoryUI();
  promptInput.focus();
  closeSidebar();
  showToast('New chat started', 'info');
}

function openSidebar() {
  sidebar.classList.add('open');
  if (sidebarOverlay) sidebarOverlay.classList.remove('hidden');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('err0r-ai-theme', next);
  updateThemeIcon();
}

function updateThemeIcon() {
  const theme = document.body.getAttribute('data-theme') || 'dark';
  themeIcon.innerHTML = theme === 'dark'
    ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor"/>'
    : '<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2"/>';
}

// Speech
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add('recording');
    promptInput.placeholder = 'Listening…';
  };
  recognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove('recording');
    promptInput.placeholder = 'Message Err0r-AI...';
  };
  recognition.onresult = (e) => {
    promptInput.value += (promptInput.value ? ' ' : '') + e.results[0][0].transcript;
    autoResize();
    updateSendButton();
  };
  recognition.onerror = () => {
    isRecording = false;
    micBtn.classList.remove('recording');
  };
} else {
  micBtn.style.display = 'none';
}

function toggleRecording() {
  if (!recognition) return;
  // Stop any ongoing Read/TTS when mic is used
  if (typeof stopSpeaking === 'function') stopSpeaking();
  if (isRecording) recognition.stop();
  else recognition.start();
}

// ============================================================
// Events
// ============================================================
sendBtn.addEventListener('click', sendMessage);
micBtn.addEventListener('click', toggleRecording);
newChatBtn.addEventListener('click', resetChat);
themeToggle.addEventListener('click', toggleTheme);

promptInput.addEventListener('input', () => {
  autoResize();
  updateSendButton();
});
// Enter = send · Shift+Enter = new line (ChatGPT style)
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Paste image from clipboard (Ctrl+V / long-press paste)
promptInput.addEventListener('paste', (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  const imageFiles = [];
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) imageFiles.push(f);
    }
  }
  if (imageFiles.length) {
    e.preventDefault();
    addFilesFromList(imageFiles, true);
    showToast('Photo pasted', 'info');
  }
});

// Drag & drop images / files onto chat area
['dragenter', 'dragover'].forEach(ev => {
  chatArea.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatArea.classList.add('drag-over');
  });
});
['dragleave', 'drop'].forEach(ev => {
  chatArea.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatArea.classList.remove('drag-over');
  });
});
chatArea.addEventListener('drop', (e) => {
  const files = e.dataTransfer && e.dataTransfer.files;
  if (files && files.length) {
    addFilesFromList(files, false);
    showToast(files.length + ' file(s) attached', 'info');
  }
});

// Escape closes modals / sidebar / plus menu
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!cameraModal.classList.contains('hidden')) {
    closeCamera();
    return;
  }
  if (!pluginsModal.classList.contains('hidden')) {
    pluginsModal.classList.add('hidden');
    return;
  }
  closePlusMenu();
  closeSidebar();
});

// Online / offline
window.addEventListener('online', () => showToast('Internet wapas aa gaya', 'success'));
window.addEventListener('offline', () => showToast('Internet disconnect ho gaya', 'error'));

// Suggestion cards
document.querySelectorAll('.suggestion-card').forEach(card => {
  card.addEventListener('click', () => {
    promptInput.value = card.dataset.prompt || '';
    autoResize();
    updateSendButton();
    sendMessage();
  });
});

// Sidebar
if (openSidebarBtn) openSidebarBtn.addEventListener('click', openSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

// File / Image inputs
fileInput.addEventListener('change', (e) => handleFileSelect(e, false));
imageInput.addEventListener('change', (e) => handleFileSelect(e, true));

// Camera modal controls
document.getElementById('close-camera').addEventListener('click', closeCamera);
document.getElementById('capture-btn').addEventListener('click', capturePhoto);
document.getElementById('switch-cam-btn').addEventListener('click', switchCamera);
document.getElementById('zoom-in-btn').addEventListener('click', zoomIn);
document.getElementById('zoom-out-btn').addEventListener('click', zoomOut);
cameraModal.addEventListener('click', (e) => {
  if (e.target === cameraModal) closeCamera();
});

// Plugins modal
document.getElementById('close-plugins').addEventListener('click', () => {
  pluginsModal.classList.add('hidden');
});
pluginsModal.addEventListener('click', (e) => {
  if (e.target === pluginsModal) pluginsModal.classList.add('hidden');
});
document.querySelectorAll('#plugins-grid .plugin-card').forEach(card => {
  card.addEventListener('click', () => {
    const prompt = card.getAttribute('data-prompt');
    if (prompt) {
      pluginsModal.classList.add('hidden');
      promptInput.value = prompt;
      autoResize();
      updateSendButton();
      sendMessage();
    }
  });
});

// ===== Plus (+) menu =====
const plusBtn = document.getElementById('plus-btn');
const plusMenu = document.getElementById('plus-menu');

function closePlusMenu() {
  if (plusMenu) plusMenu.classList.add('hidden');
  if (plusBtn) plusBtn.classList.remove('active');
}

if (plusBtn && plusMenu) {
  plusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !plusMenu.classList.contains('hidden');
    if (isOpen) {
      closePlusMenu();
    } else {
      plusMenu.classList.remove('hidden');
      plusBtn.classList.add('active');
    }
  });

  document.getElementById('menu-camera').addEventListener('click', () => {
    closePlusMenu();
    openCamera();
  });
  document.getElementById('menu-photo').addEventListener('click', () => {
    closePlusMenu();
    imageInput.click(); // opens phone gallery / file picker
  });
  document.getElementById('menu-file').addEventListener('click', () => {
    closePlusMenu();
    fileInput.click();
  });
  document.getElementById('menu-plugins').addEventListener('click', () => {
    closePlusMenu();
    pluginsModal.classList.remove('hidden');
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!plusBtn.contains(e.target) && !plusMenu.contains(e.target)) {
      closePlusMenu();
    }
  });
}

// Start
init();
