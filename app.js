/* ==========================================================
   OmniTalk PRO v10.0 — app.js
   Application Controller & Workspace Tools Manager
   Features:
   - Live Gemini Voice & Cloud Neural TTS Audio Playback
   - API Key Test & Verification with Live Status Badge
   - Walkie-Talkie Face-to-Face PTT with GBoard-style Live Streaming
   - Gemini Live Bilateral Simultaneous Voice-to-Voice Interpreter
   - Force Cache Wipe & Reload Control
========================================================== */

const APP_VERSION = 'PRO v10.2.0 (Build 2026.08.16.12)';

const state = {
  activeTab: 'chats',
  currentSubView: null,
  langA: typeof langByCode === 'function' ? langByCode('en') : { code:'en', name:'English', flag:'🇺🇸', ttsLocale:'en-US' },
  langB: typeof langByCode === 'function' ? langByCode('my') : { code:'my', name:'Myanmar', flag:'🇲🇲', ttsLocale:'my-MM' },
  messages: [],
  apiKey: '', // kept for back-compat reads; source of truth is apiKeys[apiKeyIndex]
  apiKeys: ['', '', ''],
  apiKeyIndex: 0,
  exhaustedKeysToday: {},
  aiModel: 'gemini-3.6-flash',
  aiDomain: 'general',
  uiLanguage: 'my',
  autoTranslate: true,
  autoTranscribe: true,
  autoSpeak: false,
  autoSpeakWalkie: true,
  soundEffects: true,
  voiceSpeed: 1.0,
  isLiveActive: false,
  activePhraseCategory: 'all'
};

/* =========================================================
   HARDWARE & BROWSER BACK BUTTON NAVIGATION (History API)
========================================================= */
function pushNavigationState(viewName){
  state.currentSubView = viewName;
  try {
    history.pushState({ view: viewName }, '', '');
  } catch(e){}
}

window.addEventListener('popstate', (e) => {
  const chatRoom = document.getElementById('chatRoomView');
  const addModal = document.getElementById('addFriendModal');
  const groupModal = document.getElementById('createGroupModal');
  const qrModal = document.getElementById('qrModal');

  if(chatRoom && chatRoom.style.display !== 'none'){
    chatRoom.style.display = 'none';
    state.currentSubView = null;
    return;
  }

  if(addModal && addModal.classList.contains('show')){
    addModal.classList.remove('show');
    state.currentSubView = null;
    return;
  }
  if(groupModal && groupModal.classList.contains('show')){
    groupModal.classList.remove('show');
    state.currentSubView = null;
    return;
  }
  if(qrModal && qrModal.classList.contains('show')){
    qrModal.classList.remove('show');
    state.currentSubView = null;
    return;
  }

  const views = ['viewWalkieTalkie', 'viewQuickTranslate', 'viewLiveInterpreter', 'viewPhrasebook'];
  let toolOpen = false;
  views.forEach(id => {
    const el = document.getElementById(id);
    if(el && el.style.display !== 'none'){
      el.style.display = 'none';
      toolOpen = true;
    }
  });

  if(toolOpen){
    closeWorkspaceTool(false);
    return;
  }

  if(state.activeTab !== 'chats'){
    showTab('chats', false);
  }
});

