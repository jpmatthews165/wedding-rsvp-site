// "Clean up" support for the design-change workflow (.github/workflows/design-change.yml).
//
//   node .github/design/pending.mjs prepare   before Claude Code runs
//   node .github/design/pending.mjs finish    after it, before the scope guard
//
// prepare: unpacks the editor's clean-up request (PAYLOAD: gzip + base64 JSON with the
//   draft, the chosen sections and how they measure on desktop and phone) or, for a
//   follow-up, the one stored on the branch, and writes design-input.json (repo root,
//   never committed) for Claude to read.
// finish: checks the content patch Claude wrote to design-patch.json (shape rules in
//   src/content/designPatch.js) and stores it with the request in
//   src/content/designPending.json, so the branch preview shows draft + patch and
//   Approve can apply it. Claude itself may never write designPending.json.
// Env: KIND ('cleanup' or anything else), PAYLOAD, REQUEST_ID, RUNNER_TEMP.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { cleanPatch } from '../../src/content/designPatch.js';
import { layoutBuffer, layoutGrid, phoneBuffer } from '../../src/content/fieldStyle.js';

const PENDING = 'src/content/designPending.json';
const CLAUDE_PATCH = 'design-patch.json';
const CLAUDE_INPUT = 'design-input.json'; // read by Claude, removed again in finish
const { KIND, PAYLOAD = '', REQUEST_ID = '', RUNNER_TEMP = '/tmp' } = process.env;
const step = process.argv[2];

const fail = (msg) => {
  console.log(`::error title=Design change failed::${String(msg).replace(/[\r\n]+/g, ' ')}`);
  process.exit(1);
};
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const stored = () => { try { return readJson(PENDING); } catch { return null; } };

const checkInput = (input) => {
  if (!input || !Array.isArray(input.content?.sections) || !Array.isArray(input.bases) || !input.bases.length) fail('The clean-up request is incomplete. Try Clean up again.');
  for (const b of input.bases) {
    if (!/^sections\.\d+$/.test(b) || !input.content.sections[Number(b.split('.')[1])]) fail('The clean-up request names a section that does not exist. Try Clean up again.');
  }
  return input;
};
const chosenIds = (input) => input.bases.map((b) => input.content.sections[Number(b.split('.')[1])].id);

if (step === 'prepare') {
  if (KIND !== 'cleanup') process.exit(0);
  let input;
  let previousPatch = [];
  if (PAYLOAD) {
    if (!/^[A-Za-z0-9+/=]+$/.test(PAYLOAD)) fail('The clean-up request is not readable. Try Clean up again.');
    try { input = JSON.parse(gunzipSync(Buffer.from(PAYLOAD, 'base64')).toString('utf8')); } catch { fail('The clean-up request is not readable. Try Clean up again.'); }
  } else {
    const prev = stored();
    if (!prev?.input) fail('This clean-up has nothing to continue from. Start a new Clean up in the editor.');
    input = prev.input;
    previousPatch = prev.patch || [];
  }
  checkInput(input);
  writeFileSync(`${RUNNER_TEMP}/cleanup-input.json`, JSON.stringify(input));

  const { content } = input;
  const forClaude = {
    settings: { grid: layoutGrid(content.site), desktopBuffer: layoutBuffer(content.site), phoneBuffer: phoneBuffer(content.site) },
    note: typeof input.note === 'string' ? input.note.slice(0, 1000) : '',
    sections: input.bases.map((base) => {
      const s = content.sections[Number(base.split('.')[1])];
      return { id: s.id, type: s.type, position: base, section: s };
    }),
    otherSectionsOfTheSameTypes: content.sections
      .filter((s) => !chosenIds(input).includes(s.id) && input.bases.some((b) => content.sections[Number(b.split('.')[1])].type === s.type))
      .map((s) => ({ id: s.id, type: s.type, styles: s.styles || {}, layout: s.layout || {} })),
    measurements: { desktop: input.desktop || [], phone: input.phone || [] },
    previousPatch,
  };
  writeFileSync(CLAUDE_INPUT, JSON.stringify(forClaude, null, 1));
  console.log(`Clean-up input: ${forClaude.sections.length} section(s), previous patch ${previousPatch.length} change(s).`);
  process.exit(0);
}

if (step === 'finish') {
  if (existsSync(CLAUDE_INPUT)) rmSync(CLAUDE_INPUT);
  // Claude may not write the pipeline's own file.
  const touched = execFileSync('git', ['status', '--porcelain', '--', PENDING], { encoding: 'utf8' }).trim();
  if (touched) fail('The change tried to edit pipeline data it may not touch.');

  if (KIND !== 'cleanup') {
    if (existsSync(CLAUDE_PATCH)) rmSync(CLAUDE_PATCH);
    process.exit(0);
  }
  const input = checkInput(readJson(`${RUNNER_TEMP}/cleanup-input.json`));
  let patch = stored()?.patch || [];
  if (existsSync(CLAUDE_PATCH)) {
    let raw;
    try { raw = readJson(CLAUDE_PATCH); } catch { fail('The clean-up patch was not valid JSON.'); }
    rmSync(CLAUDE_PATCH);
    try { patch = cleanPatch(Array.isArray(raw) ? raw : raw?.patch); } catch (err) { fail(`The clean-up patch was rejected: ${err.message}.`); }
  }
  const ids = new Set(chosenIds(input));
  const outside = patch.find((o) => !ids.has(o.section));
  if (outside) fail(`The clean-up patch changes a section that wasn't chosen (${outside.section}).`);
  writeFileSync(PENDING, `${JSON.stringify({ id: REQUEST_ID, input, patch })}\n`);
  console.log(`Clean-up patch: ${patch.length} change(s).`);
  process.exit(0);
}

fail(`Unknown step "${step}".`);
