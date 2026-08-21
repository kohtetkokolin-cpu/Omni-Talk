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
const firebaseConfig = {
  apiKey: "AIzaSyCuSnW084iY-6-1UUH3CarAy3__XFQowXs",
  authDomain: "omni-talk-messenger.firebaseapp.com",
  projectId: "omni-talk-messenger",
  storageBucket: "omni-talk-messenger.firebasestorage.app",
  messagingSenderId: "668979617067",
  appId: "1:668979617067:web:1452ed9684328fea43b96e",
  measurementId: "G-8HDBQJBKQ6"
};