/* =========================================================
   TOAST & UTILITIES
========================================================= */
function showToast(message, type){
  const container = document.getElementById('toastContainer');
  if(!container) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

function vibrate(ms = 10){
  try { if(navigator.vibrate) navigator.vibrate(ms); } catch(e){}
}

let sfxAudioCtx = null;
/** Short UI beep for message send/receive — gated by the Sound Effects
    toggle in Settings. Uses a Web Audio oscillator, no external file. */
function playSfx(kind = 'send'){
  if(typeof state !== 'undefined' && state.soundEffects === false) return;
  try{
    if(!sfxAudioCtx) sfxAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = sfxAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = kind === 'receive' ? 660 : 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  }catch(e){}
}

function formatTime(ts){
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if(h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

function escapeHtml(str){
  if(!str) return '';
  const d = document.createElement('div');
  d.innerText = str;
  return d.innerHTML;
}

/* =========================================================
   HIGH-ACCURACY AUDIO & CLOUD TTS ENGINE
========================================================= */
let globalAudioPlayer = null;

function primeAudioOnUserGesture(){
  if(window.speechSynthesis){
    try { window.speechSynthesis.resume(); } catch(e){}
  }
}

/** Master Voice TTS Player (Cloud Neural Audio + Web Speech API) */
function speakText(text, langCode){
  if(!text || !text.trim()) return;
  const clean = text.trim();
  const sLang = langCode || 'my';

  if(globalAudioPlayer){
    try { globalAudioPlayer.pause(); globalAudioPlayer = null; } catch(e){}
  }
  if(window.speechSynthesis){
    try { window.speechSynthesis.cancel(); } catch(e){}
  }

  // Cloud Neural Audio Stream (Instant human-like voice for Myanmar, Thai, Chinese, English)
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${sLang}&client=tw-ob&q=${encodeURIComponent(clean.slice(0, 200))}`;
  
  try {
    globalAudioPlayer = new Audio(ttsUrl);
    globalAudioPlayer.playbackRate = state.voiceSpeed || 1.0;
    
    globalAudioPlayer.play().then(() => {
      console.log('Playing Cloud TTS audio for:', sLang);
    }).catch(err => {
      console.warn('Cloud audio blocked by autoplay, using WebSpeech fallback:', err);
      fallbackWebSpeechTTS(clean, sLang);
    });
  } catch(e) {
    fallbackWebSpeechTTS(clean, sLang);
  }
}

function fallbackWebSpeechTTS(text, langCode){
  if(!window.speechSynthesis) return;
  try {
    window.speechSynthesis.resume();
    const ut = new SpeechSynthesisUtterance(text);
    const langObj = langByCode(langCode);
    const targetLocale = langObj ? langObj.ttsLocale : (langCode === 'my' ? 'my-MM' : langCode);
    ut.lang = targetLocale;
    ut.rate = state.voiceSpeed || 1.0;

    const voices = window.speechSynthesis.getVoices();
    if(voices && voices.length){
      const match = voices.find(v => v.lang.startsWith(targetLocale.slice(0, 2)) || v.lang.startsWith(langCode));
      if(match) ut.voice = match;
    }
    window.speechSynthesis.speak(ut);
  } catch(e){}
}

/* =========================================================
   GEMINI API KEY TEST & VERIFICATION
========================================================= */
async function testGeminiApiKey(key){
  const badge = document.getElementById('apiKeyStatusBadge');
  if(!badge) return false;

  const testKey = (key || '').trim();
  if(!testKey){
    badge.textContent = 'Status: No Key Entered (Using MyMemory/Offline Fallback)';
    badge.style.color = '#94A3B8';
    return false;
  }

  badge.innerHTML = '<span style="color:#38BDF8;">⏳ Testing Gemini API connection...</span>';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${testKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello' }] }],
        generationConfig: { temperature: 0.1 }
      })
    });

    if(res.ok){
      badge.innerHTML = '<span style="color:#34D399; font-weight:800;">✅ Active &amp; Verified! (Gemini 3.6 Connected)</span>';
      showToast('✅ Gemini API Key verified and active!', 'success');
      return true;
    } else {
      const errData = await res.json();
      const msg = errData?.error?.message || 'Invalid Key / Permission Denied';
      badge.innerHTML = `<span style="color:#EF4444; font-weight:800;">❌ Error: ${escapeHtml(msg.slice(0, 45))}</span>`;
      showToast('API Key Error: ' + msg.slice(0, 40), 'error');
      return false;
    }
  } catch(err){
    badge.innerHTML = '<span style="color:#EF4444; font-weight:800;">❌ Network / Key Verification Failed</span>';
    return false;
  }
}

/* =========================================================
   UI INTERNATIONALIZATION (i18n)
========================================================= */
function applyUILanguage(){
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if(key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if(key) el.placeholder = t(key);
  });
  document.documentElement.lang = state.uiLanguage;

  const headerLangEl = document.getElementById('headerTargetLang');
  if(headerLangEl){
    const map = { my: '🇲🇲 MM', en: '🇺🇸 EN', zh: '🇨🇳 ZH', th: '🇹🇭 TH' };
    headerLangEl.textContent = map[state.uiLanguage] || state.uiLanguage.toUpperCase();
  }
}

/* =========================================================
   TAB NAVIGATION (WeChat/DingTalk Style)
========================================================= */
function showTab(tabName, pushState = true){
  primeAudioOnUserGesture();
  state.activeTab = tabName;
  closeWorkspaceTool(false);

  document.querySelectorAll('.navTabBtn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tabContent').forEach(content => {
    content.style.display = 'none';
  });

  const target = document.getElementById(`tabContent${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
  if(target) target.style.display = 'block';

  if(pushState) pushNavigationState('tab_' + tabName);
}

/* =========================================================
   WORKSPACE SUB-TOOL CONTROLLER
========================================================= */
function openWorkspaceTool(viewName){
  primeAudioOnUserGesture();
  document.querySelectorAll('.tabContent').forEach(c => c.style.display = 'none');
  closeWorkspaceTool(false);
  pushNavigationState('tool_' + viewName);

  if(viewName === 'walkie'){
    const el = document.getElementById('viewWalkieTalkie');
    if(el) el.style.display = 'flex';
    initWalkieTalkieUI();
  } else if(viewName === 'quick'){
    const el = document.getElementById('viewQuickTranslate');
    if(el) el.style.display = 'flex';
    initQuickTranslateUI();
  } else if(viewName === 'live'){
    const el = document.getElementById('viewLiveInterpreter');
    if(el) el.style.display = 'flex';
    initLiveInterpreterUI();
  } else if(viewName === 'phrasebook'){
    const el = document.getElementById('viewPhrasebook');
    if(el) el.style.display = 'flex';
    initPhrasebookUI();
  }
}

function closeWorkspaceTool(handleHistory = true){
  const views = ['viewWalkieTalkie', 'viewQuickTranslate', 'viewLiveInterpreter', 'viewPhrasebook'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.style.display = 'none';
  });

  if(state.isLiveActive) stopLiveInterpreter();

  if(state.activeTab === 'tools'){
    const toolsTab = document.getElementById('tabContentTools');
    if(toolsTab) toolsTab.style.display = 'block';
  }
}

/* =========================================================
   1. WALKIE-TALKIE PTT & GBOARD-STYLE LIVE STREAMING
========================================================= */
function initWalkieTalkieUI(){
  const selA = document.getElementById('walkieLangA');
  const selB = document.getElementById('walkieLangB');
  if(!selA || !selB) return;

  selA.innerHTML = '';
  selB.innerHTML = '';
  LANGUAGES.forEach(l => {
    selA.appendChild(new Option(langOptionLabel(l), l.code));
    selB.appendChild(new Option(langOptionLabel(l), l.code));
  });

  selA.value = state.langA.code || 'en';
  selB.value = state.langB.code || 'my';

  selA.onchange = e => { state.langA = langByCode(e.target.value); };
  selB.onchange = e => { state.langB = langByCode(e.target.value); };

  // Swap Button
  document.getElementById('walkieSwapLangsBtn').onclick = () => {
    const tmp = selA.value;
    selA.value = selB.value;
    selB.value = tmp;
    state.langA = langByCode(selA.value);
    state.langB = langByCode(selB.value);
    vibrate(12);
    showToast('Languages swapped!');
  };

  // Auto Speak Toggle
  const autoBtn = document.getElementById('walkieAutoSpeakToggle');
  if(autoBtn){
    autoBtn.onclick = () => {
      state.autoSpeakWalkie = !state.autoSpeakWalkie;
      autoBtn.textContent = state.autoSpeakWalkie ? '🔊 အသံ: ဖွင့်ထားသည်' : '🔇 အသံ: ပိတ်ထားသည်';
      autoBtn.style.color = state.autoSpeakWalkie ? '#34D399' : '#94A3B8';
      vibrate(10);
      showToast(state.autoSpeakWalkie ? 'Auto-speak enabled' : 'Auto-speak disabled (Silent)');
    };
  }

  setupWalkiePTTMic('walkieMicA', 'walkieSpeechA', () => state.langA.code, () => state.langB.code, 'walkieSpeechB');
  setupWalkiePTTMic('walkieMicB', 'walkieSpeechB', () => state.langB.code, () => state.langA.code, 'walkieSpeechA');
}

/** Push-to-Talk (PTT) with Real-Time GBoard-Style Streaming */
function setupWalkiePTTMic(btnId, myBoxId, getSrcLang, getTgtLang, otherBoxId){
  const btn = document.getElementById(btnId);
  const myBox = document.getElementById(myBoxId);
  const otherBox = document.getElementById(otherBoxId);
  if(!btn) return;

  let activeRec = null;
  let accumulatedFinal = '';
  let isRecording = false;

  const startPTT = (e) => {
    if(e && e.type === 'touchstart') e.preventDefault();
    if(isRecording) return;
    isRecording = true;
    primeAudioOnUserGesture();
    vibrate(18);

    btn.classList.add('active');
    accumulatedFinal = '';
    myBox.innerHTML = '<span style="color:#FBBF24;">🎙️ စကားပြောပါ (Listening Live)...</span>';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition){
      const manual = prompt('စကားပြောရန် စာသားရိုက်ထည့်ပါ:');
      if(manual) processWalkieTranslation(manual, getSrcLang(), getTgtLang(), myBox, otherBox);
      btn.classList.remove('active');
      isRecording = false;
      return;
    }

    try {
      activeRec = new SpeechRecognition();
      const srcCode = getSrcLang();
      activeRec.lang = langByCode(srcCode)?.ttsLocale || srcCode;
      activeRec.interimResults = true;
      activeRec.continuous = true;

      activeRec.onresult = (ev) => {
        let interim = '';
        for(let i = ev.resultIndex; i < ev.results.length; ++i){
          if(ev.results[i].isFinal){
            accumulatedFinal += ev.results[i][0].transcript + ' ';
          } else {
            interim += ev.results[i][0].transcript;
          }
        }
        const liveText = (accumulatedFinal + interim).trim();
        if(liveText){
          myBox.innerHTML = `<div style="font-size:15px; color:#FBBF24; font-weight:700;">🎙️ "${escapeHtml(liveText)}"</div>`;
        }
      };

      activeRec.onerror = (ev) => {
        console.warn('Walkie Speech error:', ev);
      };

      activeRec.start();
    } catch(err){
      console.warn('Rec start error:', err);
    }
  };

  const stopPTT = async (e) => {
    if(e && e.type === 'touchend') e.preventDefault();
    if(!isRecording) return;
    isRecording = false;
    vibrate(12);
    btn.classList.remove('active');

    if(activeRec){
      try { activeRec.stop(); } catch(err){}
    }

    const finalText = accumulatedFinal.trim();
    if(finalText){
      await processWalkieTranslation(finalText, getSrcLang(), getTgtLang(), myBox, otherBox);
    } else {
      myBox.innerHTML = '<span style="color:var(--text-dim);">မိုက်ဖိထားပြီး စကားပြောပါ...</span>';
    }
  };

  if ('ontouchstart' in window) {
    btn.addEventListener('touchstart', startPTT, { passive: false });
    btn.addEventListener('touchend', stopPTT, { passive: false });
    btn.addEventListener('touchcancel', stopPTT, { passive: false });
  } else {
    btn.addEventListener('mousedown', startPTT);
    btn.addEventListener('mouseup', stopPTT);
    btn.addEventListener('mouseleave', stopPTT);
  }
}

async function processWalkieTranslation(text, src, tgt, myBox, otherBox){
  myBox.innerHTML = `<div style="font-size:15px; color:#FFFFFF; font-weight:600;">"${escapeHtml(text)}"</div>`;
  otherBox.innerHTML = '<span style="color:#38BDF8;">⚡ AI ဖြင့် ဘာသာပြန်နေပါသည်...</span>';

  const renderPartial = (partial) => {
    otherBox.innerHTML = `
      <div style="font-size:18px; font-weight:800; color:#FFFFFF; margin-bottom:4px;">${escapeHtml(partial)}</div>
      <div style="font-size:12px; color:#38BDF8;">[${src.toUpperCase()} ➔ ${tgt.toUpperCase()}]</div>
    `;
  };

  const translated = await translateMessageOnRead(text, src, tgt, renderPartial);
  renderPartial(translated);

  if(state.autoSpeakWalkie){
    speakText(translated, tgt);
  }
}

/* =========================================================
   2. QUICK TRANSLATE & OCR SCAN LOGIC
========================================================= */
function initQuickTranslateUI(){
  const srcSel = document.getElementById('qtSourceLang');
  const tgtSel = document.getElementById('qtTargetLang');
  if(!srcSel || !tgtSel) return;

  srcSel.innerHTML = '';
  tgtSel.innerHTML = '';
  LANGUAGES.forEach(l => {
    srcSel.appendChild(new Option(langOptionLabel(l), l.code));
    tgtSel.appendChild(new Option(langOptionLabel(l), l.code));
  });

  srcSel.value = 'en';
  tgtSel.value = 'my';

  document.getElementById('qtSwapBtn').onclick = () => {
    const tmp = srcSel.value;
    srcSel.value = tgtSel.value;
    tgtSel.value = tmp;
    vibrate(10);
    showToast('Languages swapped!');
  };

  const inputArea = document.getElementById('qtInputText');
  const resultCard = document.getElementById('qtResultCard');
  const resultText = document.getElementById('qtResultText');

  document.getElementById('qtPasteBtn')?.addEventListener('click', async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if(clipText){
        inputArea.value = clipText;
        vibrate(8);
        showToast('Text pasted!');
      }
    } catch(e){
      showToast('Please paste text manually into the box.', 'info');
    }
  });

  document.getElementById('qtClearBtn').onclick = () => {
    inputArea.value = '';
    resultCard.style.display = 'none';
    vibrate(8);
  };

  document.getElementById('qtTranslateActionBtn').onclick = async () => {
    primeAudioOnUserGesture();
    const text = inputArea.value.trim();
    if(!text){
      showToast('Please enter text to translate', 'error');
      return;
    }
    vibrate(10);
    resultCard.style.display = 'block';
    resultText.innerHTML = '<span style="color:#38BDF8;">⚡ AI ဖြင့် ဘာသာပြန်နေပါသည်...</span>';

    const trans = await translateMessageOnRead(text, srcSel.value, tgtSel.value, (partial) => {
      resultText.textContent = partial;
    });
    resultText.textContent = trans;

    addQTHistory(text, trans, srcSel.value, tgtSel.value);
    if(state.autoSpeakWalkie){
      speakText(trans, tgtSel.value);
    }
  };

  document.getElementById('qtSpeakResultBtn').onclick = () => {
    primeAudioOnUserGesture();
    if(resultText.textContent){
      speakText(resultText.textContent, tgtSel.value);
    }
  };

  document.getElementById('qtCopyResultBtn').onclick = () => {
    if(resultText.textContent){
      navigator.clipboard?.writeText(resultText.textContent);
      vibrate(10);
      showToast(t('copySuccess'));
    }
  };

  document.getElementById('qtMicBtn').onclick = () => {
    primeAudioOnUserGesture();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition){
      showToast('Speech recognition not supported in this browser', 'error');
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = langByCode(srcSel.value)?.ttsLocale || srcSel.value;
    vibrate(15);
    showToast('🎙️ နားထောင်နေပါသည် (Speak now)...');
    rec.onresult = (e) => {
      inputArea.value = e.results[0][0].transcript;
      document.getElementById('qtTranslateActionBtn').click();
    };
    rec.start();
  };

  const camInput = document.getElementById('qtCameraFileInput');
  document.getElementById('qtCameraBtn').onclick = () => camInput.click();
  camInput.onchange = async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    vibrate(12);
    e.target.value = ''; // allow re-selecting the same file next time
    inputArea.value = '';
    resultCard.style.display = 'block';
    resultText.innerHTML = '<span style="color:#38BDF8;">📷 Photo ထဲက စာသားကို ဖတ်နေပါသည်...</span>';
    try{
      const extracted = await extractTextFromImage(file, srcSel.value);
      if(!extracted){
        resultText.innerHTML = '<span style="color:#F87171;">⚠️ ဒီပုံထဲမှာ စာသား မတွေ့ပါ — ရှင်းရှင်းလင်းလင်း ဓာတ်ပုံ ထပ်စမ်းကြည့်ပါ</span>';
        return;
      }
      inputArea.value = extracted;
      document.getElementById('qtTranslateActionBtn').click();
    }catch(err){
      console.warn('OCR failed:', err);
      resultText.innerHTML = '<span style="color:#F87171;">⚠️ ဓာတ်ပုံထဲက စာသား ထုတ်ယူလို့ မရပါ — API key/internet စစ်ကြည့်ပါ</span>';
    }
  };
}

