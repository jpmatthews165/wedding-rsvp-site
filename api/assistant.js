// POST /api/assistant — the "Ask Claude to edit" companion in the website editor.
//
// Body: { messages: [{ role: 'user'|'assistant', content: string }], content: <site draft>, selected }
// Auth: Authorization: Bearer <Firebase ID token of an admin>
// Returns: { reply, operations: [{ op, path, value_json, to_index }], unsupported_request }
//
// Claude never writes to the database itself: it proposes edit operations, which the
// editor applies to the draft (visible in the preview, undoable, published only on demand).
//
// Required Vercel environment variable: ANTHROPIC_API_KEY
import Anthropic from '@anthropic-ai/sdk';
import { verifyAdminToken, bearerToken } from './_admin.js';
import { readJsonBody } from './_lib.js';
import { SECTION_TYPES, SITE_FIELDS } from '../src/content/schema.js';
import { applyOperations } from '../src/content/paths.js';

export const config = { maxDuration: 60 };

const MODEL = 'claude-opus-5-5';
const client = new Anthropic();

// ---- describe the editable content model for the system prompt (stable → cacheable)
const describeFields = (fields, indent = '    ') => fields.map((f) => {
  if (f.type === 'list') {
    const item = f.itemFields.map((x) => `${x.key} (${x.type})`).join(', ');
    return `${indent}- ${f.key}: list of { ${item} } — ${f.label}`;
  }
  return `${indent}- ${f.key} (${f.type}) — ${f.label}${f.help ? `. ${f.help}` : ''}`;
}).join('\n');

const SCHEMA_TEXT = [
  'site (object):',
  describeFields(SITE_FIELDS),
  '',
  'sections (array, rendered top to bottom). Every section has: id (unique slug), type, visible (bool), showInNav (bool), navLabel (text).',
  'Section types:',
  ...Object.entries(SECTION_TYPES).map(([type, def]) =>
    `  type "${type}" — ${def.label}: ${def.description}${def.unique ? ' (only one allowed)' : ''}\n${describeFields(def.fields.filter((f) => !['navLabel', 'showInNav'].includes(f.key)))}`),
].join('\n');

const SYSTEM = `You are the friendly website assistant for Josh & Sneha's wedding website. Sneha or Josh describes changes in plain language; you make them by calling the edit_site tool.

How the site works
- The whole site is one JSON document (shown in each request inside <current_site_content>). Edit it only through operations.
- Edits go into a draft. They appear in the editor's live preview immediately and only go live when they press Publish. Mention this when it helps.
- Guest lists and RSVPs are NOT part of this content and you cannot see or change them. For guest changes, point them to the Guest List Editor in the admin dashboard.

Content model
${SCHEMA_TEXT}

Text fields are plain text (no HTML or Markdown). Use "\\n" for a line break; a blank line ("\\n\\n") separates paragraphs in text blocks.

Operations (applied in order; paths are dotted, array indexes are numbers, e.g. "sections.4.items.0.title")
- set: replace the value at path with JSON.parse(value_json). The parent must already exist. Use this for single fields or to replace a whole section/list.
- insert: path is an ARRAY; insert JSON.parse(value_json) at to_index (-1 = append).
- remove: delete the item/field at path. When removing several items from the same list, remove the highest index first.
- move: path is an array item; move it to to_index within the same array.
For unused fields use value_json "" and to_index -1.
When you add a new section, include id, type, visible: true, showInNav, navLabel, and every field for its type. Keep ids unique.
Remember that indexes shift after insert/remove/move within the same request.

Rules
- Always call edit_site exactly once per request, even if you only answer a question (then operations is empty).
- Keep their voice: warm, elegant, concise. Match the style of the existing text.
- Never invent facts (dates, times, addresses, prices, links, codes, names). If something is missing, ask in reply and make no change, or leave that field empty.
- Images: you can only use image URLs that already exist in the content, or "" to remove one. To add a new photo, tell them to click "Change photo" on the section (upload from their device).
- Only change what was asked. Don't rewrite unrelated text.
- If the request needs something the content model can't express (new colors, fonts, layout or animation changes, new kinds of features), do what you can, explain briefly in reply, and put a clear one-sentence description for Josh in unsupported_request. Otherwise unsupported_request is "".
- reply: 1–3 short sentences in plain, friendly language saying what you changed (or asking a question). No JSON, no paths.
- If the user has a section selected, "this section" means that one.`;

