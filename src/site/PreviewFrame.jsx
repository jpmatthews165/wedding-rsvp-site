import { useEffect, useMemo, useState } from 'react';
import Site from './Site.jsx';

// Rendered at /preview-frame inside the editor's iframe. It has no data access of its
// own: the editor sends it the draft content, and it sends edits/clicks back.
// An iframe gives a true phone/desktop viewport for parallax, sticky header, etc.
export default function PreviewFrame() {
  const [content, setContent] = useState(null);
  const [selected, setSelected] = useState(null);
  // Elements picked for the format bar / dragging: [{ path, kind }], last = primary.
  const [selection, setSelection] = useState([]);
  const [grid, setGrid] = useState({ step: 16, show: false });
  const [alignRequest, setAlignRequest] = useState(null); // { mode, nonce } from the editor

  useEffect(() => {
    const send = (msg) => window.parent.postMessage({ source: 'wedding-preview', ...msg }, window.location.origin);
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.data?.source !== 'wedding-editor') return;
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
          if (additive) next = cur.some((x) => x.path === path) ? cur.filter((x) => x.path !== path) : [...cur, { path, kind, parent }];
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
