import { useEffect, useMemo, useState } from 'react';
import Site from './Site.jsx';

// Rendered at /preview-frame inside the editor's iframe. It has no data access of its
// own: the editor sends it the draft content, and it sends edits/clicks back.
// An iframe gives a true phone/desktop viewport for parallax, sticky header, etc.
export default function PreviewFrame() {
  const [content, setContent] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedEl, setSelectedEl] = useState(null); // element picked for format bar / dragging
  const [grid, setGrid] = useState({ step: 8, show: false });

  useEffect(() => {
    const send = (msg) => window.parent.postMessage({ source: 'wedding-preview', ...msg }, window.location.origin);
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.data?.source !== 'wedding-editor') return;
      if (e.data.type === 'content') setContent(e.data.content);
      if (e.data.type === 'selected') setSelected(e.data.selected);
      if (e.data.type === 'selectedEl') setSelectedEl(e.data.path);
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
      selectedEl,
      grid,
      onSelectEl: (path, kind) => { setSelectedEl(path); send({ type: 'selectEl', path, kind }); },
      onPatch: (path, value) => send({ type: 'edit', path, value }),
    };
  }, [selected, selectedEl, grid]);

  if (!content) return <div className="min-h-screen bg-paper" />;
  return <Site content={content} edit={edit} />;
}
