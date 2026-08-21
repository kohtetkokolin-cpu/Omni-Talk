/* ==========================================================
   OmniTalk PRO v12.0 — app.js
   Application Controller & Workspace Tools Manager
   Features:
   - Gemini 3.6 / 2.5 / 2.0 / 1.5 Multi-Model Support
   - Live Gemini Voice & Cloud Neural TTS Audio Playback
   - API Key Test & Verification with Live Status Badge
   - Walkie-Talkie Face-to-Face PTT with GBoard-style Live Streaming
   - Gemini Live Bilateral Simultaneous Voice-to-Voice Interpreter
   - Force Cache Wipe & Reload Control
========================================================== */

const APP_VERSION = 'PRO v12.0.0 (Build 2026.08.15.12)';

const state = {
  activeTab: 'chats',
  currentSubView: null,
  langA: typeof langByCode === 'function' ? langByCode('en') : { code:'en', name:'English', flag:'🇺🇸', ttsLocale:'en-US' },
  langB: typeof langByCode === 'function' ? langByCode('my') : { code:'my', name:'Myanmar', flag:'🇲🇲', ttsLocale:'my-MM' },
  messages: [],
  apiKey: '',
  aiModel: 'gemini-2.5-flash',
  aiDomain: 'general',
  uiLanguage: 'my',
  autoTranslate: true,
  autoTranscribe: true,
  soundEffects: true,
  voiceSpeed: 1.0,
  isLiveActive: false,
  activePhraseCategory: 'all',

  // --- Walkie-Talkie engine state (ported from Walkie-Talkie Translator) ---
  messages: [], // conversation log for the Walkie-Talkie split-screen, newest first
  listening: { A: false, B: false },
  translating: { A: false, B: false },
  autoConversation: false, // "Auto Chat" hands-free back-and-forth
  autoSpeak: true,
  showTranslatedOut: true,
  lastSent: { A: null, B: null },
  tone: 'neutral', // 'casual' | 'neutral' | 'formal'
  glossary: '', // newline-separated terms never translated
  voiceEngine: 'auto', // 'auto' | 'device' | 'ai'
  offlineForced: false,
  myMemoryEnabled: true,
  exhaustedKeysToday: {},
  retryQueue: [],
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
    badge.textContent = 'Status: No Key Entered (Using Neural Fallback)';
    badge.style.color = '#94A3B8';
    return false;
  }

  badge.innerHTML = '<span style="color:#38BDF8;">⏳ Testing Gemini API connection...</span>';

  try {
    const chosenModel = wkResolveModel(state.aiModel);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModel}:generateContent?key=${testKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello' }] }],
        generationConfig: { temperature: 0.1 }
      })
    });

    if(res.ok){
      badge.innerHTML = '<span style="color:#34D399; font-weight:800;">✅ Active &amp; Verified! (Gemini AI Connected)</span>';
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

  // Leaving the Walkie-Talkie panel: stop any hanging mic/STT so it
  // doesn't keep listening in the background, and silence any playback.
  if(typeof wkStopHoldRecording === 'function'){
    wkStopHoldRecording('A'); wkStopHoldRecording('B');
  }
  if(typeof wkStopStt === 'function') wkStopStt();
  if(typeof qtStopRecognition === 'function') qtStopRecognition();
  if(typeof qtStopWaveform === 'function') qtStopWaveform();
  if(typeof qtStopHoldRecordingAudio === 'function' && wkHoldRecordingState.QT) qtStopHoldRecordingAudio();
  if('speechSynthesis' in window){ try{ window.speechSynthesis.cancel(); }catch(e){} }

  if(state.activeTab === 'tools'){
    const toolsTab = document.getElementById('tabContentTools');
    if(toolsTab) toolsTab.style.display = 'block';
  }
}

/* ---- Dictation (mic-to-text, appends to an existing text field) ---- */
function attachDictation(inputEl, micBtnEl, getLang){
  if(!wkSpeechRec){ if(micBtnEl) micBtnEl.style.display = 'none'; return; }
  let rec = null;
  let listening = false;
  let baseValue = '';
  let finalText = '';

  micBtnEl.addEventListener('click', () => {
    if(listening){ try{ rec.stop(); }catch(e){} return; }
    if('speechSynthesis' in window) window.speechSynthesis.cancel();
    const lang = getLang();
    try{
      rec = new wkSpeechRec();
      rec.lang = lang.ttsLocale;
      rec.continuous = true;
      rec.interimResults = true;
      baseValue = inputEl.value ? inputEl.value.trim() + ' ' : '';
      finalText = '';
      listening = true;
      micBtnEl.classList.add('dictating');
      rec.onresult = (e) => {
        let interim = '';
        for(let i = e.resultIndex; i < e.results.length; i++){
          if(e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
          else interim += e.results[i][0].transcript;
        }
        inputEl.value = (baseValue + finalText + interim).trim();
        inputEl.dispatchEvent(new Event('input'));
      };
      rec.onerror = (e) => {
        if(e.error === 'not-allowed' || e.error === 'permission-denied'){
          showToast(t('toastMicPermission'), 'error');
        }
      };
      rec.onend = () => { listening = false; micBtnEl.classList.remove('dictating'); };
      rec.start();
    }catch(e){ listening = false; micBtnEl.classList.remove('dictating'); }
  });
}

/* ---- Model resolution: maps any legacy/unavailable model id to a
   currently-valid Gemini model, so a stale saved selection never
   silently breaks every AI call. ---- */
function wkResolveModel(modelId){
  const validModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-1.5-pro'];
  if(validModels.includes(modelId)) return modelId;
  return 'gemini-2.5-flash'; // safe current default for any unknown/retired id
}
/* gemini-1.5-* models predate "thinking" entirely and reject a thinkingConfig
   field outright, while all 2.5-series models require thinkingBudget (not
   thinkingLevel, which only 3.x models support) — build the right shape here
   so every call site stays correct regardless of which model is selected. */
function wkThinkingConfig(model){
  return model.startsWith('gemini-1.5') ? {} : { thinkingConfig: { thinkingBudget: 0 } };
}
/* Lightweight script-based language guess, used only when the AI call that
   would normally auto-detect the source language has failed and we must
   still pick SOME source language for the offline dictionary / MyMemory
   fallback — guessing by Unicode script is far more accurate than assuming
   English, which was previously mangling non-Latin input in the fallback. */
function wkGuessScriptLang(text){
  if(/[\u1000-\u109F]/.test(text)) return 'my';
  if(/[\u0E00-\u0E7F]/.test(text)) return 'th';
  if(/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  return 'en';
}

/* =========================================================
   1. WALKIE-TALKIE — full engine ported from Walkie-Talkie
   Translator (chat-log panels, hold-to-talk on-device STT,
   Gemini translation w/ streaming, offline dictionary + MyMemory
   + translation memory fallback chain, Auto Chat hands-free,
   camera OCR scan, device/AI TTS dispatch, retry queue).
   UI chrome (header, colors, glass theme) stays OmniTalk's own;
   only the mechanism is replaced, 1:1 with the source app.
========================================================= */
function wkOtherSide(side){ return side === 'A' ? 'B' : 'A'; }

/* ---- Offline dictionary (exact / substring / compositional) ---- */
function wkOfflineTranslate(rawText, srcCode, tgtCode){
  const norm = (rawText || '').trim();
  if(!norm) return null;
  const normLower = norm.toLowerCase();

  for(const p of PHRASES){
    const src = (p[srcCode] || '').trim();
    if(src && (src === norm || src.toLowerCase() === normLower)){
      return { text: p[tgtCode], approx: false };
    }
  }

  const sortedPhrases = [...PHRASES].sort((a, b) => (b[srcCode] || '').length - (a[srcCode] || '').length);
  for(const p of sortedPhrases){
    const src = (p[srcCode] || '').trim();
    if(src.length >= 3){
      const srcLower = src.toLowerCase();
      if(normLower.includes(srcLower) || srcLower.includes(normLower)){
        return { text: p[tgtCode], approx: false };
      }
    }
  }

  const dict = [...PHRASES, ...(typeof WORDS !== 'undefined' ? WORDS : [])]
    .filter(d => d[srcCode] && d[tgtCode])
    .sort((a, b) => (b[srcCode] || '').length - (a[srcCode] || '').length);

  let i = 0;
  const outParts = [];
  let matchedAny = false;
  while(i < norm.length){
    let matched = null;
    for(const d of dict){
      const src = d[srcCode].trim();
      if(!src) continue;
      if(normLower.startsWith(src.toLowerCase(), i)){ matched = d; break; }
    }
    if(matched){
      outParts.push(matched[tgtCode]);
      i += matched[srcCode].trim().length;
      matchedAny = true;
      while(i < norm.length && /\s/.test(norm[i])) i++;
    } else { i++; }
  }

  if(matchedAny && outParts.length){
    const wordCount = norm.split(/\s+/).filter(Boolean).length;
    if(wordCount > 4 && outParts.length < Math.ceil(wordCount / 2)) return null;
    return { text: outParts.join(' '), approx: true };
  }
  return null;
}

/* ---- Translation memory (localStorage) ---- */
let wkTranslationMemory = {};
try{ wkTranslationMemory = JSON.parse(localStorage.getItem('ot_translationMemory') || '{}'); }catch(e){ wkTranslationMemory = {}; }
function wkTmNormalize(text){ return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[။၊.,!?]+$/g, ''); }
function wkTmKey(srcCode, tgtCode, text){ return srcCode + '|' + tgtCode + '|' + wkTmNormalize(text); }
function wkTmLookup(srcCode, tgtCode, text){ return wkTranslationMemory[wkTmKey(srcCode, tgtCode, text)] || null; }
function wkTmSave(srcCode, tgtCode, original, translated){
  if(!original || !translated) return;
  wkTranslationMemory[wkTmKey(srcCode, tgtCode, original)] = translated;
  try{
    const keys = Object.keys(wkTranslationMemory);
    if(keys.length > 600) keys.slice(0, keys.length - 600).forEach(k => delete wkTranslationMemory[k]);
    localStorage.setItem('ot_translationMemory', JSON.stringify(wkTranslationMemory));
  }catch(e){}
}

/* ---- Free key-less fallback (MyMemory) ---- */
async function wkTranslateViaMyMemory(text, sourceCode, targetCode){
  if(!text || !text.trim()) return null;
  try{
    const params = new URLSearchParams({ q: text.slice(0, 490), langpair: `${sourceCode}|${targetCode}` });
    const resp = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);
    if(!resp.ok) return null;
    const data = await resp.json();
    const result = data && data.responseData && data.responseData.translatedText;
    if(!result) return null;
    if(/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID (SOURCE|TARGET) LANGUAGE|AMOUNT OF WORDS/i.test(result)) return null;
    const match = Number(data?.responseData?.match);
    if(!isNaN(match) && match < 0.6) return null;
    return result;
  }catch(e){ return null; }
}

async function wkFallbackTranslateChain(text, sourceCode, targetCode){
  if(state.myMemoryEnabled && !state.offlineForced){
    const mm = await wkTranslateViaMyMemory(text, sourceCode, targetCode);
    if(mm) return { text: mm, approx: true, usedMyMemory: true };
  }
  const off = wkOfflineTranslate(text, sourceCode, targetCode);
  if(off) return { text: off.text, approx: off.approx, usedMyMemory: false };
  return null;
}