/** Real OCR via Gemini vision — reads an image and returns the text found
    in it (in its original language), using the same key rotation as
    regular translation. Returns '' if no key is configured or nothing
    was found. */
async function extractTextFromImage(file, hintLangCode){
  const keys = (state.apiKeys || []).map(k => (k||'').trim()).filter(Boolean);
  if(!keys.length){
    showToast('OCR အတွက် Gemini API key လိုအပ်ပါတယ် — Settings မှာ ထည့်ပါ', 'error');
    return '';
  }
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const prompt = `Read every piece of text visible in this image exactly as written (signs, labels, documents, screens — anything). `
    + `Output ONLY the raw extracted text, preserving line breaks, no translation, no explanation, no markdown. `
    + `If there is truly no readable text in the image, output exactly: NONE`;

  const attempt = async () => {
    const key = currentApiKey();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: file.type || 'image/jpeg', data: base64 } }
        ] }],
        generationConfig: { temperature: 0.1 }
      })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, text: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '' };
  };

  let result = await attempt();
  let rotations = 0;
  while((result.status === 429 || result.status >= 500) && rotations < keys.length - 1){
    if(result.status === 429) markKeyExhausted(currentApiKey());
    if(!rotateApiKey()) break;
    result = await attempt();
    rotations++;
  }
  if(!result.ok || !result.text || result.text.trim().toUpperCase() === 'NONE') return '';
  return result.text.trim();
}

