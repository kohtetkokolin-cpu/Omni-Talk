/* ==========================================================
   OmniTalk PRO v12.0 — firebase-chat.js
   Real-Time Firebase Firestore Messenger Engine
   Features: Multi-device sync, Live onSnapshot, Auto-Translate
========================================================== */

// Firebase Firestore နှင့် Auth ချိတ်ဆက်ခြင်း
let db, auth;
try {
    db = firebase.firestore();
    auth = firebase.auth();
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}

// ၁။ လက်ရှိ User အချက်အလက် (LocalStorage မှ ယူမည် သို့မဟုတ် အသစ်ထုတ်မည်)
let currentUser = JSON.parse(localStorage.getItem('ot_currentUser')) || {
    uid: 'ot_' + Math.random().toString(36).substring(2, 9),
    displayName: 'User ' + Math.floor(100 + Math.random() * 900),
    friendCode: Math.floor(100000 + Math.random() * 900000).toString(),
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + Math.random().toString(36).substring(2, 7),
    targetLang: 'my'
};

let myFriendsCache = [];
let activeChatSession = null;
let currentChatUnsubscribe = null; // Real-time listener ဖြုတ်ရန်

// ၂။ App စတင်ချိန် User အကောင့်ကို Firestore တွင် Register ပြုလုပ်ခြင်း
async function fbInit() {
    localStorage.setItem('ot_currentUser', JSON.stringify(currentUser));
    
    // UI ပေါ်ရှိ Friend Code များကို သတ်မှတ်ပေးခြင်း
    const codeDisplay = document.getElementById('myFriendCodeDisplay');
    if (codeDisplay) codeDisplay.textContent = currentUser.friendCode;
    
    const profileName = document.getElementById('settingsProfileName');
    if (profileName) profileName.textContent = currentUser.displayName;

    const profileCode = document.getElementById('settingsProfileCode');
    if (profileCode) profileCode.textContent = 'Friend ID: OT-' + currentUser.friendCode;

    const qrCodeText = document.getElementById('qrCodeFriendId');
    if (qrCodeText) qrCodeText.textContent = 'ID: OT-' + currentUser.friendCode;

    if (!db) {
        showToast("Firebase Config မချိတ်ဆက်ရသေးပါ", "error");
        return;
    }

    try {
        // User profile ကို Firestore database ထဲသို့ အမြဲ Update လုပ်မည်
        await db.collection('users').doc(currentUser.uid).set({
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            friendCode: currentUser.friendCode,
            avatar: currentUser.avatar,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Firebase Connection အောင်မြင်ကြောင်း UI တွင် ပြသခြင်း
        const badge = document.getElementById('firebaseStatusBadge');
        if (badge) {
            badge.textContent = "Connected (Online)";
            badge.style.color = "#34D399";
        }

        // သူငယ်ချင်းစာရင်းကို Firestore မှ Real-time စောင့်ကြည့်ယူခြင်း
        listenToFriendsList();
    } catch (err) {
        console.error("Firestore sync error:", err);
        const badge = document.getElementById('firebaseStatusBadge');
        if (badge) {
            badge.textContent = "Offline Mode";
            badge.style.color = "#EF4444";
        }
    }
}

// ၃။ Firestore ပေါ်ရှိ သူငယ်ချင်းစာရင်းကို Real-time နားထောင်ခြင်း
function listenToFriendsList() {
    if (!db) return;
    db.collection('users').doc(currentUser.uid).collection('friends')
      .onSnapshot(snapshot => {
          myFriendsCache = [];
          // Bot အကောင့် အမြဲပါဝင်စေရန်
          myFriendsCache.push({ uid: 'ai_assistant', displayName: 'Gemini AI', avatar: '🤖', isBot: true, targetLang: 'Myanmar' });

          snapshot.forEach(doc => {
              myFriendsCache.push(doc.data());
          });

          renderFriendsList(myFriendsCache);
          renderRecentChatsList();
      });
}

// ၄။ Friend Code ဖြင့် တကယ့် Online User ကို ရှာဖွေပြီး Add ခြင်း
async function fbAddFriendByCode(code) {
    if (!code) return { ok: false };
    if (code === currentUser.friendCode) return { ok: false, reason: 'self' };
    if (!db) return { ok: false };

    try {
        // Firestore တွင် Friend Code တူသော User ကို ရှာဖွေခြင်း
        const querySnapshot = await db.collection('users').where('friendCode', '==', code.trim()).get();

        if (querySnapshot.empty) {
            return { ok: false, reason: 'not_found' };
        }

        let friendDoc = querySnapshot.docs[0];
        let friendData = friendDoc.data();

        // မိမိ၏ Friends list ထဲသို့ ထည့်သွင်းခြင်း
        await db.collection('users').doc(currentUser.uid).collection('friends').doc(friendData.uid).set({
            uid: friendData.uid,
            displayName: friendData.displayName,
            avatar: friendData.avatar,
            friendCode: friendData.friendCode,
            targetLang: 'Chinese', // Auto-translate အတွက်
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // တစ်ဖက်လူ၏ Friends list ထဲသို့လည်း မိမိအကောင့်ကို အလိုအလျောက် သွားထည့်ပေးခြင်း (Mutual Friend)
        await db.collection('users').doc(friendData.uid).collection('friends').doc(currentUser.uid).set({
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            avatar: currentUser.avatar,
            friendCode: currentUser.friendCode,
            targetLang: 'Myanmar',
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return { ok: true };
    } catch (err) {
        console.error("Add friend error:", err);
        return { ok: false };
    }
}

// ၅။ Chat ခန်းထဲဝင်ခြင်း (Real-time Message Listener ဖွင့်ခြင်း)
function openChatSession(type, targetId, title) {
    activeChatSession = { type, targetId, title };
    const chatRoom = document.getElementById('chatRoomView');
    const chatTitle = document.getElementById('activeChatTitle');

    if (chatRoom) chatRoom.style.display = 'flex';
    if (chatTitle) chatTitle.textContent = title;

    if (!db || targetId === 'ai_assistant') {
        // AI Assistant နှင့် စကားပြောလျှင် LocalStorage ဖြင့်သာ အလုပ်လုပ်မည်
        const msgs = JSON.parse(localStorage.getItem('ot_demo_messages_' + targetId) || '[]');
        renderChatMessages(msgs);
        return;
    }

    // ဖုန်းနှစ်လုံးကြား တူညီသော Chat ID ဖန်တီးခြင်း (ဥပမာ - uidA_uidB)
    const chatId = [currentUser.uid, targetId].sort().join('_');

    // ယခင် နားထောင်နေသော Listener ရှိလျှင် ဖြုတ်မည်
    if (currentChatUnsubscribe) {
        currentChatUnsubscribe();
    }

    // Firestore Real-time listener: စာအသစ်ဝင်လာသည်နှင့် ချက်ချင်း UI ပြောင်းလဲစေမည်
    currentChatUnsubscribe = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            const msgs = [];
            snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
            renderChatMessages(msgs);
        }, err => {
            console.error("Chat sync error:", err);
        });
}

// ၆။ Message ပို့ခြင်း နှင့် Gemini Real-time Translation
async function fbSendMessage(text) {
    if (!activeChatSession || !text || !text.trim()) return;

    const targetId = activeChatSession.targetId;
    const cleanText = text.trim();

    // AI Bot နှင့် ပြောဆိုခြင်း ဖြစ်ပါက
    if (targetId === 'ai_assistant') {
        await handleAiBotMessage(cleanText);
        return;
    }

    if (!db) {
        showToast("Database ချိတ်ဆက်မှု မရှိပါ", "error");
        return;
    }

    const chatId = [currentUser.uid, targetId].sort().join('_');
    const friendInfo = myFriendsCache.find(f => f.uid === targetId);
    const targetLang = friendInfo?.targetLang || "Chinese";

    try {
        // ၁။ Firestore ပေါ်သို့ Message အရင်တင်မည် (အခြားဖုန်းတွင် စာတန်းရောက်သွားစေရန်)
        const docRef = await db.collection('chats').doc(chatId).collection('messages').add({
            senderId: currentUser.uid,
            senderName: currentUser.displayName,
            avatar: currentUser.avatar,
            originalText: cleanText,
            translatedText: "Translating...",
            timestamp: Date.now()
        });

        // ၂။ Gemini API ဖြင့် ဘာသာပြန်ခြင်း
        if (state.apiKey) {
            const prompt = `Translate the following message into natural spoken ${targetLang}. Return ONLY the translated sentence with no extra explanations: "${cleanText}"`;
            
            const resp = await wkGeminiFetch(state.aiModel, {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
            });

            if (resp.ok) {
                const data = await resp.json();
                const translated = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || cleanText;
                
                // ၃။ Firestore ပေါ်ရှိ Message တွင် ဘာသာပြန်ထားသော စာသားအား Update လုပ်ခြင်း
                await docRef.update({
                    translatedText: translated
                });
            } else {
                await docRef.update({ translatedText: cleanText });
            }
        } else {
            await docRef.update({ translatedText: cleanText });
        }
    } catch (err) {
        console.error("Message send error:", err);
        showToast("မက်ဆေ့ခ်ျ ပေးပို့ခြင်း မအောင်မြင်ပါ", "error");
    }
}

// AI Bot စကားပြောဆွေးနွေးမှု
async function handleAiBotMessage(text) {
    const storageKey = 'ot_demo_messages_ai_assistant';
    let msgs = JSON.parse(localStorage.getItem(storageKey) || '[]');

    msgs.push({
        id: Date.now().toString(),
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        avatar: currentUser.avatar,
        originalText: text,
        translatedText: '',
        timestamp: Date.now()
    });
    localStorage.setItem(storageKey, JSON.stringify(msgs));
    renderChatMessages(msgs);

    if (!state.apiKey) {
        showToast("Gemini API Key ထည့်ရန် လိုအပ်ပါသည်", "warn");
        return;
    }

    try {
        const resp = await wkGeminiFetch(state.aiModel, {
            contents: [{ parts: [{ text: `You are a helpful AI assistant in a chat app. Reply directly to: "${text}"` }] }],
            generationConfig: { temperature: 0.7 }
        });

        if (resp.ok) {
            const data = await resp.json();
            const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            let updatedMsgs = JSON.parse(localStorage.getItem(storageKey) || '[]');
            updatedMsgs.push({
                id: Date.now().toString(),
                senderId: 'ai_assistant',
                senderName: 'Gemini AI',
                avatar: '🤖',
                originalText: aiReply,
                translatedText: '',
                timestamp: Date.now()
            });
            localStorage.setItem(storageKey, JSON.stringify(updatedMsgs));
            renderChatMessages(updatedMsgs);
        }
    } catch (e) {
        showToast("AI ချိတ်ဆက်မှု အခက်အခဲရှိပါသည်", "error");
    }
}

// ၇။ UI ပေါ်တွင် Message များကို ပုံဖော်ပြသခြင်း
function renderChatMessages(msgs) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    container.innerHTML = msgs.map(msg => {
        const isMine = msg.senderId === currentUser.uid;
        const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        
        const mainText = isMine ? msg.originalText : (msg.translatedText || msg.originalText);
        const subText = isMine ? msg.translatedText : msg.originalText;
        const avatar = isMine ? currentUser.avatar : (msg.avatar || '👤');

        return `
            <div class="chat-bubble-row ${isMine ? 'mine' : 'theirs'}" style="display:flex; flex-direction:${isMine ? 'row-reverse' : 'row'}; align-items:flex-start; margin-bottom: 14px; gap: 8px; width: 100%;">
                <img src="${avatar}" alt="avatar" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; background: #1e293b; flex-shrink: 0;">
                
                <div style="display:flex; flex-direction:column; align-items:${isMine ? 'flex-end' : 'flex-start'}; max-width: 75%;">
                    <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 3px; padding: 0 4px;">${escapeHtml(msg.senderName)}</div>
                    
                    <div class="chat-bubble" style="background:${isMine ? '#10b981' : '#334155'}; color:#fff; padding: 10px 14px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                        <div style="font-size: 0.95rem; word-break: break-word;">${escapeHtml(mainText)}</div>
                        
                        ${subText && subText !== "Translating..." && subText !== mainText ? `
                            <div style="font-size: 0.82rem; color: ${isMine ? '#d1fae5' : '#94a3b8'}; margin-top: 6px; border-top: 1px solid ${isMine ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}; padding-top: 5px;">
                                ${escapeHtml(subText)}
                            </div>
                        ` : ''}

                        ${subText === "Translating..." ? `
                            <div style="font-size: 0.8rem; color: #38bdf8; margin-top: 4px; font-style: italic;">
                                ⏳ ဘာသာပြန်နေသည်...
                            </div>
                        ` : ''}
                    </div>
                    <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 3px; padding: 0 4px;">${timeStr}</div>
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

// Contacts Tab တွင် သူငယ်ချင်းများ ပြသခြင်း
function renderFriendsList(friends) {
    const container = document.getElementById('contactsList');
    if (!container) return;

    if (friends.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px;">သူငယ်ချင်း မရှိသေးပါ။ Friend Code ဖြင့် Add ပါ။</div>`;
        return;
    }

    container.innerHTML = friends.map(friend => `
        <div onclick="openChatSession('private', '${friend.uid}', '${escapeHtml(friend.displayName)}')" 
             style="display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer;" 
             onmouseover="this.style.background='rgba(255,255,255,0.05)'" 
             onmouseout="this.style.background='transparent'">
            <img src="${friend.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + friend.uid}" 
                 alt="avatar" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; background: #1e293b; margin-right: 14px;">
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #f8fafc; font-size: 0.95rem; margin-bottom: 2px;">${escapeHtml(friend.displayName)}</div>
                <div style="font-size: 0.8rem; color: ${friend.isBot ? '#10b981' : '#94a3b8'};">
                    ${friend.isBot ? '🤖 AI Assistant' : 'ID: ' + (friend.friendCode || 'Online')}
                </div>
            </div>
        </div>
    `).join('');
}

// Chats Tab တွင် Recent Chats ပြသခြင်း
function renderRecentChatsList() {
    const container = document.getElementById('recentChatsList');
    if (!container) return;
    renderFriendsList(myFriendsCache);
}

// Group ဖန်တီးခြင်း
async function fbCreateGroupChat(name, selectedUids) {
    showToast("Group '" + name + "' ဖန်တီးပြီးပါပြီ။", "success");
}

// Audio Message ပို့ခြင်း
async function fbSendAudioMessage(blob, durationSec, text) {
    if (text) await fbSendMessage(text);
}
