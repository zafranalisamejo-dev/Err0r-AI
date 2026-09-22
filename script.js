// ============================================================
// Err0r-AI Pro – Black-Dragon
// ============================================================

let chatMessages = [];
let isGenerating = false;
let attachedFiles = [];
let cameraStream = null;
let useFrontCamera = false;

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
  let escaped = escapeHtml(text);
  const codeBlockRegex = /```([\w+-]*)\n?([\s\S]*?)```/g;
  escaped = escaped.replace(codeBlockRegex, (_, lang, code) => {
    return renderCodeBlock(lang || 'text', code);
  });
  escaped = escaped.replace(/`([^`\n]+)`/g, '<code style="background:var(--bg-input);padding:2px 6px;border-radius:5px;font-family:var(--mono);font-size:13px;">$1</code>');
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return escaped.replace(/\n/g, '<br>');
}

function renderCodeBlock(language, code) {
  const trimmed = code.replace(/\n$/, '');
  return `<div class="code-block"><div class="code-header"><span>${language}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><pre><code>${trimmed}</code></pre></div>`;
}

function copyCode(btn) {
  const code = btn.closest('.code-block').querySelector('code').innerText;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => (btn.textContent = 'Copy'), 1500);
  });
}

function addMessage(role, text, skipSave = false) {
  if (welcomeEl && !welcomeEl.classList.contains('hidden')) {
    welcomeEl.classList.add('hidden');
  }

  const row = document.createElement('div');
  row.className = `msg-row ${role === 'user' ? 'user-row' : 'ai-row'}`;

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role === 'user' ? 'user-av' : 'ai-av'}`;
  avatar.textContent = role === 'user' ? 'U' : 'AI';

  const wrap = document.createElement('div');
  wrap.className = 'bubble-wrap';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (role === 'user') {
    bubble.textContent = text;
  } else {
    bubble.innerHTML = formatAIResponse(text);
  }
  wrap.appendChild(bubble);

  if (role === 'ai') {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const speakBtn = document.createElement('button');
    speakBtn.className = 'action-btn';
    speakBtn.textContent = '🔊 Read';
    speakBtn.onclick = () => speakText(text);
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
    chatMessages.push({ role: role === 'user' ? 'user' : 'assistant', content: text });
    saveHistory();
    updateHistoryUI();
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
      addMessage(uiRole, msg.content, true);
      chatMessages.push(msg);
    });
  } catch (e) {
    console.error('Load history failed', e);
  }
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
    item.textContent = msg.content.slice(0, 42) + (msg.content.length > 42 ? '…' : '');
    item.title = msg.content;
    historyList.appendChild(item);
  });
}

// ============================================================
// TTS
// ============================================================
function speakText(text) {
  window.speechSynthesis.cancel();
  const clean = text
    .replace(/```[\s\S]*?```/g, ' [Code] ')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\n/g, ' ');
  const u = new SpeechSynthesisUtterance(clean);
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) {
    u.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
  }
  window.speechSynthesis.speak(u);
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatArea.scrollTop = chatArea.scrollHeight;
  });
}