function addQTHistory(srcText, transText, sLang, tLang){
  const container = document.getElementById('qtHistoryList');
  if(!container) return;
  const item = document.createElement('div');
  item.className = 'chatListItem';
  item.onclick = () => speakText(transText, tLang);
  item.innerHTML = `
    <div class="chatItemInfo">
      <div style="font-size:14px; font-weight:700; color:#34D399; margin-bottom:2px;">${escapeHtml(transText)}</div>
      <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(srcText)}</div>
    </div>
    <div style="font-size:11px; color:#38BDF8; font-weight:700;">${sLang.toUpperCase()} ➔ ${tLang.toUpperCase()}</div>
  `;
  container.prepend(item);
}

/* =========================================================
   3. GEMINI LIVE BILATERAL SIMULTANEOUS INTERPRETER
========================================================= */
let liveRecognition = null;

function initLiveInterpreterUI(){
  const selA = document.getElementById('liveLangA');
  const selB = document.getElementById('liveLangB');
  if(!selA || !selB) return;

  selA.innerHTML = '';
  selB.innerHTML = '';
  LANGUAGES.forEach(l => {
    selA.appendChild(new Option(langOptionLabel(l), l.code));
    selB.appendChild(new Option(langOptionLabel(l), l.code));
  });
  selA.value = 'my';
  selB.value = 'en';

  const visNode = document.getElementById('liveVisualizerNode');

  visNode.onclick = () => {
    primeAudioOnUserGesture();
    if(state.isLiveActive){
      stopLiveInterpreter();
    } else {
      startLiveInterpreter(selA.value, selB.value);
    }
  };
}

