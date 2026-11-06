// "Design patch": the content side of a code design change, used by "Clean up".
//
// When Claude Code rewrites sections as clean responsive code, the hand-made drag
// offsets, sizes and phone tweaks those sections carried become redundant (or would
// now double up), and the new code may add an opt-in setting for the cleaned
// sections. The patch says exactly that, per section id:
//   [{ section: 'travel-1', op: 'remove', path: 'styles.title' },
//    { section: 'travel-1', op: 'set', path: 'arrangement', value: 'photo-left' }]
//
// It can only touch a section's styles, layout and phoneOrder, or add simple new
// settings (on/off, a number or a short name). Text, photos, links, colors, fonts
// and backgrounds can't change.
//
// Where it's used:
//   .github/design/pending.mjs  checks Claude's patch and stores it, with the draft it
//                               was made from, in src/content/designPending.json on
//                               the design branch (null on main);
//   src/content/useSiteContent.js  the branch's preview shows that draft + patch;
//   api/design.js               on Approve: applies it to the published content and
//                               clears designPending.json before merging;
//   the editor                  applies it to the draft (one Undo step).
import { getAt, removeAt, setAt } from './paths.js';
import { cleanSectionLayout, cleanStyle } from './fieldStyle.js';
import { SECTION_TYPES } from './schema.js';

export const MAX_PATCH = 600;

const SEG = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NAME = /^[a-z0-9-]{1,40}$/;
const ROOTS = ['styles', 'layout', 'phoneOrder'];
// Never settable as "new settings".
const FIXED = new Set(['id', 'type', 'visible', 'bg', 'showInNav', 'navLabel', 'image', 'imagePos', 'items', ...ROOTS]);
const PROTECTED_STYLE = ['color', 'fill', 'font'];

const isSetting = (v) => typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && NAME.test(v));

// Shape check. Returns a clean copy of the operations or throws with a reason
// written for the person (or Claude) who made them.
export function cleanPatch(ops) {
  if (!Array.isArray(ops)) throw new Error('the patch must be a list of changes');
  if (ops.length > MAX_PATCH) throw new Error(`the patch has more than ${MAX_PATCH} changes`);
  return ops.map((o, i) => {
    const at = `change ${i + 1}`;
    if (!o || typeof o !== 'object') throw new Error(`${at} is not an object`);
    const { section, op, path, value } = o;
    if (typeof section !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(section)) throw new Error(`${at}: "section" must be a section id`);
    if (op !== 'set' && op !== 'remove') throw new Error(`${at}: "op" must be "set" or "remove"`);
    const segs = String(path ?? '').split('.');
    if (segs.length > 3 || !segs.every((s) => SEG.test(s))) throw new Error(`${at}: "${path}" is not a valid path (up to 3 names separated by dots)`);
    const [root] = segs;
    if (root === 'styles') {
      if (segs.length < 2) throw new Error(`${at}: change single style keys (styles.<key>), not all styles at once`);
      if (segs.length === 3 && PROTECTED_STYLE.includes(segs[2])) throw new Error(`${at}: colors and fonts (${segs[2]}) can't change`);
    } else if (root === 'phoneOrder') {
      if (segs.length !== 1) throw new Error(`${at}: phoneOrder is set or removed as a whole`);
      if (op === 'set' && !(Array.isArray(value) && value.length <= 200 && value.every((k) => typeof k === 'string' && k.length <= 100))) throw new Error(`${at}: phoneOrder must be a list of item keys`);
    } else if (root !== 'layout') {
      if (FIXED.has(root) || segs.length !== 1) throw new Error(`${at}: "${path}" can't be changed (only styles, layout, phoneOrder or a new section setting)`);
      if (op === 'set' && !isSetting(value)) throw new Error(`${at}: new settings like "${root}" must be true/false, a number or a short lowercase name`);
    }
    if (op === 'set') {
      if (value === undefined) throw new Error(`${at}: "set" needs a value`);
      if (JSON.stringify(value).length > 4000) throw new Error(`${at}: value is too big`);
      return { section, op, path: segs.join('.'), value };
    }
    return { section, op, path: segs.join('.') };
  });
}

// Fields that hold the couple's own content (text, photos, links, lists).
const contentFields = (type) => new Set((SECTION_TYPES[type]?.fields || []).filter((f) => f.type !== 'toggle').map((f) => f.key));

// Applies a patch to site content. Operations for sections that no longer exist, or
// that would change content, are skipped. Returns { content, applied, skipped }.
export function applyPatch(content, ops) {
  let clean;
  try { clean = cleanPatch(ops || []); } catch { return { content, applied: 0, skipped: (ops || []).length }; }
  if (!content || !Array.isArray(content.sections)) return { content, applied: 0, skipped: clean.length };
  const sections = [...content.sections];
  let applied = 0, skipped = 0;
  for (const o of clean) {
    const i = sections.findIndex((s) => s?.id === o.section);
    if (i < 0) { skipped++; continue; }
    const before = sections[i];
    const segs = o.path.split('.');
    const root = segs[0];
    if (!ROOTS.includes(root)) {
      const cur = before[root];
      if (contentFields(before.type).has(root) || (cur !== undefined && cur !== null && !isSetting(cur))) { skipped++; continue; }
    }
    let s;
    if (o.op === 'set') {
      const parent = segs.slice(0, -1).join('.');
      if (parent && segs.length === 3 && getAt(before, parent) == null) s = setAt(before, parent, { [segs[2]]: o.value });
      else s = setAt(before, o.path, o.value);
    } else {
      s = getAt(before, o.path) === undefined ? before : removeAt(before, o.path);
    }
    // Keep everything valid: known style keys only, colors and fonts as they were.
    if (root === 'styles') {
      const key = segs[1];
      const old = before.styles?.[key] || {};
      const next = cleanStyle(s.styles?.[key]);
      for (const p of PROTECTED_STYLE) { if (old[p] !== undefined) next[p] = old[p]; else delete next[p]; }
      const styles = { ...(s.styles || {}) };
      if (Object.keys(next).length) styles[key] = next; else delete styles[key];
      s = { ...s, styles };
    } else if (root === 'layout') {
      const layout = cleanSectionLayout(s.layout);
      s = { ...s };
      if (Object.keys(layout).length) s.layout = layout; else delete s.layout;
    }
    sections[i] = s;
    applied++;
  }
  return { content: applied ? { ...content, sections } : content, applied, skipped };
}