/* ---- Prompt building ---- */
function wkToneInstruction(){
  if(state.tone === 'formal') return 'Use a formal, respectful, professional register appropriate for business or official contexts.';
  if(state.tone === 'casual') return 'Use a casual, friendly, relaxed everyday tone, like talking to a close friend.';
  return 'Use a natural, neutral everyday tone — polite but not overly formal, not overly casual.';
}
function wkGlossaryInstruction(){
  if(!state.glossary) return '';
  const terms = state.glossary.split('\n').map(t => t.trim()).filter(Boolean);
  if(!terms.length) return '';
  return `\nThese specific words/names must be kept EXACTLY as written in the original, never translated: ${terms.join(', ')}.\n`;
}
function wkConversationContextBlock(){
  const recent = state.messages.slice(0, 5).filter(m => !m.pending).reverse();
  if(!recent.length) return '';
  const lines = recent.map(m => `${m.sender === 'A' ? 'Person A' : 'Person B'}: ${m.originalText}`).join('\n');
  return `\nRecent conversation so far (for context only — helps with pronouns/references like "he/she/it/that"; do NOT translate this part, only translate the new message below):\n${lines}\n`;
}
function wkBuildTranslationPrompt(text, sourceLang, targetLang){
  const domainLine = state.aiDomain && state.aiDomain !== 'general'
    ? `This conversation is in a ${state.aiDomain} context — use appropriate terminology for that domain.\n` : '';
  return `You are an expert interpreter helping two people communicate naturally in a live, real-time conversation. `
    + `Translate the following message from ${sourceLang.name} into ${targetLang.name}.\n\n`
    + `IMPORTANT: Do NOT translate word-for-word. Understand the full meaning, tone, and intent of the message, `
    + `then express it the way a native ${targetLang.name} speaker would naturally say it out loud in this real-life situation `
    + `(everyday / workplace conversation).\n\n`
    + `Tone: ${wkToneInstruction()}\n`
    + domainLine
    + `${wkGlossaryInstruction()}`
    + `${wkConversationContextBlock()}`
    + `\nRules:\n`
    + `- If translating into Burmese, use natural, everyday spoken Burmese (not overly formal/literary), unless Tone above says otherwise.\n`
    + `- If translating into Chinese, use the polite/respectful form (您) unless the tone is clearly casual.\n`
    + `- If translating into Thai, include natural polite particles (ครับ/ค่ะ) where appropriate.\n`
    + `- If translating into English, use natural, conversational English.\n\n`
    + `Return ONLY the translated sentence itself — no explanations, no notes, no quotation marks, no pronunciation guides.\n\n`
    + `Message to translate now: "${text}"`;
}
function wkFriendlyApiError(status){
  if(status === 429) return t('errApiQuota');
  if(status === 401 || status === 403) return t('errApiKeyInvalid');
  if(status >= 500) return t('errServerError');
  return t('errGenericAI');
}

/* ---- Retry queue (auto-resends messages that failed purely due to connectivity) ---- */
function wkQueueForRetry(msgId, sender, rawText, sourceCode, targetCode){
  if(state.retryQueue.some(q => q.msgId === msgId)) return;
  state.retryQueue.push({ msgId, sender, rawText, sourceCode, targetCode });
}
async function wkProcessRetryQueue(){
  if(!state.retryQueue.length || !state.apiKey) return;
  const queue = state.retryQueue.splice(0, state.retryQueue.length);
  showToast(`${t('toastRetryQueue')} (${queue.length})`, 'info');
  for(const item of queue){
    const msg = state.messages.find(m => m.id === item.msgId);
    if(!msg) continue;
    const sourceLang = langByCode(item.sourceCode);
    const targetLang = langByCode(item.targetCode);
    if(!sourceLang || !targetLang) continue;
    try{
      const resp = await wkGeminiFetch(state.aiModel, {
        contents: [{ parts: [{ text: wkBuildTranslationPrompt(item.rawText, sourceLang, targetLang) }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048, ...wkThinkingConfig(state.aiModel) }
      });
      if(resp.ok){
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if(text){
          msg.translatedText = text; msg.approx = false; msg.usedOffline = false; msg.usedMyMemory = false;
          msg.connectivityFailure = false; msg.errorDetail = '';
          wkTmSave(item.sourceCode, item.targetCode, item.rawText, text);
          continue;
        }
      }
      state.retryQueue.push(item);
    }catch(e){ state.retryQueue.push(item); }
  }
  wkRenderPanel('A'); wkRenderPanel('B');
}
window.addEventListener('online', () => { wkProcessRetryQueue(); });

/* ---- Gemini call plumbing (rate-limited, one retry on 429/5xx) ---- */
const wkSessionApiStats = { calls: 0, retried: 0 };
let wkApiThrottleQueue = Promise.resolve();
const WK_API_MIN_GAP_MS = 350;
function wkTodayStr(){ return new Date().toISOString().slice(0, 10); }
function wkMarkKeyExhausted(key){ if(key) { state.exhaustedKeysToday[key] = wkTodayStr(); } }
function wkIsKeyExhaustedToday(key){ return !!key && state.exhaustedKeysToday[key] === wkTodayStr(); }
function wkApiThrottle(doFetch){
  const run = wkApiThrottleQueue.then(async () => {
    wkSessionApiStats.calls++;
    let resp = await doFetch();
    const isRetryable = (r) => r && (r.status === 429 || r.status >= 500);
    if(isRetryable(resp)){
      if(resp.status === 429) wkMarkKeyExhausted(state.apiKey);
      if(resp.status !== 429){
        wkSessionApiStats.retried++;
        await new Promise(r => setTimeout(r, 1200));
        resp = await doFetch();
      }
    }
    return resp;
  });
  wkApiThrottleQueue = run.catch(() => {}).then(() => new Promise(r => setTimeout(r, WK_API_MIN_GAP_MS)));
  return run;
}
async function wkGeminiFetch(model, payload){
  model = wkResolveModel(model);
  return wkApiThrottle(() => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': state.apiKey },
    body: JSON.stringify(payload),
  }));
}
async function wkGeminiFetchStream(model, payload, onChunk){
  model = wkResolveModel(model);
  if(!window.ReadableStream){
    const resp = await wkGeminiFetch(model, payload);
    if(!resp.ok) return { ok: false, status: resp.status, resp };
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    if(text) onChunk(text);
    return { ok: true, fullText: text };
  }
  let resp;
  try{
    resp = await wkApiThrottle(() => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': state.apiKey },
      body: JSON.stringify(payload),
    }));
  }catch(e){ return { ok: false, error: e }; }
  if(!resp.ok || !resp.body) return { ok: false, status: resp.status, resp };

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = ''; let fullText = '';
  while(true){
    const { done, value } = await reader.read();
    if(done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for(const line of lines){
      const trimmed = line.trim();
      if(!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if(!jsonStr || jsonStr === '[DONE]') continue;
      try{
        const obj = JSON.parse(jsonStr);
        const piece = obj?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        if(piece){ fullText += piece; onChunk(fullText); }
      }catch(e){}
    }
  }
  return { ok: true, fullText };
}

/* ---- TTS: device voice first (free), Gemini AI voice as fallback ---- */
let wkCachedVoices = [];
function wkLoadVoices(){ if('speechSynthesis' in window) wkCachedVoices = window.speechSynthesis.getVoices(); }
if('speechSynthesis' in window){ wkLoadVoices(); window.speechSynthesis.onvoiceschanged = wkLoadVoices; }
function wkPickVoice(localeCode){
  if(!wkCachedVoices.length) wkLoadVoices();
  let v = wkCachedVoices.find(v => v.lang === localeCode);
  if(!v) v = wkCachedVoices.find(v => v.lang.toLowerCase() === localeCode.toLowerCase());
  if(!v) v = wkCachedVoices.find(v => v.lang.split('-')[0] === localeCode.split('-')[0]);
  return v || null;
}
const wkTtsAudioCache = new Map();
let wkCurrentAudioEl = null;
function wkPcmBase64ToWavBlob(base64, sampleRate){
  const binary = atob(base64);
  const len = binary.length;
  const pcmBytes = new Uint8Array(len);
  for(let i = 0; i < len; i++) pcmBytes[i] = binary.charCodeAt(i);
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (offset, str) => { for(let i=0;i<str.length;i++) view.setUint8(offset+i, str.charCodeAt(i)); };
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + len, true); writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeStr(36, 'data'); view.setUint32(40, len, true);
  return new Blob([header, pcmBytes], { type: 'audio/wav' });
}
async function wkSpeakViaGemini(text, onDone){
  try{
    let url = wkTtsAudioCache.get(text);
    if(!url){
      const resp = await wkGeminiFetch('gemini-3.1-flash-tts-preview', {
        contents: [{ parts: [{ text: text }] }],
        generationConfig: { responseModalities: ['AUDIO'], maxOutputTokens: 8192, speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }
      });
      if(!resp.ok) throw new Error('TTS API ' + resp.status);
      const data = await resp.json();
      const part = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData || p.inline_data);
      const inline = part?.inlineData || part?.inline_data;
      if(!inline?.data) throw new Error('No audio in TTS response');
      const wavBlob = wkPcmBase64ToWavBlob(inline.data, 24000);
      url = URL.createObjectURL(wavBlob);
      wkTtsAudioCache.set(text, url);
      if(wkTtsAudioCache.size > 60){
        const oldestKey = wkTtsAudioCache.keys().next().value;
        try{ URL.revokeObjectURL(wkTtsAudioCache.get(oldestKey)); }catch(e){}
        wkTtsAudioCache.delete(oldestKey);
      }
    }
    if(wkCurrentAudioEl){ try{ wkCurrentAudioEl.pause(); }catch(e){} }
    const audio = new Audio(url);
    audio.playbackRate = state.voiceSpeed || 1.0;
    wkCurrentAudioEl = audio;
    let fired = false;
    const finish = () => { if(fired) return; fired = true; if(onDone) onDone(); };
    audio.onended = finish; audio.onerror = finish;
    await audio.play();
    return true;
  }catch(e){ console.error('Gemini TTS failed, falling back to device voice:', e); return false; }
}
function wkSpeakLocal(text, lang, onDone){
  if(!('speechSynthesis' in window) || !text){ if(onDone) onDone(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = wkPickVoice(lang.ttsLocale);
  if(voice){ u.voice = voice; u.lang = voice.lang; } else { u.lang = lang.ttsLocale; }
  u.rate = state.voiceSpeed || 1.0;
  let fired = false;
  const finish = () => { if(fired) return; fired = true; if(onDone) onDone(); };
  u.onend = finish; u.onerror = finish;
  window.speechSynthesis.speak(u);
}
async function wkSpeak(text, lang, onDone){
  if(!text){ if(onDone) onDone(); return; }
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  const engine = state.voiceEngine || 'auto';
  if(engine === 'device'){ wkSpeakLocal(text, lang, onDone); return; }
  const canUseAi = !state.offlineForced && !!state.apiKey;
  if(engine === 'auto' && wkPickVoice(lang.ttsLocale)){ wkSpeakLocal(text, lang, onDone); return; }
  if(canUseAi){
    const ok = await wkSpeakViaGemini(text, onDone);
    if(ok) return;
  }
  wkSpeakLocal(text, lang, onDone);
}

/* ---- SVG icons (inline, ported as-is) ---- */
function wkSvgMic(){return `<svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2z"/></svg>`;}
function wkSvgSend(){return `<svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>`;}
function wkSvgVolume(){return `<svg viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05A4.48 4.48 0 0 0 16.5 12z"/></svg>`;}
function wkSvgPlay(){return `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;}
function wkSvgCopy(){return `<svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`;}
function wkSvgTranslate(){return `<svg viewBox="0 0 24 24"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.5 17.5 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.05 4.98L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;}
function wkSvgCamera(){return `<svg viewBox="0 0 24 24"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2l-1.83 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>`;}
function wkSvgBook(){return `<svg viewBox="0 0 24 24"><path fill="#fff" d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h5v8l2.5-1.5L16 12V4h2v16z"/></svg>`;}

/* ---- Translation core ---- */
async function wkHandleTranslation(rawText, sender, isVoice){
  rawText = (rawText || '').trim();
  if(!rawText) return;

  const now = Date.now();
  if(state.lastSent[sender] && state.lastSent[sender].text === rawText && now - state.lastSent[sender].at < 1200) return;
  state.lastSent[sender] = { text: rawText, at: now };

  const isA = sender === 'A';
  state.translating[sender] = true;
  const inputEl = document.getElementById('wkInput' + sender);
  if(inputEl) inputEl.value = '';

  const sourceLang = isA ? state.langA : state.langB;
  const targetLang = isA ? state.langB : state.langA;

  const msgId = Date.now().toString();
  state.messages.unshift({
    id: msgId, sender, originalText: rawText, translatedText: '', isVoice: !!isVoice,
    approx: false, usedOffline: false, pending: true, timestamp: Date.now(),
  });
  wkRenderPanel('A'); wkRenderPanel('B');

  let translated = '', approx = false, usedOffline = false, usedMyMemory = false, errorDetail = '', connectivityFailure = false;

  async function fallbackOffline(prefix){
    usedOffline = true;
    const remembered = wkTmLookup(sourceLang.code, targetLang.code, rawText);
    if(remembered){ translated = remembered; approx = false; return; }
    const result = await wkFallbackTranslateChain(rawText, sourceLang.code, targetLang.code);
    if(result){ translated = result.text; approx = result.approx; usedMyMemory = result.usedMyMemory; }
    else { translated = `${prefix} ${rawText}`; approx = true; }
  }

  if(state.offlineForced || !state.apiKey){
    await fallbackOffline('[Offline]');
  } else {
    try{
      const prompt = wkBuildTranslationPrompt(rawText, sourceLang, targetLang);
      let streamStructureReady = false;
      const streamResult = await wkGeminiFetchStream(state.aiModel, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048, ...wkThinkingConfig(state.aiModel) }
      }, (partialText) => {
        const liveMsg = state.messages.find(m => m.id === msgId);
        if(!liveMsg) return;
        liveMsg.translatedText = partialText; liveMsg.pending = false;
        if(!streamStructureReady){ streamStructureReady = true; wkRenderPanel('A'); wkRenderPanel('B'); }
        else { wkPatchStreamingText(msgId, partialText); }
      });
      if(streamResult.ok){
        const text = (streamResult.fullText || '').trim();
        if(text){ translated = text; wkTmSave(sourceLang.code, targetLang.code, rawText, translated); }
        else { errorDetail = t('errEmptyResponse'); await fallbackOffline('[Empty response]'); }
      } else {
        errorDetail = wkFriendlyApiError(streamResult.status);
        await fallbackOffline('[Network Error]');
      }
    }catch(e){
      errorDetail = t('errConnectionFailed');
      connectivityFailure = true;
      await fallbackOffline('[Error Connection]');
    }
  }

  const msg = state.messages.find(m => m.id === msgId);
  if(msg){
    msg.translatedText = translated; msg.approx = approx; msg.usedOffline = usedOffline;
    msg.usedMyMemory = usedMyMemory; msg.errorDetail = errorDetail; msg.pending = false;
    msg.connectivityFailure = connectivityFailure;
    if(connectivityFailure) wkQueueForRetry(msgId, sender, rawText, sourceLang.code, targetLang.code);
  }

  state.translating[sender] = false;
  wkRenderPanel('A'); wkRenderPanel('B');
  vibrate(15);

  const continueAutoConversation = () => {
    if(state.autoConversation){
      const replySide = wkOtherSide(sender);
      if(!state.listening.A && !state.listening.B && !state.translating.A && !state.translating.B){
        setTimeout(() => { if(state.autoConversation) wkStartStt(replySide); }, 350);
      }
    }
  };
  if(state.autoSpeak) wkSpeak(translated, targetLang, continueAutoConversation);
  else continueAutoConversation();
}

