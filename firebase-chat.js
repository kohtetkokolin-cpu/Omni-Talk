/* ==========================================================
   OmniTalk PRO v9.0 — firebase-chat.js
   Secure AI & Neural Cross-Language Translation Pipeline
   Features:
   - Direct Secure Client-to-Google TLS Calling
   - Multi-Model Gemini 2.5 / 2.0 / 1.5 Architecture
   - Google Neural AI Free Fallback Engine
   - 1:1 Direct Chat & Work Group Chat
   - Voice Note Recording with Audio & AI Transcribe
========================================================== */

let fbApp = null, fbAuth = null, fbDb = null, fbStorage = null;
let currentUser = null;
let activeChatSession = null;
let activeChatUnsub = null;
let activeReadingLang = 'my';
let myFriendsCache = [];
let myGroupsCache = [];
const translationCache = {};

function fbReady(){
  return !!(fbAuth && fbAuth.currentUser && fbDb);
}

function isFirebaseConfigured(){
  return typeof FIREBASE_CONFIG !== 'undefined' &&
         FIREBASE_CONFIG.apiKey &&
         !FIREBASE_CONFIG.apiKey.includes('YOUR_FIREBASE_API_KEY');
}

/** Initialize Firebase & Profile */
async function fbInit(){
  activeReadingLang = (typeof state !== 'undefined' && state.uiLanguage) || 'my';
  const langSelect = document.getElementById('chatReadingLangSelect');
  if(langSelect) langSelect.value = activeReadingLang;

  if(typeof firebase === 'undefined' || !isFirebaseConfigured()){
    setupLocalDemoUser();
    return false;
  }
  try{
    fbApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    // Storage is optional — a project without Storage/Blaze enabled yet
    // must NOT take down Auth+Firestore (which work fine on their own).
    try{
      if(typeof firebase.storage === 'function') fbStorage = firebase.storage();
    }catch(storageErr){
      console.warn('Firebase Storage not available yet (file/photo sharing disabled):', storageErr);
      fbStorage = null;
    }

    if(!fbAuth.currentUser){
      await fbAuth.signInAnonymously();
    }
    const uid = fbAuth.currentUser.uid;
    const userDoc = await fbDb.collection('users').doc(uid).get();
    if(!userDoc.exists){
      const friendCode = String(Math.floor(100000 + Math.random() * 900000));
      const defaultName = 'User_' + friendCode.slice(-4);
      await fbDb.collection('users').doc(uid).set({
        displayName: defaultName,
        friendCode,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      currentUser = { uid, displayName: defaultName, friendCode };
    } else {
      currentUser = { uid, ...userDoc.data() };
    }
    renderMyProfileCard();
    return true;
  }catch(e){
    console.error('Firebase init error:', e);
    setupLocalDemoUser();
    return false;
  }
}

function setupLocalDemoUser(){
  let localUid = localStorage.getItem('ot_demo_uid');
  let localCode = localStorage.getItem('ot_demo_code');
  if(!localUid || !localCode){
    localCode = String(Math.floor(100000 + Math.random() * 900000));
    localUid = 'local_' + localCode;
    localStorage.setItem('ot_demo_uid', localUid);
    localStorage.setItem('ot_demo_code', localCode);
  }
  currentUser = {
    uid: localUid,
    displayName: 'Htet Ko Ko Lin (' + localCode.slice(-4) + ')',
    friendCode: localCode
  };
  renderMyProfileCard();
  setupDemoChats();
}

function renderMyProfileCard(){
  const codeEl = document.getElementById('myFriendCodeDisplay');
  if(codeEl && currentUser) codeEl.textContent = currentUser.friendCode;

  const profNameEl = document.getElementById('settingsProfileName');
  const profCodeEl = document.getElementById('settingsProfileCode');
  const profAvatarEl = document.getElementById('settingsProfileAvatar');
  const qrIdEl = document.getElementById('qrCodeFriendId');
  if(profNameEl && currentUser) profNameEl.textContent = currentUser.displayName;
  if(profCodeEl && currentUser) profCodeEl.textContent = 'Friend ID: OT-' + currentUser.friendCode;
  if(profAvatarEl && currentUser) profAvatarEl.textContent = currentUser.displayName.slice(0, 2).toUpperCase();
  if(qrIdEl && currentUser) qrIdEl.textContent = 'ID: OT-' + currentUser.friendCode;
}

/* ---------------- Pre-populated Demo Multilingual Chats ---------------- */
function setupDemoChats(){
  myFriendsCache = [
    { uid: 'demo_zh_1', displayName: 'Zhang Wei (Shanghai HQ • 🇨🇳)', friendCode: '881122', lang: 'zh' },
    { uid: 'demo_th_2', displayName: 'Somchai (Bangkok Ops • 🇹🇭)', friendCode: '334455', lang: 'th' },
    { uid: 'demo_en_3', displayName: 'Sarah Jenkins (Singapore • 🇺🇸)', friendCode: '556677', lang: 'en' },
    { uid: 'demo_my_4', displayName: 'Khin Myat Noe (Yangon • 🇲🇲)', friendCode: '990011', lang: 'my' }
  ];

  myGroupsCache = [
    {
      id: 'demo_group_1',
      name: 'Global Tech Team (SG, TH, MM, CN)',
      members: ['demo_zh_1', 'demo_th_2', 'demo_en_3', currentUser.uid],
      isGroup: true
    }
  ];

  if(!localStorage.getItem('ot_demo_messages_demo_group_1')){
    const initialGroupMsgs = [
      {
        id: 'msg_1',
        senderId: 'demo_zh_1',
        senderName: 'Zhang Wei',
        sourceLang: 'zh',
        text: '大家好，新版本 OmniTalk PRO 已经测试完成，大家觉得如何？',
        timestamp: Date.now() - 3600000
      },
      {
        id: 'msg_2',
        senderId: 'demo_th_2',
        senderName: 'Somchai',
        sourceLang: 'th',
        text: 'การออกแบบใหม่ยอดเยี่ยมมาก ระบบแปลภาษาแบบเรียลไทม์ทำงานเร็วมาก',
        isAudio: true,
        audioText: 'การออกแบบใหม่ยอดเยี่ยมมาก ระบบแปลภาษาแบบเรียลไทม์ทำงานเร็วมาก',
        duration: '0:12',
        timestamp: Date.now() - 1800000
      },
      {
        id: 'msg_3',
        senderId: 'demo_en_3',
        senderName: 'Sarah Jenkins',
        sourceLang: 'en',
        text: 'The cross-language auto-translation is super smooth! Let\'s deploy to production tomorrow morning.',
        timestamp: Date.now() - 600000
      }
    ];
    localStorage.setItem('ot_demo_messages_demo_group_1', JSON.stringify(initialGroupMsgs));
  }

  renderRecentChatsList();
  renderFriendsList(myFriendsCache);
  renderGroupsList(myGroupsCache);
}

/* ---------------- Friends & Groups ---------------- */
async function fbAddFriendByCode(code){
  const cleanCode = (code || '').trim();
  if(!cleanCode || cleanCode.length < 6) return { ok: false, reason: 'invalid_code' };
  
  if(!fbReady()){
    const mockFriend = {
      uid: 'demo_' + cleanCode,
      displayName: 'Colleague (' + cleanCode + ')',
      friendCode: cleanCode,
      addedAt: Date.now()
    };
    myFriendsCache.push(mockFriend);
    renderFriendsList(myFriendsCache);
    renderRecentChatsList();
    return { ok: true, displayName: mockFriend.displayName, friendUid: mockFriend.uid };
  }

  const snap = await fbDb.collection('users').where('friendCode', '==', cleanCode).limit(1).get();
  if(snap.empty) return { ok: false, reason: 'not_found' };
  const friendDoc = snap.docs[0];
  if(friendDoc.id === currentUser.uid) return { ok: false, reason: 'self' };

  await fbDb.collection('users').doc(currentUser.uid).collection('friends').doc(friendDoc.id).set({
    displayName: friendDoc.data().displayName || 'Friend',
    friendCode: friendDoc.data().friendCode,
    addedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true, displayName: friendDoc.data().displayName, friendUid: friendDoc.id };
}

async function fbCreateGroupChat(groupName, memberUids){
  const name = (groupName || '').trim() || 'Work Group';
  const members = Array.from(new Set([...memberUids, currentUser.uid]));

  if(!fbReady()){
    const newGroup = {
      id: 'local_group_' + Date.now(),
      name,
      members,
      isGroup: true,
      createdAt: Date.now()
    };
    myGroupsCache.push(newGroup);
    renderGroupsList(myGroupsCache);
    renderRecentChatsList();
    return newGroup.id;
  }

  const docRef = await fbDb.collection('groups').add({
    name,
    members,
    createdBy: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

/* ---------------- Real-time Message Engine ---------------- */
async function openChatSession(type, targetId, title){
  activeChatSession = { type, targetId, title };
  
  const chatRoom = document.getElementById('chatRoomView');
  const titleEl = document.getElementById('activeChatTitle');
  if(titleEl) titleEl.textContent = title;
  if(chatRoom) chatRoom.style.display = 'flex';

  if(typeof pushNavigationState === 'function') pushNavigationState('chatroom');

  const container = document.getElementById('chatMessagesContainer');
  if(container) container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">⚡ Loading conversation...</div>';

  if(!fbReady()){
    loadLocalDemoMessages(targetId);
    return;
  }

  if(activeChatUnsub) activeChatUnsub();

  const collectionPath = type === 'group'
    ? fbDb.collection('groups').doc(targetId).collection('messages')
    : fbDb.collection('direct_chats').doc(getDirectChatRoomId(currentUser.uid, targetId)).collection('messages');

  activeChatUnsub = collectionPath.orderBy('timestamp', 'asc').onSnapshot(async (snapshot) => {
    const msgs = [];
    snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
    await renderChatMessages(msgs);
  });
}

function loadLocalDemoMessages(targetId){
  const stored = localStorage.getItem('ot_demo_messages_' + targetId);
  const msgs = stored ? JSON.parse(stored) : [];
  renderChatMessages(msgs);
}

function getDirectChatRoomId(uid1, uid2){
  return [uid1, uid2].sort().join('_');
}

/** Core AI & Neural Translation Engine (High Precision) */
/**
 * ---- API key rotation + proactive exhaustion tracking ----
 * Google's free-tier quota is per-project/per-key, so a second personal
 * key has its own separate allowance. Instead of guessing a daily-limit
 * number, we remember which keys actually hit a 429 today and steer new
 * calls away from them — resets naturally each day since a stale date
 * string just stops matching "today".
 */
function todayStr(){ return new Date().toISOString().slice(0, 10); }

function currentApiKey(){
  const keys = (state.apiKeys || []).map(k => (k||'').trim()).filter(Boolean);
  return keys[state.apiKeyIndex || 0] || keys[0] || state.apiKey || '';
}

function markKeyExhausted(key){
  if(!key) return;
  state.exhaustedKeysToday = state.exhaustedKeysToday || {};
  state.exhaustedKeysToday[key] = todayStr();
  try{ localStorage.setItem('ot_exhaustedKeys', JSON.stringify(state.exhaustedKeysToday)); }catch(e){}
}

function isKeyExhaustedToday(key){
  return !!key && state.exhaustedKeysToday && state.exhaustedKeysToday[key] === todayStr();
}

function rotateApiKey(){
  const keys = (state.apiKeys || []).map(k => (k||'').trim()).filter(Boolean);
  if(keys.length <= 1) return false;
  const cur = currentApiKey();
  const currentPos = keys.indexOf(cur);
  const ordered = keys.slice(currentPos + 1).concat(keys.slice(0, currentPos + 1));
  const nextKey = ordered.find(k => k !== cur && !isKeyExhaustedToday(k)) || ordered.find(k => k !== cur);
  if(!nextKey || nextKey === cur) return false;
  state.apiKeyIndex = keys.indexOf(nextKey);
  return true;
}

function friendlyApiError(status){
  if(status === 429) return 'AI quota ကုန်သွားပါပြီ (daily limit)';
  if(status === 401 || status === 403) return 'API key မှားနေနိုင်ပါတယ်';
  if(status >= 500) return 'Google AI server ခဏပြဿနာ ရှိနေပါတယ်';
  return 'AI ဆက်သွယ်လို့ မရပါ';
}

/**
 * Core Gemini call with automatic key rotation on 429/5xx, streaming
 * support (onChunk callback, optional), and no silent model downgrades —
 * uses exactly the model you ask for.
 */
async function callGeminiTranslate(text, src, tgt, model, domain, onChunk){
  const domainPrompts = {
    general: 'natural human conversation, polite everyday dialogue',
    workplace: 'workplace operations, factory management, engineering, and overtime tasks',
    medical: 'medical symptoms, clinics, healthcare, and pharmacy',
    immigration: 'visa, passport, work permit, and legal immigration matters'
  };
  const domainContext = domainPrompts[domain] || domainPrompts.general;

  const prompt = `You are an expert real-time translator specializing in Southeast Asian and East Asian languages (Burmese/Myanmar, Chinese, Thai, English).
Translate the following input from language code "${src||'auto'}" into target language code "${tgt}".

Rules:
1. Preserve natural grammar, colloquial idioms, and polite particles (e.g. in Burmese: ခင်ဗျာ/ရှင်/နော်, in Thai: ครับ/ค่ะ).
2. For conversational phrases (e.g. "ထမင်းစားပြီးပြီလား?"), translate naturally as "Have you eaten yet?" in English or "你吃饭了吗？" in Chinese or "กินข้าวหรือยังครับ" in Thai.
3. For personal names (e.g. "Daniel David"), transliterate phonetically (e.g. "ဒန်နီရယ် ဒေးဗစ်" in Burmese, "丹尼尔·大卫" in Chinese, "แดเนียล เดวิด" in Thai) - DO NOT translate names as literal verbs!
4. Context: ${domainContext}.
5. Output ONLY the clean translated text without any explanation, quotes or markdown.

Input: "${text}"`;

  const chosenModel = model || 'gemini-3.6-flash';
  const keys = (state.apiKeys || []).map(k => (k||'').trim()).filter(Boolean);
  if(!keys.length) return { ok: false, status: 0 };

  // Proactively skip a key we already know 429'd today, before even trying.
  if(isKeyExhaustedToday(currentApiKey())){
    const fresh = keys.find(k => !isKeyExhaustedToday(k));
    if(fresh) state.apiKeyIndex = keys.indexOf(fresh);
  }

  const attempt = async () => {
    const key = currentApiKey();
    if(onChunk){
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModel}:streamGenerateContent?alt=sse&key=${key}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } })
      });
      if(!resp.ok || !resp.body) return { ok: resp.ok, status: resp.status, text: '' };
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', fullText = '';
      while(true){
        const { done, value } = await reader.read();
        if(done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for(const line of lines){
          if(!line.startsWith('data: ')) continue;
          try{
            const json = JSON.parse(line.slice(6));
            const piece = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if(piece){ fullText += piece; onChunk(fullText); }
          }catch(e){}
        }
      }
      return { ok: true, status: 200, text: fullText.trim() };
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModel}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } })
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
  if(result.status === 429) markKeyExhausted(currentApiKey());
  return result;
}

