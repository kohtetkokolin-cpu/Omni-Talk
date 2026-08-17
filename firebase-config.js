/* ==========================================================
   firebase-config.js — YOUR REAL KEYS GO HERE (this file is
   gitignored — it will never be committed or pushed to GitHub).

   Setup:
   1. This file already sits next to firebase-config.example.js
      (the safe-to-commit template with placeholder values).
   2. Paste your real Firebase Web App config below. Find it in:
      Firebase Console -> Project Settings -> General -> Your apps -> Web app
   3. .gitignore already excludes this exact filename, so `git add .`
      / `git push` will never include it — check `git status` once to
      confirm it shows as untracked/ignored before your first push.

   Important — what actually keeps your Firebase project secure:
   Firebase Web config values (apiKey, authDomain, etc.) are NOT
   secret the way a server API key is — Firebase is designed so this
   config can sit in public client-side code, and anyone can read it
   out of your deployed site's network tab regardless of .gitignore.
   Real protection comes from these three things (set them up in the
   Firebase/Google Cloud console, not in this file):
     a) Firestore/Storage/Realtime-DB Security Rules — the actual
        gatekeeper for who can read/write your data. Never leave
        rules in "test mode" (allow read, write: if true) in production.
     b) API key restrictions (Google Cloud Console -> APIs & Services
        -> Credentials -> your key -> Application restrictions ->
        HTTP referrers) — limit this key to only your real domain(s)
        so it can't be reused elsewhere even if someone copies it.
     c) Firebase App Check — attests requests come from your real,
        unmodified app; recommended once you have real users.
   Hiding this file from GitHub is still good practice (keeps your
   project id out of casual scraping/scanning and search-engine
   indexing of your repo), but (a)-(c) above are what actually stops
   someone from reading or writing your data.
========================================================== */
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
