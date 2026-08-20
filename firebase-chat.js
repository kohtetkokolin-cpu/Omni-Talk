/* ==========================================================
   OmniTalk PRO v12.0 — firebase-chat.js
   WeChat Style Engine (Profile, Friends, Auto-Translate)
========================================================== */

// ၁။ မူလ User Profile (LocalStorage ကနေ ဆွဲယူမည်)
let currentUser = JSON.parse(localStorage.getItem('ot_currentUser')) || { 
    uid: 'user_' + Math.floor(Math.random() * 10000), 
    displayName: 'My Profile', 
    friendCode: Math.floor(100000 + Math.random() * 900000).toString(),
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
};

// ၂။ သူငယ်ချင်း စာရင်း (Database)
let myFriendsCache = JSON.parse(localStorage.getItem('ot_friends')) || [
    { uid: 'ai_assistant', displayName: 'Gemini AI', avatar: '🤖', isBot: true, targetLang: 'Myanmar' }
];

let activeChatSession = null;

// App စတင်ချိန် အလုပ်လုပ်မည့် Function
async function fbInit() {
    localStorage.setItem('ot_currentUser', JSON.stringify(currentUser));
    
    // UI ပေါ်ရှိ Friend Code များကို မိမိ Code ဖြင့် ပြောင်းပေးခြင်း
    const codeDisplay = document.getElementById('myFriendCodeDisplay');
    if(codeDisplay) codeDisplay.textContent = currentUser.friendCode;
    
    const profileCode = document.getElementById('settingsProfileCode');
    if(profileCode) profileCode.textContent = 'Friend ID: OT-' + currentUser.friendCode;
    
    const qrCodeText = document.getElementById('qrCodeFriendId');
    if(qrCodeText) qrCodeText.textContent = 'ID: OT-' + currentUser.friendCode;

    // သူငယ်ချင်းစာရင်းများကို UI သို့ ဆွဲတင်ခြင်း
    renderFriendsList(myFriendsCache);
    renderRecentChatsList();
}