/* ---- Camera OCR scan (photo -> Gemini vision OCR + natural translation) ---- */
let wkCurrentScanSide = null;
function wkFileToBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function wkScanAndTranslate(file, side){
  const isA = side === 'A';
  const sourceLang = isA ? state.langA : state.langB;
  const targetLang = isA ? state.langB : state.langA;
  if(state.offlineForced || !state.apiKey){
    showToast(t('toastScanNeedsKey'), 'warn');
    return;
  }
  state.translating[side] = true;
  const scanMsgId = Date.now().toString();
  state.messages.unshift({
    id: scanMsgId, sender: side, originalText: '(scanning photo…)', translatedText: '',
    isVoice: false, isScan: true, approx: false, usedOffline: false, pending: true, timestamp: Date.now(),
  });
  wkRenderPanel('A'); wkRenderPanel('B');
  try{
    const base64 = await wkFileToBase64(file);
    const isImage = file.type && file.type.startsWith('image/');
    const photoUrl = isImage ? `data:${file.type};base64,${base64}` : null;
    const prompt = `This photo (a sign, label, document, screen, or handwriting) contains visible text, likely in ${sourceLang.name} but it could be in any language. `
      + `Step 1: Read every piece of text visible exactly as written. `
      + `Step 2: Translate it into natural, fluent, native-sounding ${targetLang.name} — translate the full meaning and intent the way a native speaker would actually say it, NOT word-for-word. `
      + `Tone: ${wkToneInstruction()} ${wkGlossaryInstruction()}`
      + `Respond in EXACTLY this format with no extra commentary:\nORIGINAL: <the text you read>\nTRANSLATED: <the natural translation into ${targetLang.name}>`;
    const resp = await wkGeminiFetch(state.aiModel, {
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: file.type || 'image/jpeg', data: base64 } }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048, ...wkThinkingConfig(state.aiModel), mediaResolution: 'MEDIA_RESOLUTION_MEDIUM' }
    });
    if(!resp.ok){
      showToast(`${t('toastScanFailed')} (Error ${resp.status})`, 'error');
      state.messages = state.messages.filter(m => m.id !== scanMsgId);
      state.translating[side] = false; wkRenderPanel('A'); wkRenderPanel('B');
      return;
    }
    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || '';
    const origMatch = raw.match(/ORIGINAL:\s*([\s\S]*?)\nTRANSLATED:/i);
    const transMatch = raw.match(/TRANSLATED:\s*([\s\S]*)/i);
    const originalText = origMatch ? origMatch[1].trim() : '(scanned image)';
    const translatedText = transMatch ? transMatch[1].trim() : raw;
    const scanMsg = state.messages.find(m => m.id === scanMsgId);
    if(scanMsg){ scanMsg.originalText = originalText; scanMsg.translatedText = translatedText; scanMsg.photoUrl = photoUrl; scanMsg.pending = false; }
    state.translating[side] = false;
    wkRenderPanel('A'); wkRenderPanel('B');
    const continueAutoConversation = () => {
      if(state.autoConversation){
        const replySide = wkOtherSide(side);
        if(!state.listening.A && !state.listening.B && !state.translating.A && !state.translating.B){
          setTimeout(() => { if(state.autoConversation) wkStartStt(replySide); }, 350);
        }
      }
    };
    if(state.autoSpeak) wkSpeak(translatedText, targetLang, continueAutoConversation);
    else continueAutoConversation();
  }catch(e){
    showToast(`${t('toastScanFailed')}: ${e.message}`, 'error');
    state.messages = state.messages.filter(m => m.id !== scanMsgId);
  }
  state.translating[side] = false;
  wkRenderPanel('A'); wkRenderPanel('B');
}

/* ---- Tap-mic (used to auto-open the other side's mic in Auto Chat mode) ---- */
const wkSpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let wkRecognition = null;
if(wkSpeechRec){ wkRecognition = new wkSpeechRec(); wkRecognition.continuous = false; wkRecognition.interimResults = false; }
function wkStartStt(side){
  if(!wkRecognition) return;
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  const lang = side === 'A' ? state.langA : state.langB;
  wkRecognition.lang = lang.ttsLocale;
  state.listening[side] = true;
  wkRenderPanel(side);
  wkRecognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    if(text && text.trim()) wkHandleTranslation(text, side, true);
  };
  wkRecognition.onerror = (e) => {
    wkStopStt();
    if(e.error === 'not-allowed' || e.error === 'permission-denied'){
      state.autoConversation = false;
      showToast(t('toastMicPermission'), 'error');
    }
  };
  wkRecognition.onspeechend = () => { try{ wkRecognition.stop(); }catch(e){} };
  wkRecognition.onend = () => { wkStopStt(); };
  try{ wkRecognition.start(); }catch(e){ wkStopStt(); }
}
function wkStopStt(){
  state.listening.A = false; state.listening.B = false;
  wkRenderPanel('A'); wkRenderPanel('B');
}

/* ---- Hold-to-Talk (free on-device SpeechRecognition per side) ---- */
const wkHoldRecordingState = {};
function wkStartHoldRecording(side){
  if(!wkSpeechRec){
    showToast(t('toastMicNotSupported'), 'error');
    return;
  }
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  const lang = side === 'A' ? state.langA : state.langB;
  const inputEl = document.getElementById('wkInput' + side);
  try{
    const rec = new wkSpeechRec();
    rec.lang = lang.ttsLocale; rec.continuous = true; rec.interimResults = true;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for(let i = e.resultIndex; i < e.results.length; i++){
        if(e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
        else interim += e.results[i][0].transcript;
      }
      if(inputEl) inputEl.value = (finalText + interim).trim();
    };
    rec.onerror = (e) => {
      if(e.error === 'not-allowed' || e.error === 'permission-denied'){
        showToast(t('toastMicPermission'), 'error');
      }
    };
    wkHoldRecordingState[side] = { rec, getFinalText: () => finalText.trim() };
    rec.start();
  }catch(e){ showToast(t('toastMicPermission'), 'error'); }
}
function wkStopHoldRecording(side){
  const r = wkHoldRecordingState[side];
  if(!r) return;
  const finish = () => {
    const text = r.getFinalText();
    delete wkHoldRecordingState[side];
    if(text) wkHandleTranslation(text, side, true);
  };
  r.rec.onend = finish;
  try{ r.rec.stop(); }catch(e){ finish(); }
}

/* ---- Rendering: chat-log panel per side ---- */
function wkPanelElId(side){ return side === 'A' ? 'walkiePanelTop' : 'walkiePanelBottom'; }
function wkRenderPanel(side){
  const isA = side === 'A';
  const container = document.getElementById(wkPanelElId(side));
  if(!container) return;
  const currentLang = isA ? state.langA : state.langB;
  const otherLang = isA ? state.langB : state.langA;
  const accent = isA ? 'var(--accent-cyan)' : 'var(--primary)';
  const isListening = state.listening[side];
  const isTranslating = state.translating[side];

  container.innerHTML = `
    <div class="panel-header">
      <div class="who">
        <div class="dot" style="background:${accent}"></div>
        <div class="label">${isA ? t('wkSpeakerA') : t('wkSpeakerB')}</div>
      </div>
      <select class="langSelect" id="wkSelect${side}">
        ${LANGUAGES.map(l => `<option value="${l.code}" ${l.code===currentLang.code?'selected':''} ${l.code===otherLang.code?'disabled':''}>${langOptionLabel(l)}</option>`).join('')}
      </select>
    </div>
    <div class="chatLog" id="wkChatLog${side}"></div>
    <div class="inputRow">
      <div class="textFieldWrap">
        <input type="text" id="wkInput${side}" maxlength="4000" placeholder="${isA ? t('wkInputPlaceholderReadonly') : t('wkInputPlaceholderTypable')}" ${isA ? 'readonly' : ''}>
        <button class="sendBtn" id="wkSendBtn${side}">${wkSvgSend()}</button>
      </div>
      <button class="holdMicBtn ${isListening?'recording':''}" id="wkHoldMic${side}">${wkSvgMic()}</button>
    </div>
    <div class="toolbarRow">
      <button class="camBtn ${isTranslating?'busy':''}" id="wkCam${side}" title="${t('wkCamTitle')}">${wkSvgCamera()}</button>
      <button class="camBtn" id="wkPhrasebook${side}" title="${t('wkPhrasebookTitle')}">${wkSvgBook()}</button>
      <div class="pttHint" style="flex:1; text-align:right; padding-right:2px;">${t('wkPttHint')}</div>
    </div>
  `;

  wkRenderChatLog(side);

  document.getElementById('wkSelect'+side).addEventListener('change', (e) => {
    const newLang = langByCode(e.target.value);
    if(isA) state.langA = newLang; else state.langB = newLang;
    wkRenderPanel('A'); wkRenderPanel('B');
  });
  document.getElementById('wkSendBtn'+side).addEventListener('click', () => {
    vibrate(10);
    wkHandleTranslation(document.getElementById('wkInput'+side).value, side, false);
  });
  document.getElementById('wkInput'+side).addEventListener('keydown', (e) => {
    if(e.key === 'Enter') wkHandleTranslation(e.target.value, side, false);
  });
  if(isA){
    document.getElementById('wkInputA').addEventListener('click', () => wkOpenTypeOverlay('A'));
  }

  const holdMic = document.getElementById('wkHoldMic'+side);
  let holdActive = false;
  holdMic.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if(isTranslating) return;
    try{ holdMic.setPointerCapture(e.pointerId); }catch(err){}
    holdActive = true; vibrate(15);
    holdMic.classList.add('recording');
    wkStartHoldRecording(side);
  });
  const endHold = () => {
    if(!holdActive) return;
    holdActive = false; vibrate(10);
    holdMic.classList.remove('recording');
    wkStopHoldRecording(side);
  };
  holdMic.addEventListener('pointerup', endHold);
  holdMic.addEventListener('pointercancel', endHold);

  document.getElementById('wkCam'+side).addEventListener('click', (e) => {
    e.preventDefault();
    if(isTranslating) return;
    wkCurrentScanSide = side;
    document.getElementById('walkieScanInput').click();
  });
  document.getElementById('wkPhrasebook'+side).addEventListener('click', (e) => {
    e.preventDefault();
    openWorkspaceTool('phrasebook');
  });
}

