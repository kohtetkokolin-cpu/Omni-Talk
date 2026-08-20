/* ==========================================================
   OmniTalk PRO v12.0 — firebase-chat.js
   Chat Engine & LocalStorage Manager (with Gemini AI Integration)
========================================================== */

let currentUser = { 
    uid: 'user123', 
    displayName: 'My Account', 
    friendCode: '123456' 
};

let myFriendsCache = [
    { uid: '577369', displayName: 'Colleague (577369)' },
    { uid: 'ai_assistant', displayName: 'Gemini AI' }
];

let activeChatSession = null;

// Initialize function called by app.js
async function fbInit() {
    renderRecentChatsList();
    renderFriendsList(myFriendsCache);
}

function renderRecentChatsList() {
    // Stub: UI Logic for Recent Chats List
    console.log("Recent chats loaded.");
}

function renderFriendsList(friends) {
    // Stub: UI Logic for Friends List
    console.log("Friends list loaded.");
}

// Open Chat Room
function openChatSession(type, targetId, title) {
    activeChatSession = { type, targetId, title };
    const chatRoom = document.getElementById('chatRoomView');
    const chatTitle = document.getElementById('chatRoomTitle');
    
    if (chatRoom) chatRoom.style.display = 'flex';
    if (chatTitle) chatTitle.textContent = title;
    
    const storageKey = 'ot_demo_messages_' + targetId;
    const stored = localStorage.getItem(storageKey);
    const msgs = stored ? JSON.parse(stored) : [];
    
    renderChatMessages(msgs);
}

// Render Messages to UI (Bug 1 Fixed: Timestamps Sorted)
function renderChatMessages(msgs) {
    const container = document.getElementById('chatMessagesContainer'); // Ensure this ID matches your HTML
    if (!container) return;
    
    // ဖြေရှင်းချက် (၁) - Message များကို အချိန် (Timestamp) အစဉ်လိုက်ဖြစ်အောင် စီပေးခြင်း
    msgs.sort((a, b) => a.timestamp - b.timestamp);
    
    container.innerHTML = msgs.map(msg => {
        const isMine = msg.senderId === currentUser.uid;
        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="chat-bubble-row ${isMine ? 'mine' : 'theirs'}" style="display:flex; flex-direction:column; align-items:${isMine ? 'flex-end' : 'flex-start'}; margin-bottom: 10px;">
                <div class="chat-bubble" style="background:${isMine ? 'var(--primary)' : '#334155'}; padding: 10px 14px; border-radius: 12px; max-width: 75%; color: #fff;">
                    <div style="font-size: 0.75rem; color: #cbd5e1; margin-bottom: 4px;">${escapeHtml(msg.senderName)}</div>
                    <div>${escapeHtml(msg.text)}</div>
                    <div style="font-size: 0.7rem; color: #94a3b8; text-align: right; margin-top: 5px;">${timeStr}</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Send Message & Get AI Response (Bug 2 Fixed: Gemini API Connected)
async function fbSendMessage(text) {
    if (!activeChatSession || !text) return;
    
    const targetId = activeChatSession.targetId;
    const storageKey = 'ot_demo_messages_' + targetId;
    let msgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    // ၁။ User ပို့လိုက်တဲ့ Message ကို သိမ်းပြီး UI မှာ ပြမည်
    const userMsg = {
        id: Date.now().toString(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        text: text,
        timestamp: Date.now()
    };
    msgs.push(userMsg);
    localStorage.setItem(storageKey, JSON.stringify(msgs));
    renderChatMessages(msgs);

    // ၂။ Gemini API ကို ခေါ်ပြီး AI ဆီက စာပြန်ခိုင်းမည် (Hardcoded reply အစား)
    if (!state.apiKey) {
        showToast("Gemini API Key မရှိသေးပါ။ Settings တွင် ထည့်ပါ။", "warn");
        return;
    }

    try {
        // app.js ထဲက wkGeminiFetch ကို လှမ်းသုံးထားပါသည်
        const prompt = `You are a friendly and helpful assistant chatting in a messaging app. Reply naturally to this message: "${text}"`;
        
        const resp = await wkGeminiFetch(state.aiModel, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        });

        if (resp.ok) {
            const data = await resp.json();
            const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            
            if (aiText) {
                // AI ပြန်ပို့တဲ့ Message ကို သိမ်းပြီး UI မှာ ပြမည်
                const aiMsg = {
                    id: Date.now().toString(),
                    senderId: targetId,
                    senderName: activeChatSession.title || 'Gemini AI',
                    text: aiText,
                    timestamp: Date.now()
                };
                
                msgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
                msgs.push(aiMsg);
                localStorage.setItem(storageKey, JSON.stringify(msgs));
                renderChatMessages(msgs);
            }
        } else {
            showToast("AI Error: API Rate Limit သို့မဟုတ် Key မှားနေပါသည်။", "error");
        }
    } catch (error) {
        showToast("Connection failed.", "error");
    }
}

// Voice Message Handler (For app.js integration)
async function fbSendAudioMessage(blob, durationSec, text) {
    if(text) {
        await fbSendMessage(text);
    }
}
