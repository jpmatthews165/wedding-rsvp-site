import { useEffect, useMemo, useState } from 'react';
import Site from './Site.jsx';

// Rendered at /preview-frame inside the editor's iframe. It has no data access of its
// own: the editor sends it the draft content, and it sends edits/clicks back.
// An iframe gives a true phone/desktop viewport for parallax, sticky header, etc.
//
// /preview-frame?measure=desktop|phone is a hidden copy used by "Clean up": it only
// answers { type: 'measure', id, task: 'layout'|'phoneIntent', content, bases }
// with { type: 'measured', id, data } (see src/site/measure.js).
const MEASURE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('measure');
const SOURCE = MEASURE ? 'wedding-measure' : 'wedding-preview';

export default function PreviewFrame() {
  const [content, setContent] = useState(null);
  const [selected, setSelected] = useState(null);
  // Elements picked for the format bar / dragging: [{ path, kind }], last = primary.
  const [selection, setSelection] = useState([]);
  const [grid, setGrid] = useState({ show: false });
  const [alignRequest, setAlignRequest] = useState(null); // { mode, nonce } from the editor
  const [job, setJob] = useState(null); // measure mode: the request being answered

  useEffect(() => {
    const send = (msg) => window.parent.postMessage({ source: SOURCE, ...msg }, window.location.origin);
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.data?.source !== 'wedding-editor') return;
      if (MEASURE) {
        if (e.data.type === 'measure') { setContent(e.data.content); setJob({ ...e.data, content: undefined }); }
        return;
      }
      if (e.data.type === 'content') setContent(e.data.content);
      if (e.data.type === 'selected') setSelected(e.data.selected);
      if (e.data.type === 'selection') setSelection(e.data.items || []);
      if (e.data.type === 'align') setAlignRequest({ mode: e.data.mode, nonce: Date.now() });
      if (e.data.type === 'grid') setGrid(e.data.grid);
      if (e.data.type === 'scrollTo') {
        document.querySelector(`[data-base="${e.data.base}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('message', onMessage);
    send({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Measure mode: answer once the requested content has rendered (and fonts loaded).
  useEffect(() => {
    if (!MEASURE || !job || !content) return;
    let dead = false;
    (async () => {
      const reply = (msg) => window.parent.postMessage({ source: SOURCE, type: 'measured', id: job.id, ...msg }, window.location.origin);
      try {
        await new Promise((r) => setTimeout(r, 300));
        await document.fonts?.ready;
        if (dead) return;
        const { measureLayout, phoneIntent } = await import('./measure.js');
        const bases = (job.bases || []).filter((b) => /^sections\.\d+$/.test(b));
        reply({ data: job.task === 'phoneIntent' ? phoneIntent(document.body, bases, content) : measureLayout(document.body, bases, content) });
      } catch (err) {
        reply({ error: err.message || 'Could not measure the page.' });
      }
    })();
    return () => { dead = true; };
  }, [job, content]);

  const edit = useMemo(() => {
    const send = (msg) => window.parent.postMessage({ source: 'wedding-preview', ...msg }, window.location.origin);
    return {
      selected,
      onEdit: (path, value) => send({ type: 'edit', path, value }),
      onSelect: (base) => { setSelected(base); send({ type: 'select', base }); },
      onPickImage: (path) => send({ type: 'pickImage', path }),
      onAdjustImage: (path) => send({ type: 'adjustImage', path }),
      selection,
      grid,
      alignRequest,
      // additive (Shift+click): toggle in the group; otherwise select just this one.
      onSelectEl: (path, kind, additive) => {
        // For text inside a button/box, tell the editor about the box around it
        // so it can offer "Select the box around this".
        const el = document.querySelector(`[data-el="${CSS.escape(path)}"]`);
        const parentEl = el?.parentElement?.closest('[data-el]');
        const parent = parentEl ? { path: parentEl.getAttribute('data-el'), kind: parentEl.getAttribute('data-el-kind') } : null;
        setSelection((cur) => {
          let next;
          if (additive) {
            // A section background can't be grouped with items.
            const base = kind === 'section' ? [] : cur.filter((x) => x.kind !== 'section');
            next = base.some((x) => x.path === path) ? base.filter((x) => x.path !== path) : [...base, { path, kind, parent }];
          }
          else next = cur.length === 1 && cur[0].path === path ? cur : [{ path, kind, parent }];
          if (next !== cur) send({ type: 'selection', items: next });
          return next;
        });
      },
      onPatch: (path, value) => send({ type: 'edit', path, value }),
      onPatchMany: (changes) => send({ type: 'editMany', changes }),
    };
  }, [selected, selection, grid, alignRequest]);

  if (!content) return <div className="min-h-screen bg-paper" />;
  return <Site content={content} edit={edit} />;
}
