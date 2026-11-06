// POST /api/cleanup — "Clean up" in the website editor.
//
// Body: { content: <site draft>, bases: ['sections.1', …], desktop: [...], phone: [...], note }
//   desktop / phone: the chosen sections as measured in hidden 1280 px / 390 px
//   previews (src/site/measure.js): each item's real box relative to its section.
// Auth: Authorization: Bearer <Firebase ID token of an admin>
// Returns: { summary, changes: [string], operations: [{ op, path, value_json, to_index }] }
//
// Claude looks at both layouts and proposes spacing/position/size/height changes only
// (styles and layout of the chosen sections); text, colors, fonts, photos and
// backgrounds are left alone. The editor applies them to the draft as one Undo step.
import Anthropic from '@anthropic-ai/sdk';
import { verifyAdminToken, bearerToken } from './_admin.js';
import { readJsonBody } from './_lib.js';
import { SECTION_TYPES } from '../src/content/schema.js';
import { applyOperations, getAt } from '../src/content/paths.js';
import { layoutBuffer, layoutGrid, phoneBuffer } from '../src/content/fieldStyle.js';
import { STYLE_TEXT, validate } from './assistant.js';

export const config = { maxDuration: 180 };

const MODEL = 'claude-opus-5-5';
const client = new Anthropic();

const SYSTEM = `You are a senior web designer tidying up Josh & Sneha's wedding website after they arranged things by hand in a visual editor. You receive the chosen sections' saved styles plus how they actually render on desktop (1280 px wide) and on a phone (390 px wide), and you return small, precise style/layout edits with the clean_up tool.

How positions and sizes work
${STYLE_TEXT}

More about the phone layout
- Phones (screens up to 600 px) stack the design into one column. Unless an item was hand-tuned in the phone preview (mAuto: false), its phone position is worked out automatically: sections are re-flowed in the desktop reading order (left-top to bottom-right becomes top to bottom), items moved sideways on desktop keep the same relative placement inside the phone's edge buffer, and desktop sizes are scaled down. After your edits the editor recomputes that automatic part (reading order, placement "pl", mw/mh for automatic items) from the new desktop layout, so you don't need to set si, pw, ew, pl or phoneOrder.
- mx, my, mw, mh are phone-only overrides. Hand-tuned items (mAuto: false) keep them. To hand an item back to the automatic phone layout, remove mx, my, mw, mh and mAuto from its style.
- Section heights: sections.N.layout = { h, pb } (desktop minimum height and bottom padding in px), { mh, mpb } (phone, hand-tuned) and d (desktop change vs the design's height; phones without mh get half of it automatically). Remove layout (or keys of it) to go back to the design's height.

Measurements you get (per section and device)
- width/height of the section, its paddingTop/paddingBottom, the edge buffer (nothing may go closer to the section's left/right edge than this), and items: { key, kind, x, y, w, h, in?, text? }.
- x, y = the item's top-left corner relative to the section's top-left, INCLUDING its current offsets (and the phone re-flow). Changing style x by +d moves it by d px on desktop; mx/my do the same on phones.
- "in" = the item sits inside another selectable item (a button in a card); its offsets move it relative to that box.
- The style key of an item is its key with dots replaced by "_" (e.g. key "items.0._card" → styles key "items_0__card").

What a good clean-up does
1. Unify desktop and phone: both should tell the same story in the same order, with the same emphasis. On the phone: no overlaps, nothing crossing the buffer or the section's edges, nothing squeezed or oddly offset. Phone overrides that fight the desktop layout (or only exist because of an old drag) should be removed so the automatic layout takes over; keep phone tweaks that clearly help.
2. Clean spacing: a consistent vertical rhythm using multiples of the grid (the grid size is given). Even gaps between related items, larger gaps between groups. Items that are almost aligned (within ~16 px) should line up exactly — same left edge, same centre, or same top. Snap offsets to the grid. Remove tiny meaningless offsets (smaller than half a grid step) by deleting x/y.
3. Modern, dynamic design: clear hierarchy, generous but not empty whitespace, balanced columns, consistent sizes for repeated things (buttons, cards, photos in a row: same width/height/radius), text widths that read comfortably (roughly 45–75 characters per line for paragraphs), nothing awkwardly hugging an edge. Prefer restoring the design's own clean defaults (removing overrides) to inventing new numbers: fewer overrides is better.
4. Section heights: remove leftover empty space or add breathing room where content feels cramped; keep full-screen sections (cover, RSVP) full-screen.

Rules
- Only touch the sections you were given, and only their "styles" and "layout". Never change text, colors (color, fill), fonts, photos, photo positions, backgrounds or section order.
- Respect the person's intent: if they moved a photo to the left of the text or enlarged something, keep that arrangement and just make it tidy and consistent.
- Be precise and conservative: small, purposeful changes. If a section already looks clean, leave it alone.
- Operations: "set" (value_json = JSON) or "remove" on paths like sections.N.styles.<key>, sections.N.styles.<key>.<prop>, sections.N.layout, sections.N.layout.<prop>. The parent must exist before setting a property (set the whole style object if the key doesn't exist yet). For unused fields use value_json "" and to_index -1.
- summary: one or two friendly sentences for Sneha and Josh about what you tidied. changes: a short plain-language list (max 8), one line each, e.g. "Travel: lined up the two columns and evened the gaps". No paths or JSON in either.`;