function startLiveInterpreter(langA, langB){
  state.isLiveActive = true;
  vibrate(20);
  const visNode = document.getElementById('liveVisualizerNode');
  const statusLabel = document.getElementById('liveStatusLabel');
  visNode.classList.add('listening');
  statusLabel.textContent = `● တိုက်ရိုက် စကားနားထောင်နေပါသည် (${langA.toUpperCase()} ⇄ ${langB.toUpperCase()})`;
  statusLabel.style.color = '#34D399';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognition){
    showToast('Speech recognition not supported in this browser', 'error');
    return;
  }

  liveRecognition = new SpeechRecognition();
  liveRecognition.continuous = true;
  liveRecognition.interimResults = false;
  liveRecognition.lang = langByCode(langA)?.ttsLocale || langA;

  liveRecognition.onresult = async (e) => {
    const lastIdx = e.results.length - 1;
    const spoken = e.results[lastIdx][0].transcript;
    if(spoken && spoken.trim()){
      const trans = await translateMessageOnRead(spoken, langA, langB);
      appendLiveTranscript(spoken, trans, langA, langB);
      
      // Auto-speak out loud in target language immediately!
      speakText(trans, langB);
    }
  };

  liveRecognition.onerror = (e) => console.warn('Live rec error:', e);
  liveRecognition.onend = () => {
    if(state.isLiveActive) try { liveRecognition.start(); } catch(err){}
  };

  try { liveRecognition.start(); } catch(e){}
  showToast('⚡ Live Bilateral Simultaneous Interpreter Active!');
}

function stopLiveInterpreter(){
  state.isLiveActive = false;
  vibrate(10);
  const visNode = document.getElementById('liveVisualizerNode');
  const statusLabel = document.getElementById('liveStatusLabel');
  if(visNode) visNode.classList.remove('listening');
  if(statusLabel){
    statusLabel.textContent = 'ရပ်တန့်ထားပါသည် (နှိပ်ပြီး စတင်ပါ)';
    statusLabel.style.color = '#FBBF24';
  }
  if(liveRecognition) {
    try { liveRecognition.stop(); } catch(e){}
  }
}

function appendLiveTranscript(spoken, translated, sLang, tLang){
  const feed = document.getElementById('liveTranscriptStream');
  if(!feed) return;
  const bubble = document.createElement('div');
  bubble.className = 'liveTranscriptBubble';
  bubble.innerHTML = `
    <div style="font-size:15px; font-weight:700; color:#FFFFFF; margin-bottom:2px;">${escapeHtml(translated)}</div>
    <div style="font-size:12px; color:#94A3B8;">"${escapeHtml(spoken)}" • <span style="color:#38BDF8;">${sLang.toUpperCase()} ➔ ${tLang.toUpperCase()}</span></div>
  `;
  feed.appendChild(bubble);
  feed.scrollTop = feed.scrollHeight;
}

/* =========================================================
   4. 120+ SURVIVAL & WORK PLACE PHRASEBOOK
========================================================= */
function initPhrasebookUI(){
  renderPhraseCards(state.activePhraseCategory, '');

  document.querySelectorAll('.categoryPill').forEach(pill => {
    pill.onclick = () => {
      primeAudioOnUserGesture();
      document.querySelectorAll('.categoryPill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activePhraseCategory = pill.dataset.cat;
      const searchVal = document.getElementById('phraseSearchBox')?.value || '';
      renderPhraseCards(state.activePhraseCategory, searchVal);
    };
  });

  const searchBox = document.getElementById('phraseSearchBox');
  if(searchBox){
    searchBox.oninput = (e) => {
      renderPhraseCards(state.activePhraseCategory, e.target.value);
    };
  }
}

function renderPhraseCards(cat, query){
  const container = document.getElementById('phrasebookList');
  if(!container) return;
  container.innerHTML = '';

  const q = (query || '').toLowerCase().trim();
  const list = PHRASEBOOK.filter(item => {
    const matchCat = cat === 'all' || item.cat === cat;
    const matchQuery = !q ||
      (item.my && item.my.toLowerCase().includes(q)) ||
      (item.en && item.en.toLowerCase().includes(q)) ||
      (item.zh && item.zh.toLowerCase().includes(q)) ||
      (item.th && item.th.toLowerCase().includes(q));
    return matchCat && matchQuery;
  });

  if(list.length === 0){
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px;">စကားစု ရှာမတွေ့ပါ (No phrases found)</div>';
    return;
  }

  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'phraseCard';
    card.innerHTML = `
      <div class="phraseHeader">
        <span class="phraseCatBadge">${item.cat}</span>
      </div>
      <div class="phraseMyanmar">🇲🇲 ${escapeHtml(item.my)}</div>
      <div class="phraseEnglish">🇺🇸 ${escapeHtml(item.en)}</div>
      <div class="phraseChinese">🇨🇳 ${escapeHtml(item.zh)}</div>
      <div class="phraseThai">🇹🇭 ${escapeHtml(item.th)}</div>
      <div class="phraseActions">
        <button class="phraseActionBtn" onclick="primeAudioOnUserGesture(); speakText('${escapeHtml(item.my)}', 'my')">🔊 မြန်မာ</button>
        <button class="phraseActionBtn" onclick="primeAudioOnUserGesture(); speakText('${escapeHtml(item.en)}', 'en')">🔊 English</button>
        <button class="phraseActionBtn" onclick="primeAudioOnUserGesture(); speakText('${escapeHtml(item.zh)}', 'zh')">🔊 中文</button>
        <button class="phraseActionBtn" onclick="primeAudioOnUserGesture(); speakText('${escapeHtml(item.th)}', 'th')">🔊 ไทย</button>
        <button class="phraseActionBtn" onclick="navigator.clipboard.writeText('${escapeHtml(item.my)} / ${escapeHtml(item.en)}'); vibrate(8); showToast('Copied!')">📋 Copy</button>
      </div>
    `;
    container.appendChild(card);
  });
}