// ============================================================
// Send
// ============================================================
async function sendMessage() {
  let userText = promptInput.value.trim();
  if ((!userText && attachedFiles.length === 0) || isGenerating) return;

  if (attachedFiles.length > 0) {
    const parts = attachedFiles.map(f => {
      if (f.type && f.type.startsWith('image/')) {
        return `[Image attached: ${f.name}] (Current model is text-only – please describe what you need from this image.)`;
      }
      return `--- File: ${f.name} ---\n${f.content}\n--- End ---`;
    });
    userText = (userText ? userText + '\n\n' : '') + parts.join('\n\n');
  }

  const displayText = userText.length > 600 ? userText.slice(0, 600) + '…' : userText;

  promptInput.value = '';
  autoResize();
  sendBtn.disabled = true;
  clearAttachments();

  addMessage('user', displayText);
  // keep full text in history for API
  if (chatMessages.length && chatMessages[chatMessages.length - 1].role === 'user') {
    chatMessages[chatMessages.length - 1].content = userText;
    saveHistory();
  }

  isGenerating = true;
  if (typingIndicator) {
    typingIndicator.classList.remove('hidden');
    scrollToBottom();
  }
  if (statusPill) statusPill.textContent = 'Thinking…';

  try {
    const response = await getAIResponse(userText);
    addMessage('ai', response);
  } catch (err) {
    console.error(err);
    addMessage('ai', '⚠️ Error: ' + (err.message || 'Unknown error') +
      '\n\nTips:\n• Check API key in config.js\n• Model must be openai/gpt-oss-20b\n• Check network / rate limits');
  } finally {
    isGenerating = false;
    if (typingIndicator) typingIndicator.classList.add('hidden');
    sendBtn.disabled = false;
    if (statusPill) statusPill.textContent = 'Black-Dragon';
    updateSendButton();
  }
}

// ============================================================
// API
// ============================================================
async function getAIResponse(userText) {
  const provider = CONFIG.API_PROVIDER;
  if (provider === 'mock') return mockResponse(userText);
  if (provider === 'openai') return callOpenAI(userText);
  if (provider === 'gemini') return callGemini(userText);
  if (provider === 'groq') return callGroq(userText);
  throw new Error('Unknown provider: ' + provider);
}

async function callGroq(userText) {
  if (!CONFIG.API_KEY || CONFIG.API_KEY.includes('YOUR_')) {
    throw new Error('Set your Groq API key in config.js');
  }
  const res = await fetch(CONFIG.API_ENDPOINT.groq, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.API_KEY}`
    },
    body: JSON.stringify({
      model: CONFIG.MODEL.groq,
      temperature: CONFIG.TEMPERATURE,
      max_tokens: CONFIG.MAX_TOKENS,
      messages: [
        { role: 'system', content: CONFIG.SYSTEM_PROMPT },
        ...chatMessages.slice(0, -1),
        { role: 'user', content: userText }
      ]
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Groq ' + res.status + ': ' + err);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callOpenAI(userText) {
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
        { role: 'user', content: userText }
      ]
    })
  });
  if (!res.ok) throw new Error('OpenAI ' + res.status + ': ' + await res.text());
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callGemini(userText) {
  const url = CONFIG.API_ENDPOINT.gemini + '?key=' + CONFIG.API_KEY;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: CONFIG.SYSTEM_PROMPT + '\n\nUser: ' + userText }] }],
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
      r('**Demo Mode**\n\nYou asked about: "' + userText.slice(0, 60) + '..."\n\nPut a real Groq key in config.js to get live answers.\nModel: `openai/gpt-oss-20b`');
    }, CONFIG.MOCK_DELAY);
  });
}

// ============================================================
// Attachments
// ============================================================
function handleFileSelect(e, isImage) {
  const files = Array.from(e.target.files || []);
  files.forEach(file => {
    if (file.size > 3 * 1024 * 1024) {
      alert('Max 3MB per file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      attachedFiles.push({
        name: file.name,
        type: file.type,
        content: isImage ? '[image]' : ev.target.result,
        preview: isImage ? ev.target.result : null
      });
      renderAttachPreview();
      updateSendButton();
    };
    if (isImage) reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
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
// Live Camera
// ============================================================
async function openCamera() {
  try {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
    }
    const constraints = {
      video: { facingMode: useFrontCamera ? 'user' : 'environment' },
      audio: false
    };
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraVideo.srcObject = cameraStream;
    cameraModal.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert('Camera access denied or not available. Falling back to file picker.');
    imageInput.click();
  }
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  cameraVideo.srcObject = null;
  cameraModal.classList.add('hidden');
}

function capturePhoto() {
  if (!cameraStream) return;
  const video = cameraVideo;
  const canvas = cameraCanvas;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
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
promptInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

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
    imageInput.click();
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
