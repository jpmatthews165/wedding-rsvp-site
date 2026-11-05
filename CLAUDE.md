# Josh & Sneha wedding site — notes for Claude

React 19 + Vite + Tailwind 3, Firebase (Firestore + Google Auth), Vercel (hosting + `/api` serverless functions). Live: https://wedding.joshandsneha2027.com

## Where things live

- **Site text, photos, section order** are *data*, not code: Firestore `settings/content` (published) and `settings/contentDraft` (editor draft). Defaults and the shape are in `src/content/defaultContent.js`; every editable field is declared in `src/content/schema.js`.
  - To change wording, Sneha/Josh should use the editor at `/admin/editor` (or its "Ask Claude" panel). Editing `defaultContent.js` does **not** change the live site once anything has been published.
- **Layout, styling, new section types, new features** are code:
  - `src/site/Site.jsx`: page shell (menu, header, footer), renders sections in order.
  - `src/site/sections/Sections.jsx`: one component per section type. `RsvpSection.jsx` is the guest RSVP flow.
  - `src/site/editing.jsx`: `<T f="field" />` renders a text field and makes it click-to-edit inside the editor. Use it for any new text.
  - `src/components/ParallaxBackground.jsx`: universal parallax.
- **Admin**: `/admin` → `src/admin/AdminApp.jsx` (guests, households, events). `/admin/editor` → `src/admin/editor/` (visual editor, AI assistant, publish history). `/preview-frame` renders the site inside the editor's iframe.
- **API** (`api/`, Vercel functions, Firebase Admin SDK):
  - `lookup.js`, `household.js` and `rsvp.js`: guest RSVP. Guests never read Firestore directly.
  - `assistant.js`: the "Ask Claude" companion (Anthropic SDK, `claude-opus-5-5`). It returns edit *operations* (`set`/`insert`/`remove`/`move` on dotted paths) that the editor applies to the draft.
  - `upload.js`: Vercel Blob upload tokens for editor photos.
  - Admin endpoints verify the Firebase ID token and the email list in `src/adminConfig.js`.
- **Security**: `firestore.rules` (paste into the Firebase console). Admin emails must match in `src/adminConfig.js` **and** `firestore.rules`.

## Adding a new section type

1. Add it to `SECTION_TYPES` in `src/content/schema.js` (label, description, fields, template). The editor form and the AI assistant pick it up automatically.
2. Add a component in `src/site/sections/Sections.jsx` using `<T f="..." />` for text and `<ImageButton f="image" />` for photos.
3. Register it in `COMPONENTS` in `src/site/Site.jsx`.

New fields on existing types need a default in the type's `template` so old content keeps working (`normalizeContent` fills them in).

## Commands

```bash
npm run dev      # site + editor UI (no /api; RSVP search, uploads and AI need `npx vercel dev`)
npm run build
npm run lint
```

## Conventions

- Colors: background `#e6dbcc`, alt `#dccfb9`, primary purple `#6c5d84`, text `#333036`, rose `#d4a5a5`. Fonts: `font-title` (Le Major), `font-subtitle` (Ablation), `font-details` (Cardo).
- Never expose guest contact data to the public site; anything guest-facing goes through `/api`.
- Work on a branch; Vercel builds a preview for every pushed branch. Merging to `main` deploys.