/* =========================================================
   DOM READY & CORE ATTACHMENTS
========================================================= */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const savedLang = localStorage.getItem('ot_uiLanguage');
    if(savedLang) state.uiLanguage = savedLang;
    const savedKeysRaw = localStorage.getItem('ot_apiKeys');
    const savedKeyOld = localStorage.getItem('ot_apiKey');
    const savedExhausted = localStorage.getItem('ot_exhaustedKeys');
    if(savedExhausted){
      try{ state.exhaustedKeysToday = JSON.parse(savedExhausted) || {}; }catch(e){}
    }
    if(savedKeysRaw){
      try{
        const parsed = JSON.parse(savedKeysRaw);
        if(Array.isArray(parsed)) state.apiKeys = [parsed[0]||'', parsed[1]||'', parsed[2]||''];
      }catch(e){}
    } else if(savedKeyOld){
      state.apiKeys = [savedKeyOld, '', ''];
    }
    state.apiKeyIndex = state.apiKeys.findIndex(k => k);
    if(state.apiKeyIndex === -1) state.apiKeyIndex = 0;
    state.apiKey = state.apiKeys[state.apiKeyIndex] || '';
    if(state.apiKey){
      const keyInput = document.getElementById('apiKeyInput');
      const keyInput2 = document.getElementById('apiKeyInput2');
      const keyInput3 = document.getElementById('apiKeyInput3');
      if(keyInput) keyInput.value = state.apiKeys[0] || '';
      if(keyInput2) keyInput2.value = state.apiKeys[1] || '';
      if(keyInput3) keyInput3.value = state.apiKeys[2] || '';
      testGeminiApiKey(state.apiKey);
    }
    const savedModel = localStorage.getItem('ot_aiModel');
    if(savedModel){
      state.aiModel = savedModel;
      const modelSelect = document.getElementById('aiModelSelect');
      if(modelSelect) modelSelect.value = savedModel;
    }
    const savedDomain = localStorage.getItem('ot_aiDomain');
    if(savedDomain){
      state.aiDomain = savedDomain;
      const domainSelect = document.getElementById('aiDomainSelect');
      if(domainSelect) domainSelect.value = savedDomain;
    }
    const savedSpeed = localStorage.getItem('ot_voiceSpeed');
    if(savedSpeed){
      state.voiceSpeed = parseFloat(savedSpeed);
      const speedSlider = document.getElementById('voiceSpeedSlider');
      const speedDisplay = document.getElementById('voiceSpeedDisplay');
      if(speedSlider) speedSlider.value = savedSpeed;
      if(speedDisplay) speedDisplay.textContent = savedSpeed + 'x';
    }
    [
      ['autoTranslateToggle', 'autoTranslate', 'ot_autoTranslate'],
      ['autoTranscribeToggle', 'autoTranscribe', 'ot_autoTranscribe'],
      ['autoSpeakToggle', 'autoSpeak', 'ot_autoSpeak'],
      ['soundEffectsToggle', 'soundEffects', 'ot_soundEffects'],
    ].forEach(([elId, stateKey, storageKey]) => {
      const saved = localStorage.getItem(storageKey);
      if(saved !== null) state[stateKey] = saved === '1';
      const el = document.getElementById(elId);
      if(el) el.checked = state[stateKey];
    });
  } catch(e){}

  const langSelect = document.getElementById('uiLangSelect');
  if(langSelect) langSelect.value = state.uiLanguage;

  applyUILanguage();
  await fbInit();

  // Bottom Tabs
  document.querySelectorAll('.navTabBtn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  // App Logo Home Button
  document.getElementById('appLogoHomeBtn')?.addEventListener('click', () => {
    showTab('chats');
  });

  // UI Language Switcher
  langSelect?.addEventListener('change', (e) => {
    state.uiLanguage = e.target.value;
    activeReadingLang = e.target.value;
    try { localStorage.setItem('ot_uiLanguage', state.uiLanguage); } catch(err){}
    applyUILanguage();
    const readingSelect = document.getElementById('chatReadingLangSelect');
    if(readingSelect) readingSelect.value = state.uiLanguage;
    if(typeof renderRecentChatsList === 'function') renderRecentChatsList();
    if(typeof renderFriendsList === 'function') renderFriendsList(myFriendsCache);
    showToast('Language updated: ' + e.target.value.toUpperCase());
  });

  // AI Model Selection
  document.getElementById('aiModelSelect')?.addEventListener('change', (e) => {
    state.aiModel = e.target.value;
    try { localStorage.setItem('ot_aiModel', state.aiModel); } catch(err){}
    showToast('AI Model: ' + e.target.value);
  });

  // AI Domain Mode Selection
  document.getElementById('aiDomainSelect')?.addEventListener('change', (e) => {
    state.aiDomain = e.target.value;
    try { localStorage.setItem('ot_aiDomain', state.aiDomain); } catch(err){}
    showToast('Translation Domain: ' + e.target.value);
  });

  // Voice Speed Slider
  const speedSlider = document.getElementById('voiceSpeedSlider');
  const speedDisplay = document.getElementById('voiceSpeedDisplay');
  speedSlider?.addEventListener('input', (e) => {
    state.voiceSpeed = parseFloat(e.target.value);
    if(speedDisplay) speedDisplay.textContent = e.target.value + 'x';
    try { localStorage.setItem('ot_voiceSpeed', e.target.value); } catch(err){}
  });

  // Behavior toggles — Auto-Translate / Auto-Transcribe / Auto-Speak / Sound Effects
  const toggleBindings = [
    ['autoTranslateToggle', 'autoTranslate', 'ot_autoTranslate'],
    ['autoTranscribeToggle', 'autoTranscribe', 'ot_autoTranscribe'],
    ['autoSpeakToggle', 'autoSpeak', 'ot_autoSpeak'],
    ['soundEffectsToggle', 'soundEffects', 'ot_soundEffects'],
  ];
  toggleBindings.forEach(([elId, stateKey, storageKey]) => {
    const el = document.getElementById(elId);
    if(!el) return;
    el.addEventListener('change', (e) => {
      state[stateKey] = e.target.checked;
      try { localStorage.setItem(storageKey, e.target.checked ? '1' : '0'); } catch(err){}
    });
  });

  // Save API Key Button
  document.getElementById('btnSaveApiKey')?.addEventListener('click', async () => {
    const val1 = (document.getElementById('apiKeyInput')?.value || '').trim();
    const val2 = (document.getElementById('apiKeyInput2')?.value || '').trim();
    const val3 = (document.getElementById('apiKeyInput3')?.value || '').trim();
    state.apiKeys = [val1, val2, val3];
    state.apiKeyIndex = state.apiKeys.findIndex(k => k);
    if(state.apiKeyIndex === -1) state.apiKeyIndex = 0;
    state.apiKey = state.apiKeys[state.apiKeyIndex] || '';
    try { localStorage.setItem('ot_apiKeys', JSON.stringify(state.apiKeys)); } catch(err){}
    showToast('💾 Saving API Key(s) and verifying...', 'info');
    await testGeminiApiKey(state.apiKey);
  });

  // Test API Key Button
  document.getElementById('btnTestApiKey')?.addEventListener('click', async () => {
    const val = (document.getElementById('apiKeyInput')?.value || '').trim();
    await testGeminiApiKey(val);
  });

  // Copy Friend Code
  document.getElementById('copyMyCodeBtn')?.addEventListener('click', () => {
    if(currentUser?.friendCode){
      navigator.clipboard?.writeText(currentUser.friendCode);
      vibrate(10);
      showToast(t('copySuccess'));
    }
  });

  // Chat Reading Language Change
  document.getElementById('chatReadingLangSelect')?.addEventListener('change', (e) => {
    activeReadingLang = e.target.value;
    showToast(`Reading messages in: ${e.target.value.toUpperCase()}`);
    if(activeChatSession){
      openChatSession(activeChatSession.type, activeChatSession.targetId, activeChatSession.title);
    }
  });

  // Chat Room Actions
  document.getElementById('closeChatRoomBtn')?.addEventListener('click', () => {
    const room = document.getElementById('chatRoomView');
    if(room) room.style.display = 'none';
  });

  document.getElementById('chatSendMsgBtn')?.addEventListener('click', () => {
    primeAudioOnUserGesture();
    const input = document.getElementById('chatTextInput');
    if(input && input.value.trim()){
      fbSendMessage(input.value.trim());
      input.value = '';
      playSfx('send');
    }
  });

  document.getElementById('chatTextInput')?.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      document.getElementById('chatSendMsgBtn')?.click();
    }
  });

  // Modals
  const addModal = document.getElementById('addFriendModal');
  const groupModal = document.getElementById('createGroupModal');
  const qrModal = document.getElementById('qrModal');

  document.getElementById('addFriendModalBtn')?.addEventListener('click', () => {
    pushNavigationState('modal');
    if(addModal) addModal.classList.add('show');
  });
  document.getElementById('btnOpenAddFriend')?.addEventListener('click', () => {
    pushNavigationState('modal');
    if(addModal) addModal.classList.add('show');
  });
  document.getElementById('btnOpenCreateGroup')?.addEventListener('click', () => {
    pushNavigationState('modal');
    populateGroupMembersChecklist();
    if(groupModal) groupModal.classList.add('show');
  });
  document.getElementById('btnShowMyQR')?.addEventListener('click', () => {
    pushNavigationState('modal');
    if(qrModal) qrModal.classList.add('show');
  });

  document.querySelectorAll('.modalCancelBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      if(addModal) addModal.classList.remove('show');
      if(groupModal) groupModal.classList.remove('show');
      if(qrModal) qrModal.classList.remove('show');
    });
  });

  document.getElementById('confirmAddFriendBtn')?.addEventListener('click', async () => {
    const codeInput = document.getElementById('friendCodeInput');
    const code = codeInput ? codeInput.value.trim() : '';
    if(!code){
      showToast('Please enter a 6-digit code', 'error');
      return;
    }
    const res = await fbAddFriendByCode(code);
    if(res.ok){
      showToast(t('friendAddedSuccess'));
      if(addModal) addModal.classList.remove('show');
      if(codeInput) codeInput.value = '';
    } else {
      showToast(res.reason === 'self' ? t('selfAddError') : t('friendNotFound'), 'error');
    }
  });

  document.getElementById('confirmCreateGroupBtn')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('groupNameInput');
    const name = nameInput ? nameInput.value.trim() : '';
    const selected = [];
    document.querySelectorAll('.memberCheckbox:checked').forEach(cb => selected.push(cb.value));

    if(!name){
      showToast('Please enter a group name', 'error');
      return;
    }
    await fbCreateGroupChat(name, selected);
    showToast(t('groupCreatedSuccess'));
    if(groupModal) groupModal.classList.remove('show');
    if(nameInput) nameInput.value = '';
  });

  // Force Clear Cache & Reload v10.0 Button
  document.getElementById('btnForceClearCache')?.addEventListener('click', async () => {
    showToast('Clearing all caches and updating to v10.0...', 'info');
    if('caches' in window){
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch(e){}
    }
    if('serviceWorker' in navigator){
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      } catch(e){}
    }
    setTimeout(() => {
      window.location.reload(true);
    }, 500);
  });

  // Clear Chat History
  document.getElementById('btnClearChatHistory')?.addEventListener('click', () => {
    if(confirm('Are you sure you want to clear chat history and cache?')){
      Object.keys(localStorage).forEach(k => {
        if(k.startsWith('ot_demo_messages_')) localStorage.removeItem(k);
      });
      showToast('Chat history cleared!');
      if(typeof renderRecentChatsList === 'function') renderRecentChatsList();
    }
  });

  // Reset Demo Data
  document.getElementById('btnResetDemoData')?.addEventListener('click', () => {
    localStorage.removeItem('ot_demo_uid');
    localStorage.removeItem('ot_demo_code');
    Object.keys(localStorage).forEach(k => {
      if(k.startsWith('ot_demo_')) localStorage.removeItem(k);
    });
    setupLocalDemoUser();
    showToast('Demo data and contacts reset!');
  });

  // Workspace Bento Cards Click Event Listeners
  document.querySelectorAll('.homeCard').forEach(card => {
    card.addEventListener('click', () => {
      const view = card.dataset.view;
      openWorkspaceTool(view);
    });
  });

  // File Upload
  const fileInput = document.getElementById('chatFileInput');
  document.getElementById('chatAttachBtn')?.addEventListener('click', () => {
    if(fileInput) fileInput.click();
  });
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const isImg = file.type.startsWith('image/');
      if(!activeChatSession) return;
      
      const newMsg = {
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        sourceLang: state.uiLanguage,
        fileData: reader.result,
        fileName: file.name,
        fileType: file.type,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        text: isImg ? 'Photo attachment' : file.name,
        timestamp: Date.now()
      };

      const targetId = activeChatSession.targetId;
      const stored = localStorage.getItem('ot_demo_messages_' + targetId);
      const msgs = stored ? JSON.parse(stored) : [];
      msgs.push(newMsg);
      localStorage.setItem('ot_demo_messages_' + targetId, JSON.stringify(msgs));
      renderChatMessages(msgs);
      showToast('Attachment sent!');
    };
    reader.readAsDataURL(file);
  });

  // Audio Voice Recording in Chat
  setupVoiceRecorder();
});