/**
 * Free fallback translation via MyMemory — no API key needed at all, works
 * directly from the browser. Used when Gemini is unreachable or every
 * configured key has hit its quota. Rejects low-confidence matches, which
 * can otherwise come back completely unrelated to the input.
 */
async function translateViaMyMemory(text, sourceCode, targetCode){
  if(!text || !text.trim()) return '';
  try{
    const params = new URLSearchParams({
      q: text.slice(0, 490),
      langpair: `${sourceCode || 'autodetect'}|${targetCode}`,
    });
    const resp = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);
    if(!resp.ok) return '';
    const data = await resp.json();
    const result = data?.responseData?.translatedText;
    if(!result) return '';
    if(/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID (SOURCE|TARGET) LANGUAGE/i.test(result)) return '';
    const match = Number(data?.responseData?.match);
    if(!isNaN(match) && match < 0.6) return '';
    return result;
  }catch(e){
    console.warn('MyMemory fallback failed:', e);
    return '';
  }
}

async function translateMessageOnRead(rawText, sourceLang, targetLang, onChunk){
  if(!rawText || !rawText.trim()) return '';
  if(sourceLang && sourceLang === targetLang) return rawText;

  const cacheKey = `${sourceLang || 'auto'}_${targetLang}_${rawText.trim()}`;
  if(translationCache[cacheKey]) return translationCache[cacheKey];

  const model = (typeof state !== 'undefined' && state.aiModel) ? state.aiModel : 'gemini-3.6-flash';
  const domain = (typeof state !== 'undefined' && state.aiDomain) ? state.aiDomain : 'general';
  const hasKeys = typeof state !== 'undefined' && (state.apiKeys || []).some(k => (k||'').trim());

  let translated = '';
  try{
    // 1. Google Gemini AI Translation (multi-key rotation on quota/server errors)
    if(hasKeys){
      const result = await callGeminiTranslate(rawText, sourceLang, targetLang, model, domain, onChunk);
      if(result.ok && result.text) translated = result.text;
      else if(!result.ok) console.warn('Gemini translate failed:', friendlyApiError(result.status));
    }
    // 2. MyMemory — free, no key, handles arbitrary sentences
    if(!translated){
      translated = await translateViaMyMemory(rawText, sourceLang, targetLang);
    }
    // 3. Offline phrasebook — last resort, known phrases only
    if(!translated){
      translated = offlineDictionaryTranslate(rawText, sourceLang, targetLang);
    }
    if(translated){
      translationCache[cacheKey] = translated;
      return translated;
    }
  }catch(e){
    console.warn('Translation pipeline notice:', e);
  }
  return offlineDictionaryTranslate(rawText, sourceLang, targetLang) || rawText;
}

