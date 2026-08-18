# 🌐 OmniTalk — Global AI Messenger & Workspace Suite

**OmniTalk** (*"Speak Local, Connect Global"*) is a World-Class Multilingual Real-Time Chat & Workspace Translation Suite inspired by WeChat and DingTalk. Built with pure modern Web standards, Google Gemini AI, and Firebase.

---

## ✨ Key Features & Architecture

1. **💬 Real-Time Multilingual Chat (WeChat + DingTalk Style)**:
   - **1-on-1 Direct Chat & Work Group Collaboration**: Instant messaging across all devices.
   - **Instant Friend Adding**: Add teammates and friends via 6-digit Friend Code or QR.
   - **Cross-Language Auto-Translation**: Each participant selects their own preferred reading language (`🇲🇲 Myanmar`, `🇺🇸 English`, `🇨🇳 Chinese`, `🇹🇭 Thai`, etc.). Messages arrive automatically translated into their chosen language, with instant access to the original text.
   - **Voice Notes with AI Speech-to-Text**: Audio recordings transcribed and auto-translated into the recipient's chosen reading language.
   - **Photo & Document File Sharing**: Send images, PDFs, and work specifications with clean preview cards.

2. **⚡ Integrated Workspace & Productivity Hub**:
   - **💬 Face-to-Face Walkie-Talkie Mode**: Rotated split-screen for two-person live physical conversations.
   - **🔍 Quick Translate & Photo OCR**: Instant translation for text, camera photo OCR scanning, and voice.
   - **⚡ Gemini Live Simultaneous Interpreter**: Continuous hands-free real-time interpretation.
   - **📋 120+ Survival & Work Phrasebook**: Verified audio phrases across medical, workplace, emergency, and immigration.

3. **🌍 4-Language UI Localization (i18n)**:
   - Complete localized interface for **Myanmar (🇲🇲)**, **English (🇺🇸)**, **Chinese (🇨🇳)**, and **Thai (🇹🇭)**.

4. **🚀 Zero-Server Deployment**:
   - Deploy directly to **GitHub Pages**, **Vercel**, **Firebase Hosting**, or **Netlify**.

---

## 🛠️ Quick Setup & Deployment

1. Configure your Firebase project by following `FIREBASE_SETUP.md`.
2. Set up Firebase Security Rules (Firestore/Storage) and, in Google Cloud Console → Credentials, restrict your Firebase API key to your real domain(s) via HTTP referrer restrictions — this is what actually protects your project, not hiding the key. See the comment block at the top of `firebase-config.js` for details.
3. Each person who uses the app enters their own Gemini API key in **Settings → Google Gemini AI Engine & API Key**, stored only in their own browser's local storage — you don't need to share or embed your own AI key when distributing the app.
4. **Deploying your real Firebase key** — two options, pick one:

   **Option A — GitHub Actions (recommended, keeps the real key out of git entirely):**
   - Keep `firebase-config.js` as the placeholder template it already is (never edit it with your real values) — it stays gitignored either way.
   - In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**, and add these six secrets, one value each, from Firebase Console → Project Settings → General → Your apps → Web app:
     `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`
   - In **Settings → Pages**, set Source to **GitHub Actions** (not "Deploy from a branch").
   - Push to `main`. The included `.github/workflows/deploy.yml` writes your real config into a temporary build copy of `firebase-config.js` and deploys that — the real key is encrypted in GitHub Secrets and never appears in your repo, a commit, or git history.

   **Option B — simpler, if you don't want to use Actions:**
   - Firebase web config values are not secret by design the way a server API key is — Firebase itself documents this (protection comes from Security Rules + key restrictions in step 2, not from hiding the config). If GitHub's push protection flags your key when you commit `firebase-config.js` with real values, you can click **"Allow secret"** in the GitHub prompt for this specific push — this is the officially-sanctioned move for this exact key type. Copy `firebase-config.example.js` to `firebase-config.js`, fill in your real values, and push normally (skip the `.gitignore` entry for this file, or remove it from `.gitignore`, if you go this route).
  
     