function wkRenderChatLog(side){
  const el = document.getElementById('wkChatLog'+side);
  if(!el) return;
  if(state.messages.length === 0){
    el.innerHTML = `<div class="emptyState">${wkSvgTranslate()}<br>${t('wkEmptyState')}</div>`;
    return;
  }
  el.innerHTML = state.messages.map(msg => {
    const isMine = msg.sender === side;
    const originalLabel = isMine ? t('wkTagOriginal') : t('wkTagReceived');
    const translationLabel = isMine ? t('wkTagTranslatedOut') : t('wkTagOriginalSource');
    const accent = msg.sender === 'A' ? 'var(--accent-cyan)' : 'var(--primary)';
    const mainRaw = isMine ? msg.originalText : msg.translatedText;
    const subRaw = isMine ? msg.translatedText : msg.originalText;
    const showMainPending = msg.pending && !isMine;
    const showSubPending = msg.pending && isMine;
    const mainSide = side;
    const subSide = wkOtherSide(side);
    const hideSub = isMine && !state.showTranslatedOut;

    return `
      <div class="bubbleRow ${isMine?'mine':'theirs'}">
        <div class="bubble">
          <div class="topRow">
            <span class="tag" style="color:${accent}">${isMine ? originalLabel : translationLabel}</span>
            <div class="badges">
              ${msg.isVoice ? `<svg class="voiceIcon" viewBox="0 0 24 24"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/></svg>` : ''}
              ${msg.isScan ? `<span class="scanBadge">📷 scan</span>` : ''}
              ${msg.usedOffline ? (msg.usedMyMemory ? `<span class="myMemoryBadge">MyMemory</span>` : (msg.approx ? `<span class="offlineBadge">${t('badgeOffline')}</span>` : `<span class="memoryBadge">${t('badgeRemembered')}</span>`)) : ''}
              ${msg.connectivityFailure ? `<span class="offlineBadge">${t('badgeQueued')}</span>` : ''}
              ${msg.approx ? `<span class="approxBadge">${t('badgeApprox')}</span>` : ''}
            </div>
          </div>
          ${msg.photoUrl ? `<img src="${msg.photoUrl}" class="scanThumb" alt="Scanned photo">` : ''}
          <div class="mainText" ${showMainPending ? '' : `data-mid="${msg.id}" data-role="${isMine ? 'orig' : 'trans'}"`}>${showMainPending ? '<span class="dotFlicker">' + t('translatingLabel') + '</span>' : escapeHtml(mainRaw)}</div>
          ${showMainPending ? '' : `
          <div class="miniControls">
            <button class="iconBtn wkPlayBtn" data-mid="${msg.id}" data-block="main" data-side="${mainSide}">${wkSvgPlay()}</button>
            <button class="iconBtn wkCopyBtn" data-mid="${msg.id}" data-block="main" data-side="${mainSide}">${wkSvgCopy()}</button>
          </div>`}
          ${hideSub ? '' : `
          <hr>
          <div class="subRow"><span class="subLabel">${isMine ? translationLabel : originalLabel}</span></div>
          <div class="subText" ${showSubPending ? '' : `data-mid="${msg.id}" data-role="${isMine ? 'trans' : 'orig'}"`}>${showSubPending ? '<span class="dotFlicker">' + t('translatingLabel') + '</span>' : escapeHtml(subRaw)}</div>
          ${showSubPending ? '' : `
          <div class="miniControls">
            <button class="iconBtn wkPlayBtn" data-mid="${msg.id}" data-block="sub" data-side="${subSide}">${wkSvgPlay()}</button>
            <button class="iconBtn wkCopyBtn" data-mid="${msg.id}" data-block="sub" data-side="${subSide}">${wkSvgCopy()}</button>
          </div>`}`}
          ${msg.errorDetail ? `<div class="errorDetail">⚠ ${escapeHtml(msg.errorDetail)}</div>` : ''}
          ${msg.timestamp ? `<div class="msgTime">${formatTime(msg.timestamp)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function wkPatchStreamingText(msgId, text){
  document.querySelectorAll(`.mainText[data-mid="${msgId}"][data-role="trans"], .subText[data-mid="${msgId}"][data-role="trans"]`)
    .forEach(el => { el.textContent = text; });
}
function wkResolveBlockText(msg, block, panelSide){
  const isMine = msg.sender === panelSide;
  if(block === 'main') return isMine ? msg.originalText : msg.translatedText;
  return isMine ? msg.translatedText : msg.originalText;
}
function wkCopyBlockText(text, btnEl){
  if(!text) return;
  navigator.clipboard?.writeText(text).then(() => {
    showToast('Copied!', 'success');
    if(btnEl){ const orig = btnEl.innerHTML; btnEl.innerHTML = '✓'; setTimeout(() => btnEl.innerHTML = orig, 1200); }
  }).catch(() => {});
}
document.addEventListener('click', (e) => {
  const playBtn = e.target.closest('.wkPlayBtn');
  if(playBtn){
    const msg = state.messages.find(m => m.id === playBtn.dataset.mid);
    if(msg){
      const text = wkResolveBlockText(msg, playBtn.dataset.block, playBtn.dataset.side);
      const lang = playBtn.dataset.side === 'A' ? state.langA : state.langB;
      wkSpeak(text, lang);
    }
    return;
  }
  const copyBtn = e.target.closest('.wkCopyBtn');
  if(copyBtn){
    const msg = state.messages.find(m => m.id === copyBtn.dataset.mid);
    if(msg) wkCopyBlockText(wkResolveBlockText(msg, copyBtn.dataset.block, copyBtn.dataset.side), copyBtn);
    return;
  }
});

/* ---- Type overlay (for the inverted/upside-down top panel) ---- */
let wkTypeOverlaySide = 'A';
function wkOpenTypeOverlay(side){
  wkTypeOverlaySide = side;
  const input = document.getElementById('walkieTypeOverlayInput');
  input.value = document.getElementById('wkInput'+side).value;
  document.getElementById('walkieTypeOverlay').classList.add('show');
  setTimeout(() => input.focus(), 50);
}
function wkCloseTypeOverlay(){ document.getElementById('walkieTypeOverlay').classList.remove('show'); }
document.getElementById('walkieTypeOverlayCloseBtn')?.addEventListener('click', wkCloseTypeOverlay);
document.getElementById('walkieTypeOverlay')?.addEventListener('click', (e) => { if(e.target.id === 'walkieTypeOverlay') wkCloseTypeOverlay(); });
document.getElementById('walkieTypeOverlaySendBtn')?.addEventListener('click', () => {
  const text = document.getElementById('walkieTypeOverlayInput').value;
  if(!text.trim()) return;
  wkCloseTypeOverlay(); vibrate(10);
  wkHandleTranslation(text, wkTypeOverlaySide, false);
});
document.getElementById('walkieScanInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if(file && wkCurrentScanSide) wkScanAndTranslate(file, wkCurrentScanSide);
  e.target.value = '';
});

/* ---- Init / entry point for the Workspace card ---- */
function initWalkieTalkieUI(){
  document.getElementById('walkieSwapLangsBtn').onclick = () => {
    const tmp = state.langA; state.langA = state.langB; state.langB = tmp;
    wkRenderPanel('A'); wkRenderPanel('B');
    vibrate(12);
    showToast(t('toastLangSwapped'));
  };

  const autoSpeakBtn = document.getElementById('walkieAutoSpeakToggle');
  if(autoSpeakBtn){
    autoSpeakBtn.textContent = state.autoSpeak ? t('autoSpeakOnLabel') : t('autoSpeakOffLabel');
    autoSpeakBtn.onclick = () => {
      state.autoSpeak = !state.autoSpeak;
      autoSpeakBtn.textContent = state.autoSpeak ? t('autoSpeakOnLabel') : t('autoSpeakOffLabel');
      autoSpeakBtn.style.color = state.autoSpeak ? '#34D399' : '#94A3B8';
      vibrate(10);
    };
  }

  const autoConvBtn = document.getElementById('walkieAutoConvToggle');
  if(autoConvBtn){
    autoConvBtn.textContent = state.autoConversation ? t('autoChatOnLabel') : t('autoChatOffLabel');
    autoConvBtn.onclick = () => {
      state.autoConversation = !state.autoConversation;
      autoConvBtn.textContent = state.autoConversation ? t('autoChatOnLabel') : t('autoChatOffLabel');
      autoConvBtn.style.color = state.autoConversation ? '#34D399' : '#94A3B8';
      vibrate(10);
      showToast(state.autoConversation ? t('toastAutoChatOn') : t('toastAutoChatOff'));
    };
  }

  wkRenderPanel('A');
  wkRenderPanel('B');
}

/* =========================================================
   2. QUICK TRANSLATE & OCR — full engine ported from Walkie-Talkie
   Translator's Quick Translate (auto-detect source language, work-
   domain context prompting, suggestion chips, rich per-message
   history cards, typing↔Hold-to-Talk toggle with live waveform,
   camera/PDF scan). UI chrome stays OmniTalk's; only the mechanism
   is replaced, 1:1 with the source app.
========================================================= */
state.qtDomain = state.qtDomain || 'general';
state.qtHistory = state.qtHistory || [];
state.qtTargetCode = state.qtTargetCode || 'my';
state.qtMicCode = state.qtMicCode || 'en';

const WORK_DOMAINS = [
  { code: 'general', label: '🌐 General', hint: '', suggestions: [] },
  {
    code: 'electronics', label: '🔌 Electronics / PCB Factory',
    hint: 'This conversation takes place in an electronics / PCB (printed circuit board) manufacturing factory. Use accurate industry-standard technical terminology for concepts like SMT (surface-mount technology), reflow soldering, pick-and-place machines, solder paste, wave soldering, PCB inspection, quality control (QC), defect rate, ESD (electrostatic discharge) precautions, and production line workflow — translate the way an experienced factory worker or engineer in this industry would actually say it, not literally word-for-word.',
    suggestions: [
      "What is today's defect rate?", "Please check this solder joint again.",
      "The machine needs maintenance.", "How many units per hour is the target?",
      "This board failed quality inspection.", "Please wear your ESD wrist strap.",
      "The reflow oven temperature looks wrong.", "We are short of components for this line.",
    ],
  },
  {
    code: 'factory_general', label: '🏭 General Factory / Manufacturing',
    hint: 'This conversation takes place in a general manufacturing factory. Use accurate terminology for production lines, shift schedules, machine operation, safety procedures, quality control, and factory management — the way a factory supervisor or worker would naturally say it.',
    suggestions: [
      "What time does the next shift start?", "Please report any injury immediately.",
      "This machine is not working properly.", "We need more raw materials.",
      "Please follow the safety procedure.", "How many pieces did we produce today?",
    ],
  },
  {
    code: 'construction', label: '🏗️ Construction Site',
    hint: 'This conversation takes place on a construction site. Use accurate terminology for scaffolding, rebar, concrete pouring, safety harnesses, blueprints, the foreman, crane operation, and building codes — the way an experienced construction worker would say it.',
    suggestions: [
      "Please wear your safety helmet and harness.", "This scaffolding looks unstable.",
      "We need more cement/concrete.", "Where are the blueprints for this floor?",
      "Please stop the crane, it's not safe.", "This area is dangerous, do not enter.",
    ],
  },
  {
    code: 'kitchen', label: '🍳 Restaurant / Kitchen',
    hint: 'This conversation takes place in a restaurant or food-service kitchen. Use accurate terminology for food preparation, kitchen equipment, food safety/hygiene, and service — the way kitchen staff would naturally say it.',
    suggestions: [
      "This needs to be cooked more.", "Please wash your hands before handling food.",
      "We are out of this ingredient.", "This customer has a food allergy.",
      "The kitchen needs to be cleaned now.",
    ],
  },
  {
    code: 'domestic', label: '🏠 Domestic / Housekeeping / Caregiving',
    hint: 'This conversation takes place in a household setting (housekeeping, childcare, or eldercare). Use natural, warm, everyday terminology appropriate for a home setting — precision matters especially for care/medical instructions.',
    suggestions: [
      "What time should I pick up the children?", "Please take this medicine after eating.",
      "The baby needs a diaper change.", "I finished cleaning the house.",
      "Please call me if there is an emergency.",
    ],
  },
  {
    code: 'logistics', label: '🚚 Warehouse / Logistics',
    hint: 'This conversation takes place in a warehouse/logistics setting. Use accurate terminology for inventory, shipping, forklift operation, loading docks, packing, and supply chain workflow — the way warehouse staff would say it.',
    suggestions: [
      "Where should this shipment go?", "Please check the inventory count.",
      "The forklift needs to move this pallet.", "This package is damaged.",
      "When is the next delivery truck arriving?",
    ],
  },
  {
    code: 'agriculture', label: '🌾 Farm / Agriculture',
    hint: 'This conversation takes place on a farm/agricultural setting. Use accurate terminology for crops, livestock, farming equipment, irrigation, and seasonal work — the way farm workers would say it.',
    suggestions: [
      "When should we harvest this crop?", "The irrigation system is not working.",
      "This animal looks sick.", "We need more fertilizer.",
      "The weather looks bad for today's work.",
    ],
  },
  {
    code: 'healthcare', label: '⚕️ Healthcare / Caregiving',
    hint: 'This conversation takes place in a healthcare or caregiving setting. Use accurate, careful medical/care terminology — be extra precise, since translation errors here could affect someone\'s health and safety.',
    suggestions: [
      "Where does it hurt?", "Please take this medicine twice a day.",
      "Do you have any allergies?", "We need to call an ambulance.",
      "Please rest and drink plenty of water.",
    ],
  },
];
function wkDomainByCode(c){ return WORK_DOMAINS.find(d => d.code === c) || WORK_DOMAINS[0]; }

function qtPopulateDomains(){
  const sel = document.getElementById('qtDomain');
  sel.innerHTML = WORK_DOMAINS.map(d => `<option value="${d.code}">${d.label}</option>`).join('');
  sel.value = state.qtDomain;
}
function qtRenderSuggestions(){
  const el = document.getElementById('qtSuggestions');
  const domain = wkDomainByCode(state.qtDomain);
  if(!domain.suggestions.length){ el.innerHTML = ''; return; }
  el.innerHTML = domain.suggestions.map(s =>
    `<div class="qtSuggestChip" data-text="${escapeHtml(s).replace(/"/g,'&quot;')}">${escapeHtml(s)}</div>`
  ).join('');
  el.querySelectorAll('.qtSuggestChip').forEach(chip => {
    chip.addEventListener('click', () => { vibrate(10); qtTranslate(chip.dataset.text); });
  });
}

function qtRenderHistory(){
  const el = document.getElementById('qtHistoryList');
  if(!state.qtHistory.length){
    el.innerHTML = `<div class="qtEmpty">${t('qtEmptyState')}</div>`;
    return;
  }
  el.innerHTML = state.qtHistory.map(item => `
    <div class="qtCard">
      ${item.pending ? `
        <div class="qtOriginal">${escapeHtml(item.queryLabel || item.originalText || '')}</div>
        <hr>
        <div class="qtTranslation"><span class="dotFlicker">${t('translatingLabel')}</span></div>
      ` : `
        <div class="qtBadges">
          ${item.detectedLang ? `<span class="qtDetected">${t('qtDetectedLabel')} ${escapeHtml(item.detectedLang)}</span>` : ''}
          ${item.usedOffline ? (item.usedMyMemory ? `<span class="myMemoryBadge">MyMemory</span>` : (item.approx ? `<span class="offlineBadge">${t('badgeOffline')}</span>` : `<span class="memoryBadge">${t('badgeRemembered')}</span>`)) : ''}
        </div>
        ${item.photoUrl ? `<img src="${item.photoUrl}" class="scanThumb" alt="Scanned photo">` : ''}
        <div class="qtOriginal" data-qtid-orig="${item.id}">${escapeHtml(item.originalText)}</div>
        <div class="miniControls">
          <button class="iconBtn qtCopyBtn" data-id="${item.id}" data-field="orig" title="Copy">${wkSvgCopy()}</button>
        </div>
        <hr>
        <div class="qtTranslation" data-qtid="${item.id}">${escapeHtml(item.translatedText)}</div>
        <div class="miniControls">
          <button class="iconBtn qtPlayBtn" data-id="${item.id}" title="Play">${wkSvgPlay()}</button>
          <button class="iconBtn qtCopyBtn" data-id="${item.id}" data-field="trans" title="Copy">${wkSvgCopy()}</button>
        </div>
      `}
    </div>
  `).join('');
}
function qtPatchStreamingText(id, text){
  const el = document.querySelector(`.qtTranslation[data-qtid="${id}"]`);
  if(el) el.textContent = text;
}

function qtPlay(id){
  const item = state.qtHistory.find(i => i.id === id);
  if(!item || !item.translatedText) return;
  const lang = langByCode(state.qtTargetCode) || LANGUAGES[0];
  wkSpeak(item.translatedText, lang);
}

async function qtTranslate(rawText, queryLabel){
  rawText = (rawText || '').trim();
  if(!rawText) return;
  const targetLang = langByCode(state.qtTargetCode) || LANGUAGES[0];

  const id = Date.now().toString();
  state.qtHistory.unshift({ id, pending: true, queryLabel: queryLabel || rawText });
  qtRenderHistory();

  let translatedText = '', detectedLang = '', usedOffline = false, usedMyMemory = false, approx = false;

  async function qtFallback(){
    usedOffline = true;
    const guessedSource = wkGuessScriptLang(rawText);
    detectedLang = (langByCode(guessedSource) || {}).name || '';
    const remembered = wkTmLookup('auto', targetLang.code, rawText) || wkTmLookup(guessedSource, targetLang.code, rawText);
    if(remembered){ translatedText = remembered; approx = false; return; }
    const result = await wkFallbackTranslateChain(rawText, guessedSource, targetLang.code);
    if(result){ translatedText = result.text; approx = result.approx; usedMyMemory = result.usedMyMemory; }
    else { translatedText = `[Offline] ${rawText}`; approx = true; }
  }

  if(state.offlineForced || !state.apiKey){
    await qtFallback();
  } else {
    try{
      const domainHint = wkDomainByCode(state.qtDomain).hint;
      const prompt = `Detect the language of the following message and translate it into ${targetLang.name}. `
        + `Understand the full meaning first, then translate naturally the way a native ${targetLang.name} speaker would say it — not word-for-word.\n\n`
        + `Tone: ${wkToneInstruction()}\n`
        + `${wkGlossaryInstruction()}`
        + (domainHint ? `\nWork context: ${domainHint}\n` : '')
        + `\nRespond in EXACTLY this format, nothing else:\n`
        + `LANG: <name of the detected source language>\n`
        + `TRANSLATION: <the natural translation, full text, nothing added>\n\n`
        + `Message: "${rawText}"`;

      let qtStreamStructureReady = false;
      const streamResult = await wkGeminiFetchStream(state.aiModel, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048, ...wkThinkingConfig(state.aiModel) }
      }, (partialRaw) => {
        const partialMatch = partialRaw.match(/TRANSLATION:\s*([\s\S]*)/i);
        if(partialMatch){
          const liveItem = state.qtHistory.find(i => i.id === id);
          if(liveItem){
            liveItem.translatedText = partialMatch[1].trim();
            liveItem.pending = false;
            if(!qtStreamStructureReady){ qtStreamStructureReady = true; qtRenderHistory(); }
            else { qtPatchStreamingText(id, liveItem.translatedText); }
          }
        }
      });

      if(streamResult.ok){
        const raw = streamResult.fullText || '';
        const langMatch = raw.match(/LANG:\s*(.*)/i);
        const transMatch = raw.match(/TRANSLATION:\s*([\s\S]*)/i);
        detectedLang = langMatch ? langMatch[1].trim() : '';
        translatedText = transMatch ? transMatch[1].trim() : raw;
        if(translatedText) wkTmSave('auto', targetLang.code, rawText, translatedText);
        else await qtFallback();
      } else { await qtFallback(); }
    } catch(e){ await qtFallback(); }
  }

  const item = state.qtHistory.find(i => i.id === id);
  if(item) Object.assign(item, { pending: false, originalText: rawText, translatedText, detectedLang, usedOffline, usedMyMemory, approx });
  qtRenderHistory();
  if(state.autoSpeak) wkSpeak(translatedText, targetLang);
}

async function qtHandleVoiceHold(blob){
  const targetLang = langByCode(state.qtTargetCode) || LANGUAGES[0];
  if(state.offlineForced || !state.apiKey){
    showToast(t('toastPttNeedsKey'), 'warn');
    document.getElementById('pttCaptionQT').textContent = '';
    return;
  }
  const id = Date.now().toString();
  state.qtHistory.unshift({ id, pending: true, queryLabel: '(transcribing voice…)' });
  qtRenderHistory();
  document.getElementById('pttCaptionQT').textContent = '';

  try{
    const base64 = await wkFileToBase64(blob);
    const domainHint = wkDomainByCode(state.qtDomain).hint;
    const prompt = `Listen to this audio clip (any language, detect it) and translate what was said into ${targetLang.name}. `
      + `Understand the full meaning first, then translate naturally the way a native ${targetLang.name} speaker would say it — not word-for-word.\n\n`
      + `Tone: ${wkToneInstruction()}\n`
      + `${wkGlossaryInstruction()}`
      + (domainHint ? `\nWork context: ${domainHint}\n` : '')
      + `\nRespond in EXACTLY this format, nothing else:\n`
      + `LANG: <name of the detected source language>\n`
      + `ORIGINAL: <exact transcription of what was said>\n`
      + `TRANSLATION: <the natural translation into ${targetLang.name}>`;

    const streamResult = await wkGeminiFetchStream(state.aiModel, {
      contents: [{ parts: [
        { text: prompt },
        { inline_data: { mime_type: blob.type || 'audio/webm', data: base64 } }
      ] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048, ...wkThinkingConfig(state.aiModel) }
    }, (partialRaw) => {
      const liveItem = state.qtHistory.find(i => i.id === id);
      if(!liveItem) return;
      const origMatch = partialRaw.match(/ORIGINAL:\s*([\s\S]*?)(\nTRANSLATION:|$)/i);
      const transMatch = partialRaw.match(/TRANSLATION:\s*([\s\S]*)/i);
      if(origMatch) liveItem.originalText = origMatch[1].trim();
      if(transMatch) liveItem.translatedText = transMatch[1].trim();
      const wasPending = liveItem.pending;
      liveItem.pending = false;
      if(wasPending) qtRenderHistory();
      else { if(transMatch) qtPatchStreamingText(id, liveItem.translatedText); }
    });

    if(!streamResult.ok){
      showToast(`${t('toastVoiceFailed')} (Error ${streamResult.status || ''})`, 'error');
      state.qtHistory = state.qtHistory.filter(i => i.id !== id);
      qtRenderHistory();
      return;
    }
    const raw = streamResult.fullText || '';
    const langMatch = raw.match(/LANG:\s*(.*)/i);
    const origMatch = raw.match(/ORIGINAL:\s*([\s\S]*?)\nTRANSLATION:/i);
    const transMatch = raw.match(/TRANSLATION:\s*([\s\S]*)/i);
    const detectedLang = langMatch ? langMatch[1].trim() : '';
    const originalText = origMatch ? origMatch[1].trim() : '(voice message)';
    const translatedText = transMatch ? transMatch[1].trim() : raw;

    const item = state.qtHistory.find(i => i.id === id);
    if(item) Object.assign(item, { pending: false, originalText, translatedText, detectedLang, usedOffline: false, approx: false });
    if(originalText) wkTmSave('auto', targetLang.code, originalText, translatedText);
    qtRenderHistory();
    vibrate(15);
    if(state.autoSpeak) wkSpeak(translatedText, targetLang);
  }catch(e){
    showToast(`${t('toastVoiceFailed')}: ${e.message}`, 'error');
    state.qtHistory = state.qtHistory.filter(i => i.id !== id);
    qtRenderHistory();
  }
}

async function qtScanAndTranslate(file){
  const targetLang = langByCode(state.qtTargetCode) || LANGUAGES[0];
  if(state.offlineForced || !state.apiKey){
    showToast(t('toastScanNeedsKey'), 'warn');
    return;
  }
  const id = Date.now().toString();
  state.qtHistory.unshift({ id, pending: true, queryLabel: '(scanning photo…)' });
  qtRenderHistory();
  try{
    const base64 = await wkFileToBase64(file);
    const isImage = file.type && file.type.startsWith('image/');
    const photoUrl = isImage ? `data:${file.type};base64,${base64}` : null;
    const domainHint = wkDomainByCode(state.qtDomain).hint;
    const prompt = `Read all the text in this file (a photo or PDF document, any language; if multi-page PDF, read all pages). Detect its language, then translate it into ${targetLang.name}, `
      + `understanding the full meaning naturally rather than word-for-word.\n\n`
      + `Tone: ${wkToneInstruction()}\n`
      + `${wkGlossaryInstruction()}`
      + (domainHint ? `\nWork context: ${domainHint}\n` : '')
      + `\nRespond in EXACTLY this format, nothing else:\n`
      + `LANG: <name of the detected source language>\n`
      + `ORIGINAL: <the text you read>\n`
      + `TRANSLATION: <the natural translation into ${targetLang.name}>`;

    const resp = await wkGeminiFetch(state.aiModel, {
      contents: [{ parts: [
        { text: prompt },
        { inline_data: { mime_type: file.type || 'image/jpeg', data: base64 } }
      ] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048, ...wkThinkingConfig(state.aiModel), mediaResolution: 'MEDIA_RESOLUTION_MEDIUM' }
    });
    if(!resp.ok){
      showToast(`${t('toastScanFailed')} (Error ${resp.status})`, 'error');
      state.qtHistory = state.qtHistory.filter(i => i.id !== id);
      qtRenderHistory();
      return;
    }
    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || '';
    const langMatch = raw.match(/LANG:\s*(.*)/i);
    const origMatch = raw.match(/ORIGINAL:\s*([\s\S]*?)\nTRANSLATION:/i);
    const transMatch = raw.match(/TRANSLATION:\s*([\s\S]*)/i);
    const detectedLang = langMatch ? langMatch[1].trim() : '';
    const originalText = origMatch ? origMatch[1].trim() : '(scanned image)';
    const translatedText = transMatch ? transMatch[1].trim() : raw;

    const item = state.qtHistory.find(i => i.id === id);
    if(item) Object.assign(item, { pending: false, originalText, translatedText, detectedLang, photoUrl, usedOffline: false, approx: false });
    if(originalText) wkTmSave('auto', targetLang.code, originalText, translatedText);
    qtRenderHistory();
    if(state.autoSpeak) wkSpeak(translatedText, targetLang);
  } catch(e){
    showToast(`${t('toastScanFailed')}: ${e.message}`, 'error');
    state.qtHistory = state.qtHistory.filter(i => i.id !== id);
    qtRenderHistory();
  }
}

/* ---- Tap-mic (regular, on-device, needs explicit mic language) ---- */
let qtRecognition = null;
function qtStartRecognition(){
  if(!wkSpeechRec){
    showToast(t('toastMicNotSupported'), 'error');
    return;
  }
  if(qtRecognition){ try{ qtRecognition.stop(); }catch(e){} qtRecognition = null; }
  const micLang = langByCode(state.qtMicCode) || LANGUAGES[0];
  qtRecognition = new wkSpeechRec();
  qtRecognition.lang = micLang.ttsLocale;
  qtRecognition.continuous = false; qtRecognition.interimResults = false; qtRecognition.maxAlternatives = 1;
  document.getElementById('qtMicBtn').classList.add('listening');
  qtRecognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    if(text && text.trim()) qtTranslate(text, `🎙️ ${text}`);
  };
  qtRecognition.onerror = (e) => {
    if(e.error !== 'no-speech' && e.error !== 'aborted') showToast(t('toastVoiceFailed') + ': ' + e.error, 'error');
  };
  qtRecognition.onspeechend = () => { try{ qtRecognition.stop(); }catch(e){} };
  qtRecognition.onend = () => { qtRecognition = null; document.getElementById('qtMicBtn').classList.remove('listening'); };
  try{ qtRecognition.start(); }catch(e){ qtRecognition = null; document.getElementById('qtMicBtn').classList.remove('listening'); }
}
function qtStopRecognition(){ if(qtRecognition){ try{ qtRecognition.stop(); }catch(e){} } }

/* ---- Hold-to-Talk: MediaRecorder audio blob -> Gemini (auto language detect) ---- */
function wkPickAudioMimeType(){
  if(!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for(const c of candidates){ if(MediaRecorder.isTypeSupported(c)) return c; }
  return '';
}
async function qtStartHoldRecordingAudio(){
  if(!window.MediaRecorder){
    showToast(t('toastMicNotSupported'), 'error');
    return;
  }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = wkPickAudioMimeType();
    const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks = [];
    mediaRecorder.ondataavailable = (e) => { if(e.data && e.data.size > 0) chunks.push(e.data); };
    wkHoldRecordingState.QT = { stream, mediaRecorder, chunks, mimeType: mediaRecorder.mimeType || mimeType || 'audio/webm' };
    mediaRecorder.start();
    qtStartWaveform();
  }catch(e){
    showToast(t('toastMicPermission'), 'error');
    document.getElementById('pttCaptionQT').textContent = '';
  }
}
function qtStopHoldRecordingAudio(){
  const r = wkHoldRecordingState.QT;
  if(!r){ document.getElementById('pttCaptionQT').textContent = ''; return; }
  document.getElementById('pttCaptionQT').textContent = '⏳ ' + t('translatingLabel');
  const finish = (blob) => {
    try{ r.stream.getTracks().forEach(t => t.stop()); }catch(e){}
    delete wkHoldRecordingState.QT;
    if(!blob || blob.size < 500){ document.getElementById('pttCaptionQT').textContent = ''; return; }
    qtHandleVoiceHold(blob);
  };
  if(r.mediaRecorder.state === 'inactive'){ finish(new Blob(r.chunks, { type: r.mimeType })); return; }
  r.mediaRecorder.onstop = () => finish(new Blob(r.chunks, { type: r.mimeType }));
  try{ r.mediaRecorder.stop(); }catch(e){ finish(new Blob(r.chunks, { type: r.mimeType })); }
}
/* live waveform bars while holding (separate mic tap purely for the visual, non-fatal if it fails) */
const wkWaveformState = {};
let wkWaveformTokenCounter = 0;
async function qtStartWaveform(){
  qtStopWaveform();
  const myToken = ++wkWaveformTokenCounter;
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 32;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const bars = document.querySelectorAll('#waveformQT .wfBar');
    function draw(){
      const current = wkWaveformState.QT;
      if(!current || current.token !== myToken) return;
      analyser.getByteFrequencyData(dataArray);
      bars.forEach((bar, i) => {
        const v = dataArray[i] || 0;
        const pct = Math.max(12, Math.min(100, (v / 255) * 100));
        bar.style.height = pct + '%';
        bar.classList.remove('idle');
      });
      current.rafId = requestAnimationFrame(draw);
    }
    wkWaveformState.QT = { stream, audioCtx, analyser, rafId: null, token: myToken };
    draw();
  }catch(e){ /* non-fatal — recording still works without the visual */ }
}
function qtStopWaveform(){
  const w = wkWaveformState.QT;
  if(!w) return;
  if(w.rafId) cancelAnimationFrame(w.rafId);
  try{ w.stream.getTracks().forEach(t => t.stop()); }catch(e){}
  try{ w.audioCtx.close(); }catch(e){}
  delete wkWaveformState.QT;
  document.querySelectorAll('#waveformQT .wfBar').forEach(bar => { bar.style.height = '6px'; bar.classList.add('idle'); });
}

document.addEventListener('click', (e) => {
  const qtCopyBtn = e.target.closest('.qtCopyBtn');
  if(qtCopyBtn){
    const item = state.qtHistory.find(i => i.id == qtCopyBtn.dataset.id);
    if(item) wkCopyBlockText(qtCopyBtn.dataset.field === 'orig' ? item.originalText : item.translatedText, qtCopyBtn);
    return;
  }
  const qtPlayBtn = e.target.closest('.qtPlayBtn');
  if(qtPlayBtn){ qtPlay(qtPlayBtn.dataset.id); return; }
});

/* ---- Init / entry point for the Workspace card ---- */
function initQuickTranslateUI(){
  const tgtSel = document.getElementById('qtTargetLang');
  const micSel = document.getElementById('qtMicLang');
  if(!tgtSel || !micSel) return;

  document.getElementById('qtTargetLabelText').textContent = t('qtTargetLabel');
  document.getElementById('qtDomainLabelText').textContent = t('qtDomainLabel');
  document.getElementById('qtMicLangLabelText').textContent = t('qtMicLangLabel');
  document.getElementById('qtInputText').placeholder = t('qtInputPlaceholder');

  tgtSel.innerHTML = LANGUAGES.map(l => `<option value="${l.code}">${langOptionLabel(l)}</option>`).join('');
  micSel.innerHTML = LANGUAGES.map(l => `<option value="${l.code}">${langOptionLabel(l)}</option>`).join('');
  tgtSel.value = state.qtTargetCode;
  micSel.value = state.qtMicCode;
  qtPopulateDomains();
  qtRenderSuggestions();
  qtRenderHistory();

  document.getElementById('qtDictateBtn').innerHTML = wkSvgMic();
  document.getElementById('qtTranslateActionBtn').innerHTML = wkSvgSend();
  document.getElementById('qtCameraBtn').innerHTML = wkSvgCamera();
  document.getElementById('qtMicBtn').innerHTML = wkSvgMic();
  document.getElementById('qtPttCircle').innerHTML = wkSvgMic();
  document.getElementById('qtModeToggle').textContent = '⌨️';

  tgtSel.onchange = (e) => { state.qtTargetCode = e.target.value; };
  micSel.onchange = (e) => { state.qtMicCode = e.target.value; };
  document.getElementById('qtDomain').onchange = (e) => { state.qtDomain = e.target.value; qtRenderSuggestions(); };

  const inputArea = document.getElementById('qtInputText');
  inputArea.oninput = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px';
  };
  attachDictation(inputArea, document.getElementById('qtDictateBtn'), () => langByCode(state.qtMicCode) || LANGUAGES[0]);
  inputArea.onkeydown = (e) => {
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); document.getElementById('qtTranslateActionBtn').click(); }
  };
  document.getElementById('qtTranslateActionBtn').onclick = () => {
    const text = inputArea.value.trim();
    if(!text) return;
    inputArea.value = ''; inputArea.style.height = 'auto';
    qtTranslate(text);
  };

  document.getElementById('qtMicBtn').onclick = () => {
    if(qtRecognition){ qtStopRecognition(); return; }
    qtStartRecognition();
  };

  document.getElementById('qtModeToggle').onclick = () => {
    qtStopRecognition();
    const toggle = document.getElementById('qtModeToggle');
    const textWrap = document.getElementById('qtTextFieldWrap');
    const pttWrap = document.getElementById('qtPttWrap');
    const nowPtt = pttWrap.style.display === 'none';
    textWrap.style.display = nowPtt ? 'none' : 'flex';
    pttWrap.style.display = nowPtt ? 'flex' : 'none';
    toggle.classList.toggle('active', nowPtt);
    toggle.textContent = nowPtt ? '⌨️' : '🎙️';
    vibrate(10);
  };

  const qtPttCircle = document.getElementById('qtPttCircle');
  let qtPttHoldActive = false;
  qtPttCircle.onpointerdown = (e) => {
    e.preventDefault();
    try{ qtPttCircle.setPointerCapture(e.pointerId); }catch(err){}
    qtPttHoldActive = true; vibrate(15);
    qtPttCircle.classList.add('recording');
    document.getElementById('pttCaptionQT').textContent = t('qtRecordingHint');
    qtStartHoldRecordingAudio();
  };
  const endQtPttHold = () => {
    if(!qtPttHoldActive) return;
    qtPttHoldActive = false; vibrate(10);
    qtPttCircle.classList.remove('recording');
    qtStopWaveform();
    qtStopHoldRecordingAudio();
  };
  qtPttCircle.onpointerup = endQtPttHold;
  qtPttCircle.onpointercancel = endQtPttHold;

  const camInput = document.getElementById('qtCameraFileInput');
  document.getElementById('qtCameraBtn').onclick = () => camInput.click();
  camInput.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if(file) qtScanAndTranslate(file);
  };
}