function offlineDictionaryTranslate(text, sCode, tCode){
  const norm = (text || '').trim().toLowerCase();
  for(const p of PHRASEBOOK){
    if(p[sCode] && p[sCode].toLowerCase() === norm) return p[tCode] || text;
    if(p.en && p.en.toLowerCase() === norm) return p[tCode] || text;
  }
  for(const p of PHRASES){
    if(p[sCode] && p[sCode].toLowerCase() === norm) return p[tCode] || text;
    if(p.en && p.en.toLowerCase() === norm) return p[tCode] || text;
  }
  return '';
}

/** Render Messages in WeChat / DingTalk Stream */
async function renderChatMessages(messages){
  const container = document.getElementById('chatMessagesContainer');
  if(!container) return;
  container.innerHTML = '';

  if(messages.length === 0){
    container.innerHTML = `<div style="text-align:center; color:var(--text-dim); padding:40px 20px;">
      <div style="font-size:32px; margin-bottom:8px;">💬</div>
      <div>Say hello! OmniTalk auto-translates all messages into your chosen reading language in real-time.</div>
    </div>`;
    return;
  }

  for(const msg of messages){
    const isMine = msg.senderId === currentUser.uid;
    const groupEl = document.createElement('div');
    groupEl.className = `chatMsgGroup ${isMine ? 'mine' : 'theirs'}`;

    if(!isMine && msg.senderName){
      const senderName = document.createElement('div');
      senderName.className = 'chatSenderName';
      senderName.textContent = msg.senderName;
      groupEl.appendChild(senderName);
    }

    const bubble = document.createElement('div');
    bubble.className = 'chatBubble';

    if(msg.isAudio){
      const translatedAudioText = await translateMessageOnRead(msg.audioText, msg.sourceLang, activeReadingLang);
      bubble.innerHTML = `
        <div class="audioBubbleWrap">
          <button class="audioPlayBtn" onclick="speakText('${escapeHtml(translatedAudioText)}', '${activeReadingLang}')">▶</button>
          <div class="audioWaveform"></div>
          <span class="audioDuration">${msg.duration || '0:08'}</span>
        </div>
        <div class="audioTranscriptBox">
          <div style="color:#38BDF8; font-weight:700; font-size:11px; margin-bottom:2px;">🎙️ AI Voice Transcribed &amp; Translated [${(msg.sourceLang||'auto').toUpperCase()} ➔ ${activeReadingLang.toUpperCase()}]:</div>
          <div>${escapeHtml(translatedAudioText)}</div>
        </div>
      `;
    } else if(msg.fileUrl || msg.fileData){
      const isImg = msg.fileType && msg.fileType.startsWith('image/');
      if(isImg){
        bubble.innerHTML = `
          <div><img src="${msg.fileUrl || msg.fileData}" class="chatImgPreview" alt="Sent photo"></div>
          <div style="margin-top:4px; font-size:12px;">${escapeHtml(msg.text || '')}</div>
        `;
      } else {
        bubble.innerHTML = `
          <div class="fileBubbleCard">
            <span class="fileIcon">📄</span>
            <div>
              <div class="fileName">${escapeHtml(msg.fileName || 'Document.pdf')}</div>
              <div class="fileSize">${msg.fileSize || 'Attachment'}</div>
            </div>
          </div>
        `;
      }
    } else {
      let displayText = msg.text;
      let isDifferentLang = msg.sourceLang && msg.sourceLang !== activeReadingLang;
      const shouldAutoTranslate = (typeof state === 'undefined' || state.autoTranslate !== false);

      if(!isMine && isDifferentLang && shouldAutoTranslate){
        displayText = await translateMessageOnRead(msg.text, msg.sourceLang, activeReadingLang);
        if(typeof state !== 'undefined' && state.autoSpeak && displayText !== msg.text){
          speakText(displayText, activeReadingLang);
        }
      }

      const textNode = document.createElement('div');
      textNode.textContent = displayText;
      bubble.appendChild(textNode);

      if(!isMine && isDifferentLang && !shouldAutoTranslate){
        const manualBtn = document.createElement('button');
        manualBtn.className = 'origToggleBtn';
        manualBtn.innerHTML = `🌐 ${t('translateNow') || 'Translate'}`;
        manualBtn.onclick = async () => {
          manualBtn.textContent = '⏳...';
          const trResult = await translateMessageOnRead(msg.text, msg.sourceLang, activeReadingLang);
          textNode.textContent = trResult;
          manualBtn.remove();
        };
        bubble.appendChild(manualBtn);
      }

      if(!isMine && isDifferentLang && displayText !== msg.text){
        const origBtn = document.createElement('button');
        origBtn.className = 'origToggleBtn';
        origBtn.innerHTML = `<span>🌐 ${t('viewOriginal')} (${(msg.sourceLang||'auto').toUpperCase()})</span>`;
        
        const origBox = document.createElement('div');
        origBox.className = 'origTextBox';
        origBox.style.display = 'none';
        origBox.textContent = msg.text;

        origBtn.onclick = () => {
          const isHidden = origBox.style.display === 'none';
          origBox.style.display = isHidden ? 'block' : 'none';
          origBtn.innerHTML = `<span>🌐 ${isHidden ? t('viewTranslated') : t('viewOriginal')}</span>`;
        };

        bubble.appendChild(origBtn);
        bubble.appendChild(origBox);
      }
    }

    const timeEl = document.createElement('div');
    timeEl.className = 'chatMsgTime';
    timeEl.textContent = formatTime(msg.timestamp || Date.now()) + (isMine ? ' ✓✓' : '');
    bubble.appendChild(timeEl);

    groupEl.appendChild(bubble);
    container.appendChild(groupEl);
  }

  container.scrollTop = container.scrollHeight;
}