function populateGroupMembersChecklist(){
  const container = document.getElementById('groupMembersChecklist');
  if(!container) return;
  container.innerHTML = '';
  myFriendsCache.forEach(f => {
    const row = document.createElement('label');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    row.style.padding = '8px 4px';
    row.style.cursor = 'pointer';
    row.innerHTML = `
      <input type="checkbox" class="memberCheckbox" value="${f.uid}" style="width:18px; height:18px; accent-color:var(--primary);">
      <span style="font-size:14px; font-weight:600; color:var(--text-main);">${escapeHtml(f.displayName)}</span>
    `;
    container.appendChild(row);
  });
}

/* Voice Recorder Handler — free on-device transcription (Web Speech API),
   same reliable approach as the Walkie-Talkie PTT button. No audio is
   uploaded anywhere; only the transcribed text is sent. */
let voiceRec = null;
let voiceAccumulatedFinal = '';
let recordStartTime = 0;

function setupVoiceRecorder(){
  const voiceBtn = document.getElementById('chatVoiceToggleBtn');
  if(!voiceBtn) return;

  voiceBtn.addEventListener('mousedown', startVoiceRecord);
  voiceBtn.addEventListener('mouseup', stopVoiceRecord);
  voiceBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startVoiceRecord(); });
  voiceBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopVoiceRecord(); });
}