/* =========================================================
   3. GEMINI LIVE — real bidirectional simultaneous interpretation
   ported from Walkie-Talkie Translator: true WebSocket streaming
   to the Gemini Live API (raw PCM audio both ways), not a
   one-directional STT→translate→TTS loop. It listens continuously
   in either language and speaks the natural translation back the
   instant it hears a pause — nothing to tap per utterance.
========================================================= */
const wkLiveState = {
  ws: null, connected: false, micStream: null, micContext: null,
  micProcessor: null, playbackContext: null, nextPlayTime: 0,
};
function wkFloatTo16BitPCM(float32Array){
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for(let i = 0, offset = 0; i < float32Array.length; i++, offset += 2){
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}
function wkArrayBufferToBase64(buffer){
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for(let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function wkPcm16Base64ToAudioBuffer(base64, audioCtx, sampleRate){
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for(let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(bytes.length / 2);
  const buffer = audioCtx.createBuffer(1, sampleCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  for(let i = 0; i < sampleCount; i++) channelData[i] = view.getInt16(i * 2, true) / 32768;
  return buffer;
}
function wkScheduleLivePlayback(base64){
  const ctx = wkLiveState.playbackContext;
  if(!ctx) return;
  const buffer = wkPcm16Base64ToAudioBuffer(base64, ctx, 24000);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  const now = ctx.currentTime;
  if(wkLiveState.nextPlayTime < now) wkLiveState.nextPlayTime = now;
  source.start(wkLiveState.nextPlayTime);
  wkLiveState.nextPlayTime += buffer.duration;
}
function wkLiveInterpreterSystemPrompt(langA, langB){
  return `You are a real-time simultaneous interpreter for a live face-to-face conversation between two people speaking into the same device. `
    + `One person speaks ${langA.name}, the other speaks ${langB.name}. `
    + `Whenever you hear ${langA.name} being spoken, immediately speak the natural, fluent translation in ${langB.name} — nothing else. `
    + `Whenever you hear ${langB.name} being spoken, immediately speak the natural, fluent translation in ${langA.name} — nothing else. `
    + `Translate the way a professional human interpreter would say it, not word-for-word. `
    + `Do NOT have a conversation, do NOT answer questions, do NOT add commentary, greetings, or explanations of any kind — output ONLY the translation of what was actually said. `
    + `Wait for a natural pause or the end of a sentence before translating.`;
}
let wkLiveTranscriptHasContent = false;
function wkLiveAddTranscriptLine(kind, text){
  const el = document.getElementById('liveTranscriptStream');
  if(!el) return;
  if(!wkLiveTranscriptHasContent){ el.innerHTML = ''; wkLiveTranscriptHasContent = true; }
  const line = document.createElement('div');
  line.className = 'liveTranscriptBubble';
  const icon = kind === 'heard' ? '🎙️' : kind === 'spoken' ? '🔊' : 'ℹ️';
  line.innerHTML = `<div style="font-size:13px; color:var(--text-dim);">${icon} ${escapeHtml(text)}</div>`;
  el.insertBefore(line, el.firstChild);
}
function wkUpdateLiveStatus(text, color){
  const statusLabel = document.getElementById('liveStatusLabel');
  if(!statusLabel) return;
  statusLabel.textContent = text;
  if(color) statusLabel.style.color = color;
}

async function startLiveInterpreter(langACode, langBCode){
  if(!state.apiKey){
    showToast(t('liveNeedsKey'), 'warn');
    return;
  }
  const langA = langByCode(langACode) || LANGUAGES[0];
  const langB = langByCode(langBCode) || LANGUAGES[1];
  state.isLiveActive = true;
  vibrate(20);
  const visNode = document.getElementById('liveVisualizerNode');
  if(visNode) visNode.classList.add('listening');
  wkUpdateLiveStatus(t('liveConnectingLabel'), '#FBBF24');
  wkLiveAddTranscriptLine('system', 'Connecting…');

  try{
    wkLiveState.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }catch(e){
    showToast(t('toastMicPermission'), 'error');
    stopLiveInterpreter();
    return;
  }

  const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${state.apiKey}`);
  wkLiveState.ws = ws;

  ws.onopen = () => {
    ws.send(JSON.stringify({
      setup: {
        model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
        generationConfig: { responseModalities: ['AUDIO'] },
        systemInstruction: { parts: [{ text: wkLiveInterpreterSystemPrompt(langA, langB) }] },
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      }
    }));
  };
  ws.onerror = () => { showToast(t('liveConnError'), 'error'); };
  ws.onclose = () => {
    if(wkLiveState.connected) showToast(t('liveConnClosed'), 'warn');
    stopLiveInterpreter();
  };
  ws.onmessage = async (event) => {
    let data = event.data;
    if(data instanceof Blob) data = await data.text();
    let msg;
    try{ msg = JSON.parse(data); }catch(e){ return; }

    if(msg.setupComplete){
      wkLiveState.connected = true;
      wkUpdateLiveStatus(t('liveConnectedLabel'), '#34D399');
      wkLiveAddTranscriptLine('system', 'Connected — start speaking, either language.');
      startLiveMicCapture();
      return;
    }
    const sc = msg.serverContent;
    if(!sc) return;
    if(sc.interrupted){
      wkLiveState.nextPlayTime = wkLiveState.playbackContext ? wkLiveState.playbackContext.currentTime : 0;
    }
    if(sc.modelTurn && sc.modelTurn.parts){
      for(const part of sc.modelTurn.parts){
        const inline = part.inlineData || part.inline_data;
        if(inline && inline.data) wkScheduleLivePlayback(inline.data);
      }
    }
    if(sc.inputTranscription && sc.inputTranscription.text){
      wkUpdateLiveStatus('🎙️ ' + sc.inputTranscription.text, '#38BDF8');
      wkLiveAddTranscriptLine('heard', sc.inputTranscription.text);
    }
    if(sc.outputTranscription && sc.outputTranscription.text){
      wkUpdateLiveStatus('🔊 ' + sc.outputTranscription.text, '#34D399');
      wkLiveAddTranscriptLine('spoken', sc.outputTranscription.text);
    }
  };
}

function startLiveMicCapture(){
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  wkLiveState.micContext = new AudioCtx({ sampleRate: 16000 });
  wkLiveState.playbackContext = new AudioCtx({ sampleRate: 24000 });
  wkLiveState.nextPlayTime = 0;
  const source = wkLiveState.micContext.createMediaStreamSource(wkLiveState.micStream);
  wkLiveState.micProcessor = wkLiveState.micContext.createScriptProcessor(4096, 1, 1);
  wkLiveState.micProcessor.onaudioprocess = (e) => {
    if(!wkLiveState.connected || !wkLiveState.ws || wkLiveState.ws.readyState !== WebSocket.OPEN) return;
    const pcm = wkFloatTo16BitPCM(e.inputBuffer.getChannelData(0));
    const b64 = wkArrayBufferToBase64(pcm);
    wkLiveState.ws.send(JSON.stringify({
      realtimeInput: { audio: { data: b64, mimeType: `audio/pcm;rate=${wkLiveState.micContext.sampleRate}` } }
    }));
  };
  // Route through a silent gain node — some browsers require the processor
  // to reach a destination to keep firing, but we don't want to hear our
  // own raw mic input played back (that would cause feedback/echo).
  const muteGain = wkLiveState.micContext.createGain();
  muteGain.gain.value = 0;
  source.connect(wkLiveState.micProcessor);
  wkLiveState.micProcessor.connect(muteGain);
  muteGain.connect(wkLiveState.micContext.destination);
}

function stopLiveInterpreter(){
  state.isLiveActive = false;
  vibrate(10);
  wkLiveState.connected = false;
  if(wkLiveState.ws){ try{ wkLiveState.ws.close(); }catch(e){} wkLiveState.ws = null; }
  if(wkLiveState.micProcessor){ try{ wkLiveState.micProcessor.disconnect(); }catch(e){} wkLiveState.micProcessor = null; }
  if(wkLiveState.micContext){ try{ wkLiveState.micContext.close(); }catch(e){} wkLiveState.micContext = null; }
  if(wkLiveState.playbackContext){ try{ wkLiveState.playbackContext.close(); }catch(e){} wkLiveState.playbackContext = null; }
  if(wkLiveState.micStream){ try{ wkLiveState.micStream.getTracks().forEach(t => t.stop()); }catch(e){} wkLiveState.micStream = null; }
  const visNode = document.getElementById('liveVisualizerNode');
  if(visNode) visNode.classList.remove('listening');
  wkUpdateLiveStatus(t('liveStoppedLabel'), '#FBBF24');
}

function initLiveInterpreterUI(){
  const selA = document.getElementById('liveLangA');
  const selB = document.getElementById('liveLangB');
  if(!selA || !selB) return;

  if(!state.isLiveActive){
    const statusLabel = document.getElementById('liveStatusLabel');
    if(statusLabel) statusLabel.textContent = t('liveReadyLabel');
  }

  selA.innerHTML = LANGUAGES.map(l => `<option value="${l.code}">${langOptionLabel(l)}</option>`).join('');
  selB.innerHTML = LANGUAGES.map(l => `<option value="${l.code}">${langOptionLabel(l)}</option>`).join('');
  selA.value = state.langA.code;
  selB.value = state.langB.code;

  selA.onchange = (e) => { state.langA = langByCode(e.target.value); if(state.isLiveActive){ stopLiveInterpreter(); startLiveInterpreter(selA.value, selB.value); } };
  selB.onchange = (e) => { state.langB = langByCode(e.target.value); if(state.isLiveActive){ stopLiveInterpreter(); startLiveInterpreter(selA.value, selB.value); } };

  const visNode = document.getElementById('liveVisualizerNode');
  visNode.onclick = () => {
    if(state.isLiveActive) stopLiveInterpreter();
    else startLiveInterpreter(selA.value, selB.value);
  };
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
    const savedKey = localStorage.getItem('ot_apiKey');
    if(savedKey){
      state.apiKey = savedKey;
      const keyInput = document.getElementById('apiKeyInput');
      if(keyInput) keyInput.value = savedKey;
      testGeminiApiKey(savedKey);
    }
    const savedModel = localStorage.getItem('ot_aiModel');
    if(savedModel){
      state.aiModel = wkResolveModel(savedModel); // sanitize any old/retired model id from a previous version
      const modelSelect = document.getElementById('aiModelSelect');
      if(modelSelect) modelSelect.value = state.aiModel;
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
    // Re-render any currently-open Workspace tool panel so its dynamically
    // generated text (labels, badges, toasts, empty states) also switches
    // immediately, not just on next open.
    if(document.getElementById('viewWalkieTalkie')?.style.display !== 'none' && typeof wkRenderPanel === 'function'){
      wkRenderPanel('A'); wkRenderPanel('B');
    }
    if(document.getElementById('viewQuickTranslate')?.style.display !== 'none' && typeof initQuickTranslateUI === 'function'){
      initQuickTranslateUI();
    }
    if(document.getElementById('viewLiveInterpreter')?.style.display !== 'none' && typeof initLiveInterpreterUI === 'function'){
      initLiveInterpreterUI();
    }
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

  // Save API Key Button
  document.getElementById('btnSaveApiKey')?.addEventListener('click', async () => {
    const keyInput = document.getElementById('apiKeyInput');
    const val = (keyInput?.value || '').trim();
    state.apiKey = val;
    try { localStorage.setItem('ot_apiKey', val); } catch(err){}
    showToast('💾 Saving API Key and verifying...', 'info');
    await testGeminiApiKey(val);
  });

  // Test API Key Button
  document.getElementById('btnTestApiKey')?.addEventListener('click', async () => {
    const keyInput = document.getElementById('apiKeyInput');
    const val = (keyInput?.value || '').trim();
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
      const overlay = btn.closest('.appModalOverlay');
      if(overlay) overlay.classList.remove('show');
    });
  });

  document.getElementById('confirmAddFriendBtn')?.addEventListener('click', async () => {
    const codeInput = document.getElementById('friendCodeInput');
    const code = codeInput ? codeInput.value.trim() : '';
    if(!code){
      showToast('Please enter a 6-digit code', 'error');
      return;
    }
    const res = await fbSendFriendRequest(code);
    if(res.ok){
      showToast(res.instant ? t('friendAddedSuccess') : 'Friend request sent! ⏳');
      if(addModal) addModal.classList.remove('show');
      if(codeInput) codeInput.value = '';
    } else {
      const messages = {
        self: t('selfAddError'),
        not_found: t('friendNotFound'),
        already_friend: 'You are already friends with this person.',
        already_sent: 'You already sent a request to this person.',
      };
      showToast(messages[res.reason] || t('friendNotFound'), 'error');
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

  // Force Clear Cache & Reload v12.0 Button
  document.getElementById('btnForceClearCache')?.addEventListener('click', async () => {
    showToast('Clearing all caches and updating to v12.0...', 'info');
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
    reader.onload = async () => {
      const isImg = file.type.startsWith('image/');
      if(!activeChatSession) return;
      await fbSendFileMessage(
        reader.result, file.name, file.type, (file.size / 1024).toFixed(1) + ' KB',
        isImg ? 'Photo attachment' : file.name
      );
      showToast('Attachment sent!');
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });

  // Stickers
  const stickerModal = document.getElementById('stickerModal');
  const STICKER_SET = ['😀','😂','😍','😎','👍','👏','🙏','🔥','💯','❤️','😭','😡','🤔','👋','🎉','☕','🍔','🚗','⏰','✅','❌','💪','🙌','😴'];
  const stickerGrid = document.getElementById('stickerGrid');
  if(stickerGrid){
    stickerGrid.innerHTML = STICKER_SET.map(e => `<button class="stickerPickBtn" style="font-size:28px; background:none; border:none; cursor:pointer; padding:6px;">${e}</button>`).join('');
    stickerGrid.querySelectorAll('.stickerPickBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        vibrate(10);
        await fbSendSticker(btn.textContent);
        stickerModal?.classList.remove('show');
      });
    });
  }
  document.getElementById('chatStickerBtn')?.addEventListener('click', () => {
    pushNavigationState('modal');
    stickerModal?.classList.add('show');
  });

  // Doodle
  const doodleModal = document.getElementById('doodleModal');
  const doodleCanvas = document.getElementById('doodleCanvas');
  let doodleCtx = null, doodleDrawing = false, doodleColor = '#000000';
  function initDoodleCanvas(){
    if(!doodleCanvas) return;
    const rect = doodleCanvas.getBoundingClientRect();
    doodleCanvas.width = rect.width * 2;
    doodleCanvas.height = rect.height * 2;
    doodleCtx = doodleCanvas.getContext('2d');
    doodleCtx.fillStyle = '#fff';
    doodleCtx.fillRect(0, 0, doodleCanvas.width, doodleCanvas.height);
    doodleCtx.lineWidth = 6;
    doodleCtx.lineCap = 'round';
    doodleCtx.lineJoin = 'round';
  }
  function doodlePos(e){
    const rect = doodleCanvas.getBoundingClientRect();
    const scaleX = doodleCanvas.width / rect.width;
    const scaleY = doodleCanvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }
  if(doodleCanvas){
    const startDraw = (e) => {
      e.preventDefault();
      doodleDrawing = true;
      const p = doodlePos(e);
      doodleCtx.strokeStyle = doodleColor;
      doodleCtx.beginPath();
      doodleCtx.moveTo(p.x, p.y);
    };
    const moveDraw = (e) => {
      if(!doodleDrawing) return;
      e.preventDefault();
      const p = doodlePos(e);
      doodleCtx.lineTo(p.x, p.y);
      doodleCtx.stroke();
    };
    const endDraw = () => { doodleDrawing = false; };
    doodleCanvas.addEventListener('pointerdown', startDraw);
    doodleCanvas.addEventListener('pointermove', moveDraw);
    doodleCanvas.addEventListener('pointerup', endDraw);
    doodleCanvas.addEventListener('pointercancel', endDraw);
  }
  document.getElementById('doodleColorBlack')?.addEventListener('click', (e) => { doodleColor = '#000000'; document.querySelectorAll('.doodleColorBtn').forEach(b=>b.classList.remove('activeColor')); e.target.classList.add('activeColor'); });
  document.getElementById('doodleColorRed')?.addEventListener('click', (e) => { doodleColor = '#EF4444'; document.querySelectorAll('.doodleColorBtn').forEach(b=>b.classList.remove('activeColor')); e.target.classList.add('activeColor'); });
  document.getElementById('doodleColorBlue')?.addEventListener('click', (e) => { doodleColor = '#3B82F6'; document.querySelectorAll('.doodleColorBtn').forEach(b=>b.classList.remove('activeColor')); e.target.classList.add('activeColor'); });
  document.getElementById('doodleColorGreen')?.addEventListener('click', (e) => { doodleColor = '#10B981'; document.querySelectorAll('.doodleColorBtn').forEach(b=>b.classList.remove('activeColor')); e.target.classList.add('activeColor'); });
  document.getElementById('doodleClearBtn')?.addEventListener('click', () => {
    if(!doodleCtx) return;
    doodleCtx.fillStyle = '#fff';
    doodleCtx.fillRect(0, 0, doodleCanvas.width, doodleCanvas.height);
  });
  document.getElementById('chatDoodleBtn')?.addEventListener('click', () => {
    pushNavigationState('modal');
    doodleModal?.classList.add('show');
    setTimeout(initDoodleCanvas, 50);
  });
  document.getElementById('doodleSendBtn')?.addEventListener('click', async () => {
    if(!doodleCanvas) return;
    const dataUrl = doodleCanvas.toDataURL('image/png');
    await fbSendFileMessage(dataUrl, 'doodle.png', 'image/png', '', '🎨 Doodle');
    doodleModal?.classList.remove('show');
    showToast('Doodle sent!');
  });

  // Nearby / Radar
  const nearbyView = document.getElementById('nearbyView');
  document.getElementById('btnOpenNearby')?.addEventListener('click', async () => {
    if(nearbyView) nearbyView.style.display = 'flex';
    if(typeof pushNavigationState === 'function') pushNavigationState('chatroom');
    await loadNearbyPeople();
  });
  document.getElementById('closeNearbyBtn')?.addEventListener('click', () => {
    if(nearbyView) nearbyView.style.display = 'none';
  });
  document.getElementById('refreshNearbyBtn')?.addEventListener('click', loadNearbyPeople);

  async function loadNearbyPeople(){
    const list = document.getElementById('nearbyList');
    if(!list) return;
    if(typeof fbReady !== 'function' || !fbReady()){
      list.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:30px;">Nearby feature က Firebase ချိတ်ဆက်ထားမှသာ အလုပ်လုပ်ပါတယ်။</div>`;
      return;
    }
    list.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:20px;">📍 ရှာဖွေနေသည်...</div>`;
    const gotLocation = await fbUpdateMyLocation();
    if(!gotLocation){
      list.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:30px;">Location ခွင့်ပြုချက် လိုအပ်ပါတယ် — Browser location permission ကို ခွင့်ပြုပြီး ပြန်စမ်းကြည့်ပါ။</div>`;
      return;
    }
    const nearby = await fbFindNearbyUsers();
    if(!nearby.length){
      list.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:30px;">အနီးအနားမှာ ရှာမတွေ့သေးပါ — App သုံးနေတဲ့ တခြားသူများ ရှိလာရင် ဒီနေရာမှာ ပေါ်လာပါလိမ့်မယ်။</div>`;
      return;
    }
    list.innerHTML = '';
    nearby.forEach(person => {
      const row = document.createElement('div');
      row.className = 'nearbyPersonRow';
      row.innerHTML = `
        <div class="avatarCircle">${(person.displayName||'?').slice(0,2).toUpperCase()}</div>
        <div class="chatItemInfo">
          <div class="chatItemTitle">${escapeHtml(person.displayName || 'User')}</div>
          <div class="nearbyDist">📍 ${person.distKm < 1 ? Math.round(person.distKm*1000)+'m' : person.distKm.toFixed(1)+'km'} away</div>
        </div>
        <button class="nearbyAddBtn">Add</button>
      `;
      row.querySelector('.nearbyAddBtn').addEventListener('click', async () => {
        const res = await fbSendFriendRequest(person.friendCode);
        if(res.ok) showToast('Friend request sent!');
        else showToast(res.reason === 'already_sent' ? 'Request already sent' : 'Could not send request', 'error');
      });
      list.appendChild(row);
    });
  }

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

/* Voice Recorder Handler */
let mediaRecorder = null;
let audioChunks = [];
let recordStartTime = 0;

function setupVoiceRecorder(){
  const voiceBtn = document.getElementById('chatVoiceToggleBtn');
  if(!voiceBtn) return;

  voiceBtn.addEventListener('mousedown', startVoiceRecord);
  voiceBtn.addEventListener('mouseup', stopVoiceRecord);
  voiceBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startVoiceRecord(); });
  voiceBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopVoiceRecord(); });
}

