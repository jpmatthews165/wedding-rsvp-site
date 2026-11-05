import { useEffect, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { ArrowUp, Check, Loader2, Sparkles, Undo2 } from 'lucide-react';
import { db } from '../../firebase.js';
import { REQUESTS_COLLECTION } from '../../content/useSiteContent.js';
import { applyOperations } from '../../content/paths.js';

const SUGGESTIONS = [
  'Add a schedule section with our sangeet, mehndi, ceremony and reception',
  'Make the FAQ sound warmer and add a question about the hashtag',
  'Change the hotel to the Hampton Inn in Mount Laurel',
  'Try a sage green color palette with a script font for our names',
  'Hide the countdown and move the registry above travel',
];

// Chat with Claude about the website. Each reply can include edits, which are
// applied to the draft immediately (and can be undone like any other change).
export default function AssistantPanel({ content, getContent, selected, applyChange, undo, getToken, userEmail, onFocusPath }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState([]);
  const listRef = useRef(null);

  useEffect(() => onSnapshot(
    query(collection(db, REQUESTS_COLLECTION), orderBy('createdAt', 'desc')),
    (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => {}
  ), []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text) => {
    const prompt = (text ?? input).trim();
    if (!prompt || busy) return;
    setInput('');
    const history = [...messages, { role: 'user', text: prompt }];
    setMessages(history);
    setBusy(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.text })),
          content,
          selected,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `The assistant isn't available right now (error ${res.status}).`);

      let applied = 0;
      let applyError = '';
      if (data.operations?.length) {
        try {
          // Apply to the latest draft, in case it changed while Claude was thinking.
          const next = applyOperations(getContent(), data.operations);
          applyChange(next, 'AI edit');
          applied = data.operations.length;
          const firstSection = data.operations.map((o) => o.path.match(/^sections\.(\d+)/)?.[0]).find(Boolean);
          if (firstSection) onFocusPath(firstSection);
        } catch (err) {
          applyError = `I couldn't apply that change (${err.message}). Try rephrasing?`;
        }
      }
      if (data.unsupported_request) {
        await addDoc(collection(db, REQUESTS_COLLECTION), {
          text: data.unsupported_request, from: userEmail || '', createdAt: serverTimestamp(),
        }).catch(() => {});
      }
      setMessages([...history, {
        role: 'assistant',
        text: applyError || data.reply || 'Done.',
        applied,
        request: data.unsupported_request || '',
      }]);
    } catch (err) {
      setMessages([...history, { role: 'assistant', text: err.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="px-4 py-3 border-b border-[#333036]/10 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#6c5d84]" />
        <div>
          <p className="text-sm font-semibold text-[#333036]">Ask Claude to edit</p>
          <p className="text-[11px] text-[#333036]/60">Describe a change. It shows up in the preview right away.</p>
        </div>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-[#333036]/60">Try something like:</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full text-left text-sm rounded-lg border border-[#6c5d84]/25 bg-[#6c5d84]/5 px-3 py-2 text-[#333036] hover:bg-[#6c5d84]/10">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
              m.role === 'user' ? 'bg-[#6c5d84] text-white rounded-br-sm'
                : m.error ? 'bg-[#d4a5a5]/25 text-[#7a4d55] rounded-bl-sm'
                  : 'bg-[#f1ece4] text-[#333036] rounded-bl-sm'}`}>
              {m.text}
              {m.applied > 0 && (
                <div className="mt-2 pt-2 border-t border-[#333036]/10 flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-1 text-[#4f7a5a]"><Check className="w-3.5 h-3.5" /> Applied to your draft</span>
                  {i === messages.length - 1 && (
                    <button onClick={undo} className="flex items-center gap-1 font-semibold text-[#6c5d84] hover:underline"><Undo2 className="w-3.5 h-3.5" /> Undo</button>
                  )}
                </div>
              )}
              {m.request && <p className="mt-2 pt-2 border-t border-[#333036]/10 text-xs text-[#333036]/70">Saved as a request for Josh.</p>}
            </div>
          </div>
        ))}
        {busy && <p className="flex items-center gap-2 text-xs text-[#333036]/60"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Working on it…</p>}
      </div>

      {requests.length > 0 && (
        <details className="border-t border-[#333036]/10 px-4 py-2 text-xs">
          <summary className="cursor-pointer font-semibold text-[#333036]/80">Requests for Josh ({requests.length})</summary>
          <ul className="mt-2 space-y-2 max-h-40 overflow-y-auto">
            {requests.map((r) => (
              <li key={r.id} className="flex gap-2 items-start">
                <span className="flex-1 text-[#333036]">{r.text}<span className="block text-[#333036]/50">{r.from}</span></span>
                <button title="Mark done" onClick={() => deleteDoc(doc(db, REQUESTS_COLLECTION, r.id))} className="text-[#6c5d84] hover:underline shrink-0">Done</button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-[#333036]/10 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-[#333036]/20 bg-white focus-within:border-[#6c5d84] px-3 py-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={selected?.startsWith('sections.') ? 'Ask about the selected section, or anything…' : 'e.g. "Add our story under the details"'}
            className="flex-1 resize-none outline-none text-sm max-h-32 bg-transparent"
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="rounded-full bg-[#6c5d84] text-white p-1.5 disabled:opacity-30">
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
