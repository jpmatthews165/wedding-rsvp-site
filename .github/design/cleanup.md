## This request is a "Clean up"

The couple arranged some sections by hand in the visual editor: they dragged items around, resized photos and boxes, changed section heights, and sometimes tuned the phone view separately. Those edits are saved as per-element overrides (`section.styles`, `section.layout`, `section.phoneOrder`) applied on top of the section's code as offsets (CSS `translate`), fixed sizes and phone re-flow. It works, but it's brittle: offsets don't adapt to other screen sizes, content lengths or fonts.

Your job is what a senior front-end designer would do with that mock-up: **understand what they were going for visually and rebuild it semantically, as clean, modern, responsive code**, then remove the overrides that the new code makes unnecessary.

### What you get

Read `design-input.json` in the repository root first (it is removed again before anything is committed). It holds:

- `sections`: the chosen sections (`id`, `type`, `position` in the page, and the full saved `section` object, including the text and all its `styles`, `layout` and `phoneOrder`).
- `measurements.desktop` / `measurements.phone`: how each chosen section actually rendered at 1280 px and at 390 px wide, with all the overrides applied: the section's `width`, `height`, padding, the edge `buffer`, and every selectable item `{ key, kind, x, y, w, h, in?, text? }`. `x`/`y` are the item's top-left corner relative to the section; `in` means it sits inside another item. The style key of an item is its key with dots replaced by `_`.
- `otherSectionsOfTheSameTypes`: other sections that use the same component but were NOT chosen. They must look exactly as they do now.
- `settings`: the layout grid (spacing step) and the edge buffers.
- `previousPatch`: on a follow-up, the patch you wrote last time (write a complete new one, not a diff).
- `note`: anything the couple asked for in particular.

Read CLAUDE.md, `src/site/sections/Sections.jsx` (or the section's own file), `src/site/editing.jsx` (to understand `<T>` / `<Movable>`, read-only), and `src/content/fieldStyle.js` (how styles become CSS, read-only).

### How to do it

1. **Read the intent from the measurements.** Compare where things sit on desktop with where the component would put them by default. Name the arrangement: "photo moved to the left of the text, text column narrower", "the three cards made equal height in a row", "buttons side by side, centred", "extra breathing room under the heading". Look at the phone measurements too: they show what the couple saw (or tuned) on the phone.
2. **Build it in code** in the section's component, with real layout: flex/grid, `gap`, `order`, alignment, `max-w-*` for comfortable line lengths, `aspect-*` for photos, responsive Tailwind prefixes (`md:` / `lg:`) so the desktop arrangement collapses gracefully to one column on phones in a sensible reading order. Use a consistent spacing scale (multiples of the grid step), align things that were almost aligned, make repeated things (cards, buttons, photos in a row) consistent, and use a clear hierarchy and generous but not empty whitespace. Approximate the couple's arrangement faithfully; don't copy odd pixel values.
3. **Don't change other sections.** Components are shared by every section of that type. If the new arrangement isn't right for every section of the type (look at `otherSectionsOfTheSameTypes`), make it opt-in: add a new section setting (e.g. `arrangement: 'photo-left'` or `wideText: true`), give it a default in the type's `template` in `src/content/schema.js` that keeps today's look, and switch it on for the cleaned section in the patch. You may add a `toggle` field for it in schema.js so it shows in the editor form. If the type is used only by the chosen section(s), change the default directly.
4. **Keep the editor working.** Every text stays in `<T f="…" />`, photos in their image components, and selectable blocks stay wrapped in `<Movable f=… kind=…>` with the same keys, so the couple can keep editing and dragging later. Theme tokens only, never hex colors.
5. **Write the content patch** to `design-patch.json` in the repository root: a JSON list of changes, one object per change:

   ```json
   [
     { "section": "travel-1", "op": "remove", "path": "styles.title" },
     { "section": "travel-1", "op": "remove", "path": "styles.image.mx" },
     { "section": "travel-1", "op": "set", "path": "styles.items_0__card", "value": { "radius": 16 } },
     { "section": "travel-1", "op": "remove", "path": "layout" },
     { "section": "travel-1", "op": "remove", "path": "phoneOrder" },
     { "section": "travel-1", "op": "set", "path": "arrangement", "value": "photo-left" }
   ]
   ```

   - `section` is the section's id. Paths are relative to the section: `styles.<key>`, `styles.<key>.<prop>`, `layout`, `layout.<prop>`, `phoneOrder`, or one new setting name (value: true/false, a number or a short lowercase name).
   - Remove the overrides your code now handles: offsets `x`/`y`, phone offsets `mx`/`my`, sizes `w`/`h`/`mw`/`mh`, `mAuto`, the phone bookkeeping `si`/`pw`/`ew`/`pl`, `phoneOrder`, and section heights in `layout` that the new spacing replaces. Removing a whole `styles.<key>` is fine when nothing else is in it.
   - **Keep** text formatting the couple chose: `color`, `fill`, `font` (these can't change at all), `size`, `bold`, `italic`, `align`, `radius`, unless the new design truly replaces them.
   - Only the chosen sections. Never text, photos, links, colors, fonts or backgrounds; the patch checker rejects that.
   - The branch preview shows the couple's draft with your patch applied on top of your new code, so check that the two together give the intended result on desktop and on a phone.

If the sections already match a clean layout and nothing needs to change, make no changes and say so.

### Final message

1–3 short sentences for the couple about what you tidied, e.g. "Rebuilt the travel section as two even columns with the photo on the left, and replaced the hand-placed spacing with a consistent rhythm that also stacks neatly on phones." No file names or code.