function startVoiceRecord(){
  const voiceBtn = document.getElementById('chatVoiceToggleBtn');
  if(voiceBtn) voiceBtn.classList.add('recording');
  primeAudioOnUserGesture();
  showToast(t('recording'));
  recordStartTime = Date.now();
  voiceAccumulatedFinal = '';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const wantsAutoTranscribe = (typeof state === 'undefined' || state.autoTranscribe !== false);
  if(!SpeechRecognition || !wantsAutoTranscribe){
    voiceRec = null;
    return; // stopVoiceRecord() will prompt for manual text entry instead
  }
  try{
    voiceRec = new SpeechRecognition();
    voiceRec.lang = langByCode(state.uiLanguage)?.ttsLocale || 'my-MM';
    voiceRec.interimResults = true;
    voiceRec.continuous = true;
    voiceRec.onresult = (ev) => {
      for(let i = ev.resultIndex; i < ev.results.length; ++i){
        if(ev.results[i].isFinal) voiceAccumulatedFinal += ev.results[i][0].transcript + ' ';
      }
    };
    voiceRec.onerror = (ev) => console.warn('Voice message speech error:', ev);
    voiceRec.start();
  }catch(err){
    console.warn('Voice rec start error:', err);
    voiceRec = null;
  }
}

async function stopVoiceRecord(){
  const voiceBtn = document.getElementById('chatVoiceToggleBtn');
  if(voiceBtn) voiceBtn.classList.remove('recording');
  const durationSec = Math.max(2, Math.round((Date.now() - recordStartTime) / 1000));

  const finish = async (text) => {
    if(!text){
      // No speech recognized (or browser doesn't support it) — ask instead
      // of silently sending nothing or making something up.
      text = prompt('Voice message အတွက် စာသားရိုက်ထည့်ပါ:');
    }
    if(text && text.trim()){
      await fbSendAudioMessage(null, durationSec, text.trim());
      showToast('Voice message sent & transcribed!');
    }
  };

  if(voiceRec){
    voiceRec.onend = () => finish(voiceAccumulatedFinal.trim());
    try{ voiceRec.stop(); }catch(e){ finish(voiceAccumulatedFinal.trim()); }
  } else {
    await finish('');
  }
}
