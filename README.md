# Josh & Sneha Wedding Site

Live at https://wedding.joshandsneha2027.com · React + Vite + Tailwind · Firebase (Firestore + Auth) · hosted on Vercel.

## How it fits together

| Part | Where | Who can use it |
|---|---|---|
| Public site | `src/App.jsx` | Everyone |
| Guest RSVP lookup & answers | `api/lookup.js`, `api/household.js`, `api/rsvp.js` (Vercel serverless functions) | Guests — only see their own household, never contact info |
| Admin dashboard | `/admin` | Google accounts listed in `src/adminConfig.js` **and** `firestore.rules` |
| Database security | `firestore.rules` | Pasted into the Firebase console |
| Parallax backgrounds | `src/components/ParallaxBackground.jsx` | — |

The browser never reads the guest list directly. Guest lookups go through `/api/*`, which runs on Vercel with a Firebase service account.

## One-time setup (do these **in order**)

Merging this code before steps 1–2 will break RSVPs on the live site, because the new code needs the service account.

1. **Service account → Vercel**
   - Firebase console → ⚙ Project settings → *Service accounts* → **Generate new private key** (downloads a JSON file. Keep it private and never commit it).
   - Vercel → project → *Settings → Environment Variables* → add `FIREBASE_SERVICE_ACCOUNT` = the **entire JSON file contents**, for Production and Preview.
2. **Google sign-in**
   - Firebase console → *Authentication → Sign-in method* → enable **Google**.
   - *Authentication → Settings → Authorized domains* → make sure `wedding.joshandsneha2027.com` is listed.
   - Admin emails live in `src/adminConfig.js` **and** `firestore.rules`. Keep both lists the same when adding or removing someone.
3. **Deploy**: merge to `main`. Vercel builds automatically.
4. **Lock the database**: Firebase console → *Firestore → Rules* → paste `firestore.rules` → **Publish**.
5. **Optional cleanup**: *Authentication → Sign-in method* → disable **Anonymous** (no longer used).

## Local development

```bash
npm install
npm run dev          # site only (RSVP lookup won't work — no /api)
npx vercel dev       # site + /api functions (needs `vercel link` and the env var locally)
npm run build && npm run lint
```
