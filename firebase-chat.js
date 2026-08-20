/* ==========================================================
   OmniTalk PRO v12.0 — firebase-chat.js
   WeChat Style Engine (Profile, Friends, Auto-Translate)
========================================================== */

// ၁။ မူလ User Profile (LocalStorage ကနေ ဆွဲယူမည်)
let currentUser = JSON.parse(localStorage.getItem('ot_currentUser')) || { 
    uid: 'user_' + Math.floor(Math.random() * 10000), 
    displayName: 'My Name', 
    friendCode: Math.floor(100000 + Math.random() * 900000).toString(),
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' // Default Profile ပုံ
};

// ၂။ သူငယ်ချင်း စာရင်း
let myFriendsCache = JSON.parse(localStorage.getItem('ot_friends')) || [
    { uid: 'ai_assistant', displayName: 'Gemini AI', avatar: '🤖', isBot: true }
];

let activeChatSession = null;

// App စစချင်း အလုပ်လုပ်မည့် Function
async function fbInit() {
    localStorage.setItem('ot_currentUser', JSON.stringify(currentUser));
    renderFriendsList(myFriendsCache);
    renderRecentChatsList();
}

// ၃။ Profile အချက်အလက်များ ပြင်ဆင်ခြင်း
function updateProfile(newName, newAvatarUrl) {
    currentUser.displayName = newName || currentUser.displayName;
    currentUser.avatar = newAvatarUrl || currentUser.avatar;
    localStorage.setItem('ot_currentUser', JSON.stringify(currentUser));
    showToast("Profile ကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ", "success");
}

// ၄။ သူငယ်ချင်း Add ခြင်း (app.js မှ လှမ်းခေါ်မည်)
async function fbAddFriendByCode(code) {
    if (code === currentUser.friendCode) return { ok: false, reason: 'self' };
    
    // သူငယ်ချင်းအသစ်ကို List ထဲ ထည့်မည် (WeChat လိုမျိုး)
    const newFriend = {
        uid: 'user_' + code,
        displayName: 'Friend (' + code + ')',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${code}`,
        targetLang: 'Chinese' // ဥပမာ - ဒီသူငယ်ချင်းကို တရုတ်လို သတ်မှတ်ထားမည်
    };

    const isExist = myFriendsCache.find(f => f.uid === newFriend.uid);
    if (!isExist) {
        myFriendsCache.push(newFriend);
        localStorage.setItem('ot_friends', JSON.stringify(myFriendsCache));
        renderFriendsList(myFriendsCache);
        return { ok: true };
    }
    return { ok: false, reason: 'exists' };
}

// Group Chat ဖန်တီးခြင်း
async function fbCreateGroupChat(name, selectedUids) {
    showToast("Group '" + name + "' ဖန်တီးပြီးပါပြီ။", "success");
}

// UI တွင် သူငယ်ချင်းများ ပြခြင်း (Stub)
function renderFriendsList(friends) {
    console.log("Friends list updated: ", friends);
}
function renderRecentChatsList() {
    console.log("Recent chats updated.");
}

// ၅။ Chat ခန်းထဲ ဝင်ခြင်း
function openChatSession(type, targetId, title) {
    activeChatSession = { type, targetId, title };
    const chatRoom = document.getElementById('chatRoomView');
    const chatTitle = document.getElementById('chatRoomTitle');
    
    if (chatRoom) chatRoom.style.display = 'flex';
    if (chatTitle) chatTitle.textContent = title;
    
    const storageKey = 'ot_demo_messages_' + targetId;
    const msgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
    renderChatMessages(msgs);
}

// ၆။ Message များကို WeChat ပုံစံဖြင့် ပြသခြင်း
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
            <div class="chat-bubble-row ${isMine ? 'mine' : 'theirs'}" style="display:flex; flex-direction:${isMine ? 'row-reverse' : 'row'}; align-items:flex-start; margin-bottom: 16px; gap: 10px;">
                <!-- Profile ပုံ -->
                <img src="${avatar}" alt="avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: #e2e8f0;">
                
                <div style="display:flex; flex-direction:column; align-items:${isMine ? 'flex-end' : 'flex-start'}; max-width: 70%;">
                    <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 4px; padding: 0 4px;">${escapeHtml(msg.senderName)}</div>
                    
                    <!-- စာသား Bubble -->
                    <div class="chat-bubble" style="background:${isMine ? '#10b981' : '#f1f5f9'}; color:${isMine ? '#fff' : '#1e293b'}; padding: 10px 14px; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                        <div style="font-size: 1rem;">${escapeHtml(mainText)}</div>
                        
                        ${subText && subText !== "Translating..." ? `
                            <div style="font-size: 0.85rem; color: ${isMine ? '#d1fae5' : '#64748b'}; margin-top: 6px; border-top: 1px solid ${isMine ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}; padding-top: 6px;">
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

// ၇။ စာပို့ခြင်း နှင့် Auto-Translate လုပ်ခြင်း
async function fbSendMessage(text) {
    if (!activeChatSession || !text) return;
    
    const targetId = activeChatSession.targetId;
    const storageKey = 'ot_demo_messages_' + targetId;
    let msgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    // သူငယ်ချင်းရဲ့ ဘာသာစကားကို ရှာမည် (မတွေ့ရင် အင်္ဂလိပ်လို့ သတ်မှတ်မည်)
    const friendInfo = myFriendsCache.find(f => f.uid === targetId);
    const targetLang = friendInfo?.targetLang || "English"; 
    const tempMsgId = Date.now().toString();
    
    // UI တွင် မိမိစာကို အရင်ပေါ်စေခြင်း
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

    // AI ကို သုံး၍ ဘာသာပြန်ခြင်း သို့မဟုတ် စာပြန်ခိုင်းခြင်း
    try {
        let prompt = "";
        if (targetId === 'ai_assistant') {
            prompt = `You are a helpful chat assistant. Reply normally to: "${text}"`;
        } else {
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
        showToast("Network Error", "error");
    }
}

// ၈။ Audio ပို့ခြင်း (app.js အတွက်)
async function fbSendAudioMessage(blob, durationSec, text) {
    if(text) await fbSendMessage(text);
}