const EDIT_TOOL = {
  name: 'edit_site',
  description: 'Apply edits to the wedding website draft and reply to the user. Call exactly once per request.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['reply', 'operations', 'unsupported_request'],
    properties: {
      reply: { type: 'string', description: 'Short, friendly message to the user.' },
      operations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['op', 'path', 'value_json', 'to_index'],
          properties: {
            op: { type: 'string', enum: ['set', 'insert', 'remove', 'move'] },
            path: { type: 'string' },
            value_json: { type: 'string', description: 'JSON-encoded value for set/insert, "" otherwise.' },
            to_index: { type: 'integer', description: 'Target index for insert/move, -1 otherwise.' },
          },
        },
      },
      unsupported_request: { type: 'string', description: 'Description for Josh of anything that could not be done, or "".' },
    },
  },
};

// Applies the operations to a copy and checks the result is still a valid site.
const validate = (content, operations) => {
  const next = applyOperations(content, operations);
  if (!next?.site || !Array.isArray(next.sections)) throw new Error('site and sections must remain');
  const ids = new Set();
  for (const s of next.sections) {
    if (!s || !SECTION_TYPES[s.type]) throw new Error(`unknown section type "${s?.type}"`);
    if (!s.id || ids.has(s.id)) throw new Error(`section id "${s.id}" is missing or duplicated`);
    ids.add(s.id);
  }
  for (const [type, def] of Object.entries(SECTION_TYPES)) {
    if (def.unique && next.sections.filter((s) => s.type === type).length > 1) throw new Error(`only one "${type}" section is allowed`);
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
    return res.status(500).json({ error: 'The assistant is not set up yet (missing ANTHROPIC_API_KEY in Vercel).' });
  }

  const { messages, content, selected } = readJsonBody(req);
  if (!Array.isArray(messages) || !messages.length || !content?.sections) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  // Prior turns are plain text; the newest user turn also carries the current draft.
  const history = messages.slice(-20).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 4000),
  }));
  const last = history.pop();
  const selectedNote = typeof selected === 'string' && selected.startsWith('sections.')
    ? `\nThe user currently has ${selected} selected (id "${content.sections[Number(selected.split('.')[1])]?.id}").`
    : '';
  const apiMessages = [
    ...history,
    {
      role: 'user',
      content: `<current_site_content>\n${JSON.stringify(content)}\n</current_site_content>${selectedNote}\n\n${last.content}`,
    },
  ];

  try {
    // Up to two attempts: if the proposed edits don't apply cleanly, tell Claude why.
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: [EDIT_TOOL],
        tool_choice: { type: 'auto' },
        messages: apiMessages,
      });

      if (response.stop_reason === 'refusal') {
        return res.status(200).json({ reply: "Sorry, I can't help with that one.", operations: [], unsupported_request: '' });
      }

      const toolUse = response.content.find((b) => b.type === 'tool_use' && b.name === 'edit_site');
      if (!toolUse) {
        const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        return res.status(200).json({ reply: text || 'Sorry, I didn\'t catch that. Could you rephrase?', operations: [], unsupported_request: '' });
      }

      const input = toolUse.input || {};
      const operations = Array.isArray(input.operations) ? input.operations : [];
      try {
        if (operations.length) validate(content, operations);
        return res.status(200).json({
          reply: input.reply || 'Done.',
          operations,
          unsupported_request: input.unsupported_request || '',
        });
      } catch (err) {
        if (attempt === 1) {
          return res.status(200).json({ reply: `I tried, but my edit didn't fit the site (${err.message}). Could you rephrase?`, operations: [], unsupported_request: '' });
        }
        apiMessages.push(
          { role: 'assistant', content: response.content },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, is_error: true, content: `Those operations failed: ${err.message}. Fix them and call edit_site again.` }] },
        );
      }
    }
  } catch (err) {
    console.error('assistant failed', err);
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Claude is busy right now. Try again in a minute.' });
    if (err instanceof Anthropic.AuthenticationError) return res.status(500).json({ error: 'The Anthropic API key in Vercel is invalid.' });
    if (err instanceof Anthropic.APIError) return res.status(502).json({ error: `Claude had a problem (${err.status}). Please try again.` });
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