/** Send Text Message */
async function fbSendMessage(text){
  const clean = (text || '').trim();
  if(!clean || !activeChatSession) return;

  const senderLang = (typeof state !== 'undefined' && state.uiLanguage) || 'my';
  const newMsg = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName,
    sourceLang: senderLang,
    text: clean,
    timestamp: Date.now()
  };

  if(!fbReady()){
    const targetId = activeChatSession.targetId;
    const stored = localStorage.getItem('ot_demo_messages_' + targetId);
    const msgs = stored ? JSON.parse(stored) : [];
    msgs.push(newMsg);
    localStorage.setItem('ot_demo_messages_' + targetId, JSON.stringify(msgs));
    renderChatMessages(msgs);
    renderRecentChatsList();

    triggerDemoAutoReply(targetId);
    return;
  }

  const collectionPath = activeChatSession.type === 'group'
    ? fbDb.collection('groups').doc(activeChatSession.targetId).collection('messages')
    : fbDb.collection('direct_chats').doc(getDirectChatRoomId(currentUser.uid, activeChatSession.targetId)).collection('messages');

  await collectionPath.add({
    ...newMsg,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function triggerDemoAutoReply(targetId){
  setTimeout(() => {
    if(!activeChatSession || activeChatSession.targetId !== targetId) return;

    let autoReply = null;
    if(targetId === 'demo_group_1'){
      autoReply = {
        senderId: 'demo_zh_1',
        senderName: 'Zhang Wei (🇨🇳)',
        sourceLang: 'zh',
        text: '收到你的消息了！实时翻译效果非常棒，我们继续测试。',
        timestamp: Date.now()
      };
    } else if(targetId === 'demo_th_2'){
      autoReply = {
        senderId: 'demo_th_2',
        senderName: 'Somchai (🇹🇭)',
        sourceLang: 'th',
        text: 'ขอบคุณครับ ได้รับข้อความแล้ว ระบบแปลอัตโนมัติดีมาก',
        timestamp: Date.now()
      };
    } else if(targetId === 'demo_en_3'){
      autoReply = {
        senderId: 'demo_en_3',
        senderName: 'Sarah Jenkins (🇺🇸)',
        sourceLang: 'en',
        text: 'Message received! The live AI translation is working seamlessly.',
        timestamp: Date.now()
      };
    } else {
      autoReply = {
        senderId: 'demo_my_4',
        senderName: 'Khin Myat Noe (🇲🇲)',
        sourceLang: 'my',
        text: 'မင်္ဂလာပါ! မက်ဆေ့ခ်ျ လက်ခံရရှိပါတယ်ခင်ဗျာ။',
        timestamp: Date.now()
      };
    }

    const stored = localStorage.getItem('ot_demo_messages_' + targetId);
    const msgs = stored ? JSON.parse(stored) : [];
    msgs.push(autoReply);
    localStorage.setItem('ot_demo_messages_' + targetId, JSON.stringify(msgs));
    renderChatMessages(msgs);
    renderRecentChatsList();
    if(typeof showToast === 'function') showToast(`New message from ${autoReply.senderName}`);
    if(typeof playSfx === 'function') playSfx('receive');
  }, 1400);
}

/** Send Voice Note Audio */
async function fbSendAudioMessage(audioBlob, durationSec, transcribedText){
  if(!activeChatSession) return;
  const senderLang = (typeof state !== 'undefined' && state.uiLanguage) || 'my';

  const newMsg = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName,
    sourceLang: senderLang,
    isAudio: true,
    audioText: transcribedText || 'Voice message',
    duration: `0:${durationSec < 10 ? '0'+durationSec : durationSec}`,
    timestamp: Date.now()
  };

  if(!fbReady()){
    const targetId = activeChatSession.targetId;
    const stored = localStorage.getItem('ot_demo_messages_' + targetId);
    const msgs = stored ? JSON.parse(stored) : [];
    msgs.push(newMsg);
    localStorage.setItem('ot_demo_messages_' + targetId, JSON.stringify(msgs));
    renderChatMessages(msgs);
    renderRecentChatsList();
    return;
  }

  const collectionPath = activeChatSession.type === 'group'
    ? fbDb.collection('groups').doc(activeChatSession.targetId).collection('messages')
    : fbDb.collection('direct_chats').doc(getDirectChatRoomId(currentUser.uid, activeChatSession.targetId)).collection('messages');

  await collectionPath.add({
    ...newMsg,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}

/* ---------------- Render Feed & UI ---------------- */
function renderRecentChatsList(){
  const container = document.getElementById('recentChatsList');
  if(!container) return;
  container.innerHTML = '';

  const allChats = [
    ...myGroupsCache.map(g => ({ id: g.id, title: g.name, isGroup: true, lastMsg: t('tapToOpen') || 'Tap to open', time: '', unread: 0 })),
    ...myFriendsCache.map(f => ({ id: f.uid, title: f.displayName, isGroup: false, lastMsg: t('tapToOpen') || 'Tap to open', time: '', unread: 0 }))
  ];

  if(allChats.length === 0){
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:30px;">
      <div style="font-size:32px; margin-bottom:8px;">👥</div>
      <div>${t('noChats')}</div>
    </div>`;
    return;
  }

  allChats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chatListItem';
    item.onclick = () => openChatSession(chat.isGroup ? 'group' : 'direct', chat.id, chat.title);

    item.innerHTML = `
      <div class="avatarCircle ${chat.isGroup ? 'groupAvatar' : ''}">
        ${chat.isGroup ? '👥' : chat.title.slice(0, 2).toUpperCase()}
        ${!chat.isGroup ? '<div class="onlineIndicator"></div>' : ''}
      </div>
      <div class="chatItemInfo">
        <div class="chatItemTopRow">
          <div class="chatItemTitle">${escapeHtml(chat.title)}</div>
          <div class="chatItemTime">${chat.time}</div>
        </div>
        <div class="chatItemBottomRow">
          <div class="chatItemSnippet">
            <span class="transBadge">[Auto ➔ ${activeReadingLang.toUpperCase()}]</span>
            ${escapeHtml(chat.lastMsg)}
          </div>
          ${chat.unread > 0 ? `<div class="unreadBadge">${chat.unread}</div>` : ''}
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

function renderFriendsList(friends){
  const container = document.getElementById('contactsList');
  if(!container) return;
  container.innerHTML = '';

  if(friends.length === 0){
    container.innerHTML = `<div style="color:var(--text-muted); padding:16px;">${t('noFriends')}</div>`;
    return;
  }

  friends.forEach(f => {
    const item = document.createElement('div');
    item.className = 'contactItem';
    item.onclick = () => openChatSession('direct', f.uid, f.displayName);
    item.innerHTML = `
      <div class="avatarCircle">${f.displayName.slice(0, 2).toUpperCase()}</div>
      <div class="chatItemInfo">
        <div class="chatItemTitle">${escapeHtml(f.displayName)}</div>
        <div class="chatItemSnippet" style="color:var(--primary); font-weight:700;">ID: ${f.friendCode}</div>
      </div>
    `;
    container.appendChild(item);
  });
}

function renderGroupsList(groups){
  const container = document.getElementById('groupChatsList');
  if(!container) return;
  container.innerHTML = '';

  groups.forEach(g => {
    const item = document.createElement('div');
    item.className = 'contactItem';
    item.onclick = () => openChatSession('group', g.id, g.name);
    item.innerHTML = `
      <div class="avatarCircle groupAvatar">👥</div>
      <div class="chatItemInfo">
        <div class="chatItemTitle">${escapeHtml(g.name)}</div>
        <div class="chatItemSnippet">${g.members ? g.members.length : 0} members</div>
      </div>
    `;
    container.appendChild(item);
  });
}
