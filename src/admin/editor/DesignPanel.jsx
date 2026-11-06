import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Loader2, RotateCcw, Send, Trash2 } from 'lucide-react';

// "Design changes" tab: ask Claude Code for a visual code change (layout, sizes,
// new section designs…). Each request runs on GitHub, is checked to only touch the
// guest site's visual files, gets a preview link, and goes live only on Approve.
// Server side: api/design.js and .github/workflows/design-change.yml.

const STATE = {
  working: { label: 'Claude is working…', tone: 'text-[#6c5d84] bg-[#efeaf5]' },
  building: { label: 'Building preview…', tone: 'text-[#6c5d84] bg-[#efeaf5]' },
  ready: { label: 'Ready to review', tone: 'text-[#11704f] bg-[#e2f3ec]' },
  failed: { label: 'Couldn’t make this change', tone: 'text-[#a3401f] bg-[#fbe8e1]' },
  published: { label: 'Published', tone: 'text-[#4b4652] bg-[#efeae2]' },
  discarded: { label: 'Discarded', tone: 'text-[#8b8590] bg-[#f4f0e9]' },
};

const EXAMPLES = [
  'Make the names on the cover bigger and add more space above them',
  'Put the wedding details photo on the left and the text on the right',
  'Turn the FAQ into click-to-open questions',
  'Give the registry buttons rounded corners and a soft shadow',
];

