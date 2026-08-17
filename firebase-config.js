/* ==========================================================
   firebase-config.js — PLACEHOLDER TEMPLATE, safe to commit as-is.

   Recommended setup (keeps your real key fully out of git):
   Don't edit this file with real values. Instead add your six Firebase
   values as GitHub repository secrets (Settings -> Secrets and variables
   -> Actions) and set GitHub Pages' source to "GitHub Actions". The
   included .github/workflows/deploy.yml writes the real config into a
   throwaway build copy of this exact file at deploy time — your real key
   never appears in a commit, a diff, or git history. See README.md for
   the exact secret names and steps.

   Simpler alternative: fill in real values below and push directly. If
   GitHub's push protection flags the key, click "Allow secret" — Firebase
   web config values are not secret by design (see below), so this is a
   safe, sanctioned choice for this specific key type, not a workaround.
   If you do this, also remove the "firebase-config.js" line from
   .gitignore so your real values actually get committed and deployed.

   Important — what actually keeps your Firebase project secure:
   Firebase Web config values (apiKey, authDomain, etc.) are NOT secret
   the way a server API key is — Firebase is designed so this config can
   sit in public client-side code, and anyone can read it out of your
   deployed site's network tab regardless of which option above you pick.
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
========================================================== */
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
