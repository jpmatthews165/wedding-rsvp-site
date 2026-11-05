import { useEffect, useMemo, useState } from 'react';
import Site from './Site.jsx';

// Rendered at /preview-frame inside the editor's iframe. It has no data access of its
// own: the editor sends it the draft content, and it sends edits/clicks back.
// An iframe gives a true phone/desktop viewport for parallax, sticky header, etc.
export default function PreviewFrame() {
  const [content, setContent] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const send = (msg) => window.parent.postMessage({ source: 'wedding-preview', ...msg }, window.location.origin);
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.data?.source !== 'wedding-editor') return;
      if (e.data.type === 'content') setContent(e.data.content);
      if (e.data.type === 'selected') setSelected(e.data.selected);
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
    };
  }, [selected]);

  if (!content) return <div className="min-h-screen bg-[#e6dbcc]" />;
  return <Site content={content} edit={edit} />;
}