const ago = (ms) => {
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function DesignPanel({ getToken }) {
  const [items, setItems] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');       // '' | 'create' | `${action}:${id}`
  const [error, setError] = useState('');
  const [followUp, setFollowUp] = useState({}); // id -> text
  const [confirming, setConfirming] = useState(null);
  const timer = useRef(null);

  const call = useCallback(async (body) => {
    const res = await fetch('/api/design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }, [getToken]);

  const load = useCallback(async () => {
    try {
      const { items: list } = await call({ action: 'list' });
      setItems(list);
      setError('');
      return list;
    } catch (err) {
      setError(err.message);
      setItems((x) => x || []);
      return [];
    }
  }, [call]);

  // Poll every 15 s while something is in progress.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const list = await load();
      if (cancelled) return;
      const active = list.some((i) => ['working', 'building'].includes(i.state));
      timer.current = setTimeout(tick, active ? 15000 : 60000);
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer.current); };
  }, [load]);

  const act = async (key, body, after) => {
    setBusy(key);
    setError('');
    try { await call(body); after?.(); await load(); } catch (err) { setError(err.message); } finally { setBusy(''); }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-[#333036]/10 text-[11px] text-[#333036]/65 leading-relaxed">
        For changes to the <strong>design itself</strong>: layout, sizes, spacing, new section styles. Claude changes the site's code, you check a preview, and it goes live only when you approve. Takes a few minutes. Wording, photos, colors and fonts are faster in <strong>Quick edits</strong>.
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {error && <p className="text-xs text-[#a3401f] bg-[#fbe8e1] rounded-lg p-2.5">{error}</p>}
        {items === null && <p className="flex items-center gap-2 text-xs text-[#333036]/60"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</p>}
        {items?.length === 0 && !error && (
          <div className="space-y-2">
            <p className="text-xs text-[#333036]/60">Ideas:</p>
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => setText(e)} className="block w-full text-left text-sm rounded-lg border border-[#6c5d84]/25 bg-[#6c5d84]/5 px-3 py-2 text-[#333036] hover:bg-[#6c5d84]/10">{e}</button>
            ))}
          </div>
        )}

        {items?.map((it) => {
          const st = STATE[it.state] || STATE.working;
          const active = it.state === 'working' || it.state === 'building';
          const open = !['published', 'discarded'].includes(it.state);
          return (
            <div key={it.id} className="rounded-xl border border-[#333036]/12 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.tone}`}>
                  {active && <Loader2 className="w-3 h-3 animate-spin" />}{st.label}
                </span>
                <span className="text-[11px] text-[#333036]/50">{ago(it.createdAt)}</span>
              </div>
              <p className="text-sm text-[#333036]">{it.text}</p>
              {it.history.map((h, i) => <p key={i} className="text-xs text-[#333036]/70 border-l-2 border-[#6c5d84]/30 pl-2">Then: {h.text}</p>)}
              <p className="text-[11px] text-[#333036]/50">Asked by {it.by}</p>
              {it.summary && it.state !== 'failed' && <p className="text-xs text-[#333036]/80 bg-[#f6f3ee] rounded-lg p-2">Claude: {it.summary}</p>}
              {it.state === 'failed' && it.reason && <p className="text-xs text-[#a3401f]">{it.reason}</p>}

              {it.state === 'ready' && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <a href={it.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#6c5d84]/40 px-3 py-1.5 text-xs font-semibold text-[#6c5d84] hover:bg-[#6c5d84]/5">
                    <ExternalLink className="w-3.5 h-3.5" /> Open preview
                  </a>
                  {confirming === it.id ? (
                    <>
                      <button disabled={!!busy} onClick={() => act(`approve:${it.id}`, { action: 'approve', id: it.id }, () => setConfirming(null))}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#11704f] text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                        {busy === `approve:${it.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Yes, publish to everyone
                      </button>
                      <button onClick={() => setConfirming(null)} className="text-xs text-[#333036]/60 px-2">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirming(it.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#6c5d84] text-white px-3 py-1.5 text-xs font-semibold hover:bg-[#524569]">
                      <Check className="w-3.5 h-3.5" /> Approve & publish
                    </button>
                  )}
                </div>
              )}

              {open && !active && (
                <div className="pt-1 space-y-2">
                  <div className="flex gap-2">
                    <input value={followUp[it.id] || ''} onChange={(e) => setFollowUp({ ...followUp, [it.id]: e.target.value })}
                      placeholder={it.state === 'failed' ? 'Try again with different wording…' : 'Ask for a tweak…'}
                      className="flex-1 min-w-0 h-8 rounded-lg border border-[#333036]/20 px-2.5 text-xs outline-none focus:border-[#6c5d84]" />
                    <button disabled={!!busy || !(followUp[it.id] || '').trim()} title="Send tweak"
                      onClick={() => act(`follow:${it.id}`, { action: 'create', request: followUp[it.id], followUpOf: it.id }, () => setFollowUp({ ...followUp, [it.id]: '' }))}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#333036]/20 px-2.5 text-xs disabled:opacity-40 hover:bg-[#f6f3ee]">
                      {busy === `follow:${it.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Redo
                    </button>
                  </div>
                  <button disabled={!!busy} onClick={() => act(`discard:${it.id}`, { action: 'discard', id: it.id })}
                    className="inline-flex items-center gap-1 text-[11px] text-[#333036]/55 hover:text-[#a3401f]">
                    {busy === `discard:${it.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Discard this change
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) act('create', { action: 'create', request: text }, () => setText('')); }} className="border-t border-[#333036]/10 p-3">
        <div className="rounded-xl border border-[#333036]/20 bg-white focus-within:border-[#6c5d84] px-3 py-2">
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
            placeholder="Describe the design change, e.g. “move the countdown above the details”"
            className="w-full resize-none outline-none text-sm bg-transparent" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#333036]/45">Nothing changes for guests until you approve.</span>
            <button type="submit" disabled={busy === 'create' || !text.trim()} className="inline-flex items-center gap-1.5 rounded-full bg-[#6c5d84] text-white px-3 py-1 text-xs font-semibold disabled:opacity-30">
              {busy === 'create' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function ClaudeTabs({ quick, design }) {
  const [tab, setTab] = useState('quick');
  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="flex border-b border-[#333036]/10 text-sm shrink-0">
        {[['quick', 'Quick edits'], ['design', 'Design changes']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2.5 ${tab === k ? 'text-[#6c5d84] font-semibold border-b-2 border-[#6c5d84]' : 'text-[#333036]/60 hover:text-[#333036]'}`}>{label}</button>
        ))}
      </div>
      <div className={tab === 'quick' ? 'flex-1 min-h-0' : 'hidden'}>{quick}</div>
      <div className={tab === 'design' ? 'flex-1 min-h-0' : 'hidden'}>{tab === 'design' ? design : null}</div>
    </div>
  );
}

