import { useState } from 'react';
import { Check, Loader2, Wand2, X } from 'lucide-react';
import { sectionLabel } from '../../content/schema.js';
import { createMeasurer } from './measurer.js';

// "Clean up": Claude Code looks at how the chosen sections were arranged by hand
// (drags, sizes, phone tweaks), measured on desktop AND phone, and rebuilds them as
// clean responsive code, removing the overrides that are no longer needed. It runs
// as a design change (api/design.js → GitHub workflow): a few minutes, a preview,
// and nothing changes until it's approved in Ask Claude → Design changes.
// Steps here: measure both layouts in hidden previews (measurer.js), then start it.
const STEPS = { measuring: 'Measuring desktop and phone layouts…', starting: 'Sending it to Claude…' };

export default function CleanupDialog({ content, getContent, selected, getToken, onShowDesign, onClose }) {
  const sections = content.sections.map((s, i) => ({ base: `sections.${i}`, label: sectionLabel(s), hidden: s.visible === false }));
  const preselect = typeof selected === 'string' && /^sections\.\d+$/.test(selected) ? selected : null;
  const [scope, setScope] = useState(preselect ? 'some' : 'all');
  const [chosen, setChosen] = useState(() => new Set(preselect ? [preselect] : []));
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('idle'); // idle | measuring | starting | done | error
  const [error, setError] = useState('');
  const busy = STEPS[status];

  const bases = scope === 'all' ? sections.filter((s) => !s.hidden).map((s) => s.base) : sections.filter((s) => chosen.has(s.base)).map((s) => s.base);
  const toggle = (b) => setChosen((cur) => { const n = new Set(cur); if (n.has(b)) n.delete(b); else n.add(b); return n; });

  const run = async () => {
    if (!bases.length || busy) return;
    setError('');
    const m = createMeasurer();
    try {
      setStatus('measuring');
      await m.open();
      const snapshot = getContent();
      const desktop = await m.measure('desktop', snapshot, bases);
      const phone = await m.measure('phone', snapshot, bases);

      setStatus('starting');
      const res = await fetch('/api/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ action: 'create', kind: 'cleanup', cleanup: { content: snapshot, bases, desktop, phone, note } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Clean up isn't available right now (error ${res.status}).`);
      setStatus('done');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    } finally {
      m.close();
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center p-4" onClick={busy ? undefined : onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <div>
            <h3 className="font-semibold text-[#333036] flex items-center gap-2"><Wand2 className="w-4 h-4 text-[#6c5d84]" /> Clean up the layout</h3>
            <p className="text-xs text-[#333036]/65 mt-1">Claude looks at how you arranged things on desktop and phone and rebuilds those sections as clean, responsive design: proper columns, even spacing, things lined up, and a phone layout that follows naturally. Your hand-placed nudges are replaced by the real thing. Text, colors, fonts and photos stay as they are.</p>
          </div>
          <button type="button" onClick={onClose} disabled={!!busy} aria-label="Close" className="p-1 rounded hover:bg-[#333036]/5 disabled:opacity-30"><X className="w-4 h-4" /></button>
        </div>

        {status === 'done' ? (
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm text-[#333036] flex gap-2"><Check className="w-4 h-4 text-[#5b7a5b] shrink-0 mt-0.5" /> Claude is on it. This usually takes 5–10 minutes.</p>
            <p className="text-xs text-[#333036]/65 pl-6">Follow it under <strong>Ask Claude → Design changes</strong>. When it's ready, open the preview to check desktop and phone, then <strong>Approve & publish</strong> (your draft gets the matching tidy-up as one Undo step) or ask for a tweak. Nothing changes until then. Keep editing other things meanwhile; avoid re-arranging the sections being cleaned up.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm hover:bg-[#333036]/5">Close</button>
              <button type="button" onClick={() => { onShowDesign(); onClose(); }} className="rounded-md bg-[#6c5d84] text-white px-4 py-2 text-sm font-semibold hover:bg-[#524569]">Show Design changes</button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            <fieldset className="space-y-2" disabled={!!busy}>
              <legend className="text-xs font-semibold text-[#333036]/70 mb-1">What should Claude clean up?</legend>
              <label className="flex items-center gap-2 text-sm text-[#333036]">
                <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} className="accent-[#6c5d84]" /> The whole site
              </label>
              <label className="flex items-center gap-2 text-sm text-[#333036]">
                <input type="radio" name="scope" checked={scope === 'some'} onChange={() => setScope('some')} className="accent-[#6c5d84]" /> Only some sections
              </label>
              {scope === 'some' && (
                <div className="ml-6 grid gap-1 rounded-md border border-[#333036]/12 p-2 max-h-56 overflow-y-auto">
                  {sections.map((s) => (
                    <label key={s.base} className="flex items-center gap-2 text-sm text-[#333036] rounded px-1.5 py-1 hover:bg-[#333036]/5">
                      <input type="checkbox" checked={chosen.has(s.base)} onChange={() => toggle(s.base)} className="accent-[#6c5d84]" />
                      {s.label}{s.hidden && <span className="text-[11px] text-[#333036]/45">hidden</span>}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <label className="block">
              <span className="text-xs font-semibold text-[#333036]/70">Anything in particular? (optional)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={!!busy} rows={2} maxLength={1000}
                placeholder="e.g. keep the photo on the left, more breathing room around the cards"
                className="mt-1 w-full rounded-md border border-[#333036]/20 px-2.5 py-2 text-sm resize-none" />
            </label>
            {error && <p className="text-sm text-[#7a4d55] bg-[#d4a5a5]/20 rounded-md px-3 py-2">{error}</p>}
            {busy && <p className="text-sm text-[#6c5d84] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {busy}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} disabled={!!busy} className="rounded-md px-3 py-2 text-sm hover:bg-[#333036]/5 disabled:opacity-40">Cancel</button>
              <button type="button" onClick={run} disabled={!!busy || !bases.length}
                className="flex items-center gap-1.5 rounded-md bg-[#6c5d84] text-white px-4 py-2 text-sm font-semibold hover:bg-[#524569] disabled:opacity-40">
                <Wand2 className="w-4 h-4" /> Clean up {scope === 'all' ? 'site' : bases.length === 1 ? '1 section' : `${bases.length} sections`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
