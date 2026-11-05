# Josh & Sneha Wedding Site

Live at https://wedding.joshandsneha2027.com · React + Vite + Tailwind · Firebase (Firestore + Auth) · hosted on Vercel.

## How it fits together

| Part | Where | Who can use it |
|---|---|---|
| Public site | `src/site/` (renders from content in Firestore) | Everyone |
| Guest RSVP lookup & answers | `api/lookup.js`, `api/household.js`, `api/rsvp.js` (Vercel serverless functions) | Guests — only see their own household, never contact info |
| Admin dashboard | `/admin` | Google accounts listed in `src/adminConfig.js` **and** `firestore.rules` |
| Website editor + "Ask Claude" | `/admin/editor`, `api/assistant.js`, `api/upload.js` | Same admin accounts |
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
5. **Website editor extras** (needed for the AI assistant and photo uploads)
   - **Claude:** create an API key at https://platform.claude.com (Settings → API keys; add a few dollars of credit). In Vercel, add `ANTHROPIC_API_KEY` for Production and Preview. Each assistant request costs a few cents.
   - **Photo uploads:** Vercel → project → *Storage* → **Create** → **Blob** → connect it to this project. That adds `BLOB_READ_WRITE_TOKEN` automatically. The Hobby plan includes free storage.
   - Redeploy after adding them.
6. **Optional cleanup**: *Authentication → Sign-in method* → disable **Anonymous** (no longer used).

## Editing the website

Go to `/admin/editor` (or click **Edit Website** in the admin dashboard) and sign in with Google.
- **Click any text** in the preview to change it. Click a section to open all of its settings in the left panel: photos, links, lists, show/hide, and menu label.
- **Sections:** add, reorder, hide, duplicate or delete them. New types include Schedule, Text block, Cards and Photo gallery.
- **Ask Claude:** describe a change ("add our sangeet to the schedule", "make the FAQ warmer") and it appears in the preview immediately. Anything it can't do is saved as a request for Josh.
- Changes autosave as a **draft**. Nothing changes for guests until you click **Publish**. **History** lets you go back to any earlier published version, and Undo/Redo work as usual.

## Local development

```bash
npm install
npm run dev          # site only (RSVP lookup won't work — no /api)
npx vercel dev       # site + /api functions (needs `vercel link` and the env var locally)
npm run build && npm run lint
```