// ၃။ သူငယ်ချင်း Add ခြင်း (app.js မှ လှမ်းခေါ်မည်)
async function fbAddFriendByCode(code) {
    if (!code) return { ok: false };
    if (code === currentUser.friendCode) return { ok: false, reason: 'self' };
    
    // သူငယ်ချင်းအသစ် Profile ဖန်တီးခြင်း
    const newFriend = {
        uid: 'user_' + code,
        displayName: 'Friend (' + code + ')',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${code}`,
        targetLang: 'Chinese' // သူငယ်ချင်းကို တရုတ်လို auto-translate လုပ်ရန် သတ်မှတ်ထားသည်
    };

    const isExist = myFriendsCache.find(f => f.uid === newFriend.uid);
    if (!isExist) {
        myFriendsCache.push(newFriend);
        localStorage.setItem('ot_friends', JSON.stringify(myFriendsCache));
        
        // သူငယ်ချင်းစာရင်းများကို UI မှာ ချက်ချင်း Update လုပ်ပြမည်
        renderFriendsList(myFriendsCache);
        renderRecentChatsList();
        return { ok: true };
    }
    return { ok: false, reason: 'exists' };
}

// Group Chat ဖန်တီးခြင်း
async function fbCreateGroupChat(name, selectedUids) {
    showToast("Group '" + name + "' ဖန်တီးပြီးပါပြီ။", "success");
}

// ၄။ UI တွင် သူငယ်ချင်းများ ပြခြင်း (Contacts Tab)
function renderFriendsList(friends) {
    const container = document.getElementById('contactsList');
    if (!container) return;
    
    container.innerHTML = friends.map(friend => `
        <div onclick="openChatSession('private', '${friend.uid}', '${escapeHtml(friend.displayName)}')" 
             style="display: flex; align-items: center; padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.2s;" 
             onmouseover="this.style.background='rgba(255,255,255,0.05)'" 
             onmouseout="this.style.background='transparent'">
             
            <!-- Profile ပုံ -->
            <img src="${friend.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + friend.uid}" 
                 alt="avatar" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; background: #1e293b; margin-right: 15px;">
                 
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #f8fafc; font-size: 1rem; margin-bottom: 4px;">${escapeHtml(friend.displayName)}</div>
                <div style="font-size: 0.85rem; color: ${friend.isBot ? '#10b981' : '#94a3b8'};">
                    ${friend.isBot ? '🤖 AI Assistant' : 'WeChat Contact'}
                </div>
            </div>
        </div>
    `).join('');
}

// ၅။ UI တွင် Recent Chats ပြခြင်း (Chats Tab)
function renderRecentChatsList() {
    const container = document.getElementById('recentChatsList');
    if (!container) return;
    
    container.innerHTML = myFriendsCache.map(friend => `
        <div onclick="openChatSession('private', '${friend.uid}', '${escapeHtml(friend.displayName)}')" 
             style="display: flex; align-items: center; padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;" 
             onmouseover="this.style.background='rgba(255,255,255,0.05)'" 
             onmouseout="this.style.background='transparent'">
             
            <img src="${friend.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + friend.uid}" 
                 alt="avatar" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; background: #1e293b; margin-right: 15px;">
                 
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #f8fafc; font-size: 1rem; margin-bottom: 4px;">${escapeHtml(friend.displayName)}</div>
                <div style="font-size: 0.85rem; color: #94a3b8;">
                    Tap to start chatting...
                </div>
            </div>
        </div>
    `).join('');
}

// ၆။ Chat ခန်းထဲ ဝင်ခြင်း
function openChatSession(type, targetId, title) {
    activeChatSession = { type, targetId, title };
    const chatRoom = document.getElementById('chatRoomView');
    const chatTitle = document.getElementById('activeChatTitle');
    
    if (chatRoom) chatRoom.style.display = 'flex';
    if (chatTitle) chatTitle.textContent = title;
    
    const storageKey = 'ot_demo_messages_' + targetId;
    const msgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
    renderChatMessages(msgs);
}

// ၇။ Message များကို WeChat ပုံစံဖြင့် ပြသခြင်း
function renderChatMessages(msgs) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;
    
    // အချိန် (Timestamp) အစဉ်လိုက် စီခြင်း
    msgs.sort((a, b) => a.timestamp - b.timestamp);
    
    container.innerHTML = msgs.map(msg => {
        const isMine = msg.senderId === currentUser.uid;
        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const mainText = isMine ? msg.originalText : (msg.translatedText || msg.originalText);
        const subText = isMine ? msg.translatedText : msg.originalText;
        const avatar = isMine ? currentUser.avatar : (msg.avatar || '👤');
        
        return `
            <div class="chat-bubble-row ${isMine ? 'mine' : 'theirs'}" style="display:flex; flex-direction:${isMine ? 'row-reverse' : 'row'}; align-items:flex-start; margin-bottom: 16px; gap: 10px; width: 100%;">
                
                <!-- Profile ပုံ -->
                <img src="${avatar}" alt="avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: #e2e8f0; flex-shrink: 0;">
                
                <div style="display:flex; flex-direction:column; align-items:${isMine ? 'flex-end' : 'flex-start'}; max-width: 75%;">
                    <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 4px; padding: 0 4px;">${escapeHtml(msg.senderName)}</div>
                    
                    <!-- စာသား Bubble -->
                    <div class="chat-bubble" style="background:${isMine ? '#10b981' : '#334155'}; color:#fff; padding: 10px 14px; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                        <div style="font-size: 1rem;">${escapeHtml(mainText)}</div>
                        
                        ${subText && subText !== "Translating..." ? `
                            <div style="font-size: 0.85rem; color: ${isMine ? '#d1fae5' : '#94a3b8'}; margin-top: 6px; border-top: 1px solid ${isMine ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}; padding-top: 6px;">
                                ${escapeHtml(subText)}
                            </div>
                        ` : ''}
                        
                        ${subText === "Translating..." ? `
                            <div style="font-size: 0.85rem; color: ${isMine ? '#fff' : '#38bdf8'}; margin-top: 6px; font-style: italic;">
                                ⏳ Translating...
                            </div>
                        ` : ''}
                    </div>
                    <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px; padding: 0 4px;">${timeStr}</div>
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

// ၈။ စာပို့ခြင်း နှင့် Auto-Translate လုပ်ခြင်း
async function fbSendMessage(text) {
    if (!activeChatSession || !text) return;
    
    const targetId = activeChatSession.targetId;
    const storageKey = 'ot_demo_messages_' + targetId;
    let msgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    // သူငယ်ချင်းရဲ့ ဘာသာစကားကို ရှာမည်
    const friendInfo = myFriendsCache.find(f => f.uid === targetId);
    const targetLang = friendInfo?.targetLang || "Chinese"; 
    const tempMsgId = Date.now().toString();
    
    // UI တွင် မိမိစာကို အရင်ပေါ်စေခြင်း (Translating Loading ပြမည်)
    const userMsg = {
        id: tempMsgId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        avatar: currentUser.avatar,
        originalText: text,
        translatedText: targetId === 'ai_assistant' ? '' : "Translating...",
        timestamp: Date.now()
    };
    msgs.push(userMsg);
    localStorage.setItem(storageKey, JSON.stringify(msgs));
    renderChatMessages(msgs);

    // API Key စစ်ဆေးခြင်း
    if (!state.apiKey) {
        let updatedMsgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
        let msgIndex = updatedMsgs.findIndex(m => m.id === tempMsgId);
        if (msgIndex !== -1) {
            updatedMsgs[msgIndex].translatedText = "[API Key ထည့်ရန် လိုအပ်ပါသည်]";
            localStorage.setItem(storageKey, JSON.stringify(updatedMsgs));
            renderChatMessages(updatedMsgs);
        }
        showToast("Settings တွင် Gemini API Key အရင်ထည့်ပေးပါ။", "warn");
        return;
    }

    // AI ကို သုံး၍ ဘာသာပြန်ခြင်း
    try {
        let prompt = "";
        if (targetId === 'ai_assistant') {
            prompt = `You are a helpful chat assistant. Reply normally in Myanmar/English to: "${text}"`;
        } else {
            // တရုတ်လို ဘာသာပြန်ခိုင်းမည့် Prompt
            prompt = `Translate the following text to ${targetLang}. Return ONLY the translated text without quotes. Text: "${text}"`;
        }
        
        const resp = await wkGeminiFetch(state.aiModel, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: targetId === 'ai_assistant' ? 0.7 : 0.1 }
        });

        if (resp.ok) {
            const data = await resp.json();
            const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            
            let updatedMsgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
            
            if (targetId === 'ai_assistant') {
                // AI Bot ဆိုရင် စာပြန်မည်
                updatedMsgs.push({
                    id: Date.now().toString(),
                    senderId: 'ai_assistant',
                    senderName: 'Gemini AI',
                    avatar: '🤖',
                    originalText: aiResponse,
                    translatedText: '',
                    timestamp: Date.now()
                });
            } else {
                // သူငယ်ချင်းဆိုရင် ဘာသာပြန်ထားတာကို Update လုပ်မည်
                let msgIndex = updatedMsgs.findIndex(m => m.id === tempMsgId);
                if (msgIndex !== -1) {
                    updatedMsgs[msgIndex].translatedText = aiResponse || text;
                }
            }
            
            localStorage.setItem(storageKey, JSON.stringify(updatedMsgs));
            renderChatMessages(updatedMsgs);
        }
    } catch (error) {
        showToast("Network Error: အင်တာနက်ချိတ်ဆက်မှုကို စစ်ဆေးပါ။", "error");
    }
}

// ၉။ Audio ပို့ခြင်း (app.js အတွက်)
async function fbSendAudioMessage(blob, durationSec, text) {
    if(text) await fbSendMessage(text);
}
