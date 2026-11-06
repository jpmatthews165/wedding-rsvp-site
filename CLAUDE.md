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
  - Per-element formatting & position (editor format bar / drag): stored as `section.styles[<field path with _>]`, validated in `src/content/fieldStyle.js`. `<T>` applies it (outer tag keeps the design classes, inner span carries the formatting); wrap selectable blocks in `<Movable f=… kind=…>` (kinds: image, button, line, box, map; layout-only keys start with `_`, e.g. `_btn`, `_divider`, `_map`, `items.N._card`). Styles also hold size (`w/h`, phone `mw/mh`, via `[data-w]`… in index.css), `fill` and `radius`. Grid size and the edge buffer are shared settings in `content.site.layoutGrid` / `layoutBuffer` (phones use 2/3 of the buffer). Desktop edits also save a phone *intent*: each section's desktop reading order (`section.phoneOrder`, from `src/content/readingOrder.js`: bands, then columns left→right, grids row by row), horizontal placement `pl` and scaled sizes. `src/site/phoneLayout.js` re-flows the section on the phone in that order (vertical shift `--ry`, keeping the phone's own spacing) and places items horizontally inside the buffer. Section heights (`section.layout`: `h`/`pb` desktop, `mh`/`mpb` phone, `d` = desktop change, half applied on phones automatically) come from dragging a section's bottom edge in the editor (`SectionResizeHandle` in editing.jsx); editing in the phone preview sets `mAuto: false` (hand-tuned) and stops that. Section backgrounds: clicking empty space in a section selects `<base>._bg` (kind `section`), and the format bar shows `SectionBgBar`. Data is `section.bg` = `{ color, image, imagePos, imageOpacity }` (the color replaces the section's background) (`cleanSectionBg` in fieldStyle.js), painted by `src/site/SectionBackground.jsx`, which must be the first child of every `<section>`. The cover, registry and RSVP sections keep using their own `image` field; `bg` only adds the color and the photo's opacity (`[data-bgio]`). Offsets use the CSS `translate` property (`[data-moved]` in index.css); phones use separate `mx/my`. The editor-only drag/snap overlay is `src/site/DragLayer.jsx` (Shift+click groups, smart guides to other items' edges/centres and the section's centre/margins, grid fallback, align commands). The preview sends `editMany` for group changes so they're one Undo step.
- **Admin**: `/admin` → `src/admin/AdminApp.jsx` (sidebar shell; page in the URL hash). Pages in `src/admin/pages/` (Overview, Guests, Households, Events), dialogs in `src/admin/dialogs.jsx`, shared UI and RSVP status colors in `src/admin/ui.jsx`. All Firestore reads/writes for guests, households and events live in `src/admin/useGuestData.js`. `/admin/editor` → `src/admin/editor/` (visual editor, AI assistant, publish history). `/preview-frame` renders the site inside the editor's iframe.
- **API** (`api/`, Vercel functions, Firebase Admin SDK):
  - `lookup.js`, `household.js` and `rsvp.js`: guest RSVP. Guests never read Firestore directly.
  - `assistant.js`: the "Ask Claude" companion (Anthropic SDK, `claude-opus-5-5`). It returns edit *operations* (`set`/`insert`/`remove`/`move` on dotted paths) that the editor applies to the draft.
  - `upload.js`: Vercel Blob upload tokens for editor photos.
  - `design.js`: "Design changes" from the editor: starts the GitHub workflow, reports status/preview, approves (merges) or discards. Requests are stored in Firestore `designRequests`.
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

## Theme and photos

- Colors and fonts are editable (Site settings → Colors & fonts) and stored in `content.theme`. In site code, **use the theme tokens, never hex colors**: `bg-paper`, `bg-paper2`, `text-brand`, `bg-brand-dark`, `text-ink`, `text-ink-soft`, `bg-accent`, `border-accent2` (opacity modifiers like `bg-brand/40` work). Fonts: `font-title`, `font-subtitle`, `font-details`. These map to CSS variables set by `src/site/ThemeStyle.jsx` from `src/content/theme.js`.
- Photos use `<CoverImage src pos />` or `<ParallaxBackground image pos />`. The position is stored next to the image as `<field>Pos` (`{ x, y, zoom, mobile? }`) and edited with the editor's Reposition tool.
- The admin and editor screens use fixed hex colors on purpose, so they don't change with the site theme.

## Conventions

- The public site must not import `src/firebase.js` (the Firebase SDK is ~160 KB gzipped). It reads public docs with `readPublicDoc()` from `src/content/publicRead.js`; only admin/editor code uses the SDK.
- Links from editable content go through `safeUrl()` (`src/lib/safeUrl.js`).

- Never expose guest contact data to the public site; anything guest-facing goes through `/api`.
- Work on a branch; Vercel builds a preview for every pushed branch. Merging to `main` deploys.

## Design changes from the editor (Claude Code on GitHub)

The editor's **Ask Claude → Design changes** tab lets an admin request a *visual* code change. `api/design.js` starts `.github/workflows/design-change.yml`, which runs Claude Code headless with edit permission only for the guest site's visual files, then `.github/design/guard.mjs` rejects the change if anything else changed (allowlist and forbidden patterns live in `.github/design/scope.mjs`), then the site must build, then it's pushed to a `design/<id>` branch. Vercel builds a preview; the change only reaches `main` when someone clicks **Approve & publish**.

- Behaviour stays out of the visual files on purpose: e.g. the RSVP logic is in `src/site/sections/useRsvp.js` (protected) and `RsvpSection.jsx` is only its look. Keep that split when adding features.
- If you change which files are "visual", update `scope.mjs` **and** the `--allowedTools`/`--disallowedTools` lists in the workflow.