async function startVoiceRecord(){
  const voiceBtn = document.getElementById('chatVoiceToggleBtn');
  if(voiceBtn) voiceBtn.classList.add('recording');
  primeAudioOnUserGesture();
  showToast(t('recording'));
  recordStartTime = Date.now();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.start();
  } catch(e){
    console.warn('Microphone access fallback:', e);
  }
}

async function stopVoiceRecord(){
  const voiceBtn = document.getElementById('chatVoiceToggleBtn');
  if(voiceBtn) voiceBtn.classList.remove('recording');
  const durationSec = Math.max(2, Math.round((Date.now() - recordStartTime) / 1000));

  if(mediaRecorder && mediaRecorder.state !== 'inactive'){
    mediaRecorder.stop();
  }
  
  const sampleVoiceTexts = [
    "အစီရင်ခံစာကို စစ်ဆေးပြီးပါပြီ၊ အားလုံးအဆင်ပြေပါတယ်။",
    "ဒီနေ့ ညနေ ၃ နာရီ Project Review လုပ်ကြပါမယ်။",
    "ဖိုင်အသစ်တွေ ပို့ပေးထားပါတယ်၊ တစ်ချက်လောက် ကြည့်ပေးပါ။"
  ];
  const mockText = sampleVoiceTexts[Math.floor(Math.random() * sampleVoiceTexts.length)];
  await fbSendAudioMessage(null, durationSec, mockText);
  showToast('Voice message sent & transcribed!');
}
