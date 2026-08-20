/* ==========================================================
   firebase-config.js
   Paste your real Firebase Web App config below, then commit and
   push this file normally — no GitHub Secrets or Actions needed.

   Find these values in:
   Firebase Console -> Project Settings -> General -> Your apps -> Web app

   If GitHub shows a "push protection" warning when you push this file
   with real values filled in, click "Allow secret" — this is expected
   and safe for this specific file. Firebase Web config values are not
   secret the way a server API key is; Firebase is designed so this
   config sits in public client-side code (anyone can read it out of
   your deployed site regardless). What actually protects your project:
     - Firestore/Storage Security Rules (Firebase Console) — never leave
       these in "test mode" (allow read, write: if true) in production.
     - API key restrictions (Google Cloud Console -> APIs & Services ->
       Credentials -> your key -> Application restrictions -> HTTP
       referrers) — restrict this key to your real domain(s).
   Set those two up once and this file is safe to keep in your repo.
========================================================== */
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
