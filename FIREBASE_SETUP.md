# 🔥 Firebase Setup Guide (အစအဆုံး လမ်းညွှန်)

သင်၏ Polyglot Messenger တွင် Real-Time Chat၊ Group Chat၊ ဓာတ်ပုံနှင့် အသံဖိုင် ပို့ဆောင်ခြင်းအတွက် Firebase ကို အောက်ပါအဆင့်များအတိုင်း ပြုလုပ်ပါ:

---

### အဆင့် ၁: Firebase Project အသစ်ပြုလုပ်ခြင်း
1. [Firebase Console](https://console.firebase.google.com/) သို့ သွားပါ။
2. **"Add project"** ကို နှိပ်ပြီး Project အမည်ပေးပါ (ဥပမာ `polyglot-messenger`)။
3. Google Analytics ကို Enable လုပ်လိုက လုပ်ပါ (မလုပ်ဘဲ ကျော်သွားလည်း ရပါသည်) -> **Create Project** ကို နှိပ်ပါ။

---

### အဆင့် ၂: Anonymous Authentication ဖွင့်ခြင်း
1. ဘယ်ဘက် Menu ရှိ **Build > Authentication** သို့ သွားပါ။
2. **"Get started"** ကို နှိပ်ပါ။
3. **Sign-in method** tab အောက်တွင် **"Anonymous"** ကို ရွေးချယ်ပြီး **Enable** လုပ်ကာ **Save** နှိပ်ပါ။
   *(ဤသို့ ပြုလုပ်ခြင်းဖြင့် User များသည် Email/Password မလိုဘဲ ၆ လုံးပါ Friend Code ဖြင့် တိုက်ရိုက် သုံးနိုင်မည်ဖြစ်သည်)*

---

### အဆင့် ၃: Cloud Firestore Database တည်ဆောက်ခြင်း
1. ဘယ်ဘက် Menu ရှိ **Build > Firestore Database** သို့ သွားပါ။
2. **"Create database"** ကို နှိပ်ပါ။
3. Location ကို အနီးဆုံး Server (ဥပမာ `asia-southeast1 (Singapore)`) ရွေးပါ။
4. **"Start in test mode"** ကို ရွေးပြီး **Create** နှိပ်ပါ။
5. Database တည်ဆောက်ပြီးပါက **Rules** tab သို့သွား၍ အောက်ပါ Security Rules ကို ထည့်သွင်းပါ:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
*Rules ထည့်ပြီးပါက **Publish** ကို နှိပ်ပါ။*

---

### အဆင့် ၄: Firebase Storage တည်ဆောက်ခြင်း (ဓာတ်ပုံနှင့် အသံဖိုင်များအတွက်)
1. ဘယ်ဘက် Menu ရှိ **Build > Storage** သို့ သွားပါ။
2. **"Get started"** ကို နှိပ်ပြီး **Test mode** ဖြင့် စတင်ပါ။
3. **Rules** tab သို့သွား၍ အောက်ပါ Security Rules ကို ထည့်သွင်းပါ:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
*Rules ထည့်ပြီးပါက **Publish** ကို နှိပ်ပါ။*

---

### အဆင့် ၅: Web App Configuration ရယူပြီး `firebase-config.js` တွင် ထည့်ခြင်း
1. Firebase Console ၏ Project Overview (အိမ်ပုံစံ) ဘေးရှိ **Settings (⚙️) > Project settings** သို့ သွားပါ။
2. အောက်ဘက်ရှိ **"Your apps"** တွင် **Web icon (</>)** ကို နှိပ်ပါ။
3. App Nickname ပေးပါ (ဥပမာ `PolyglotWeb`) -> **Register app** ကို နှိပ်ပါ။
4. `firebaseConfig` object ထဲရှိ တန်ဖိုးများကို ကူးယူပြီး သင်၏ `firebase-config.js` ဖိုင်ထဲတွင် အောက်ပါအတိုင်း ထည့်ပါ:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "polyglot-messenger.firebaseapp.com",
  projectId: "polyglot-messenger",
  storageBucket: "polyglot-messenger.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```
