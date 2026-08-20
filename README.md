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
2. Set up Firebase Security Rules (Firestore/Storage) and, in Google Cloud Console → Credentials, restrict your Firebase API key to your real domain(s) via HTTP referrer restrictions — this (not hiding the key) is what actually protects your project. See the comment block at the top of `firebase-config.js` for details.
3. Open `firebase-config.js`, paste your six real values from Firebase Console → Project Settings → General → Your apps → Web app, save the file.
4. Commit and push normally. If GitHub shows a push-protection warning, click **"Allow secret"** — expected and safe for this file (see the comment in `firebase-config.js` for why).
5. **Settings → Pages → Source: Deploy from a branch**, pick `main` / root, save. Your site goes live at the URL shown there within a minute or two.
6. Each person who uses the app enters their own Gemini API key in **Settings → Google Gemini AI Engine & API Key** inside the app itself, stored only in their own browser's local storage — you don't need to share or embed your own AI key when distributing the app.