const TOOL = {
  name: 'clean_up',
  description: 'Return the clean-up edits for the chosen sections. Call exactly once.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'changes', 'operations'],
    properties: {
      summary: { type: 'string' },
      changes: { type: 'array', items: { type: 'string' } },
      operations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['op', 'path', 'value_json', 'to_index'],
          properties: {
            op: { type: 'string', enum: ['set', 'remove'] },
            path: { type: 'string' },
            value_json: { type: 'string' },
            to_index: { type: 'integer' },
          },
        },
      },
    },
  },
};

const PROTECTED_STYLE = ['color', 'fill', 'font'];

// Operations must stay inside the chosen sections' styles/layout and leave
// colors and fonts alone; the result must still be a valid site.
export const check = (content, bases, operations) => {
  const allowed = new Set(bases);
  for (const op of operations) {
    const m = /^(sections\.\d+)\.(styles|layout)(\.[^.]+){0,2}$/.exec(op.path || '');
    if (!m || !allowed.has(m[1])) throw new Error(`"${op.path}" is outside what clean-up may change (only styles and layout of the chosen sections)`);
    if (op.op === 'remove' && /^(sections\.\d+)\.styles$/.test(op.path)) throw new Error('remove single style keys, not the whole styles object');
  }
  validate(content, operations);
  const next = applyOperations(content, operations);
  for (const base of bases) {
    const before = getAt(content, `${base}.styles`) || {};
    const after = getAt(next, `${base}.styles`) || {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      for (const p of PROTECTED_STYLE) {
        if ((before[key]?.[p] ?? null) !== (after[key]?.[p] ?? null)) throw new Error(`styles.${key}.${p} changed; leave colors and fonts as they are`);
      }
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');
  try {
    await verifyAdminToken(bearerToken(req));
  } catch {
    return res.status(401).json({ error: 'Please sign in again.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Clean up is not set up yet (missing ANTHROPIC_API_KEY in Vercel).' });
  }

  const { content, bases, desktop, phone, note } = readJsonBody(req);
  const okBases = Array.isArray(bases) && bases.length && bases.length <= 40
    && bases.every((b) => /^sections\.\d+$/.test(b) && getAt(content, b));
  if (!content?.sections || !okBases || !Array.isArray(desktop) || !Array.isArray(phone)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  const measurements = JSON.stringify({ desktop, phone });
  if (measurements.length > 400000) return res.status(400).json({ error: 'Too much to clean up at once. Pick fewer sections.' });

  const sections = bases.map((b) => {
    const s = getAt(content, b);
    return {
      path: b, id: s.id, type: s.type, label: SECTION_TYPES[s.type]?.label, visible: s.visible !== false,
      styles: s.styles || {}, layout: s.layout || {}, phoneOrder: s.phoneOrder || [],
    };
  });
  const settings = {
    grid: layoutGrid(content.site),
    desktopBuffer: layoutBuffer(content.site),
    phoneBuffer: phoneBuffer(content.site),
  };
  const userNote = typeof note === 'string' && note.trim() ? `\n\nTheir note: ${note.trim().slice(0, 1000)}` : '';
  const messages = [{
    role: 'user',
    content: `<settings>${JSON.stringify(settings)}</settings>\n<sections>${JSON.stringify(sections)}</sections>\n<measurements>${measurements}</measurements>\n\nClean up ${bases.length === content.sections.length ? 'the whole site' : `these sections (${sections.map((s) => s.label).join(', ')})`}.${userNote}`,
  }];

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      // Streamed: the SDK refuses long non-streaming requests. Each attempt is capped
      // so two attempts fit in the function's 180 s.
      const response = await client.beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: [TOOL],
        // Not forced: forcing a tool isn't allowed while Claude is thinking.
        tool_choice: { type: 'auto' },
        messages,
      }, { timeout: 80000, maxRetries: 0 }).finalMessage();
      if (response.stop_reason === 'refusal') return res.status(200).json({ summary: "Sorry, I couldn't clean that up.", changes: [], operations: [] });
      const toolUse = response.content.find((b) => b.type === 'tool_use' && b.name === 'clean_up');
      if (!toolUse) {
        if (attempt === 1) return res.status(502).json({ error: 'Claude did not return a clean-up. Please try again.' });
        messages.push(
          { role: 'assistant', content: response.content },
          { role: 'user', content: 'Please return the clean-up by calling the clean_up tool now.' },
        );
        continue;
      }
      const input = toolUse.input || {};
      const operations = Array.isArray(input.operations) ? input.operations : [];
      try {
        if (operations.length) check(content, bases, operations);
        return res.status(200).json({
          summary: input.summary || 'All tidy.',
          changes: Array.isArray(input.changes) ? input.changes.slice(0, 12).map(String) : [],
          operations,
        });
      } catch (err) {
        if (attempt === 1) return res.status(200).json({ summary: `I couldn't finish the clean-up (${err.message}). Please try again.`, changes: [], operations: [], failed: true });
        messages.push(
          { role: 'assistant', content: response.content },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: `Those operations failed: ${err.message}. Fix them and call clean_up again.` }] },
        );
      }
    }
  } catch (err) {
    console.error('cleanup failed', err);
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Claude is busy right now. Try again in a minute.' });
    if (err instanceof Anthropic.APIConnectionTimeoutError) return res.status(504).json({ error: 'Claude took too long. Try cleaning up fewer sections at once.' });
    if (err instanceof Anthropic.AuthenticationError) return res.status(500).json({ error: 'The Anthropic API key in Vercel is invalid.' });
    if (err instanceof Anthropic.APIError) return res.status(502).json({ error: `Claude had a problem (${err.status}: ${String(err.error?.error?.message || err.message || '').slice(0, 200)}). Please try again.` });
    return res.status(500).json({ error: `Something went wrong (${String(err?.message || err).slice(0, 160)}). Please try again.` });
  }
}
