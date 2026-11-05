import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, writeBatch,
} from 'firebase/firestore';
import {
  ArrowLeft, ChevronDown, ChevronUp, Copy, Eye, EyeOff, ExternalLink, History, Loader2, Lock, Monitor,
  MessageSquare, PanelLeft, Plus, Redo2, Settings2, Smartphone, Tablet, Trash2, Undo2, Upload,
} from 'lucide-react';
import { db } from '../../firebase.js';
import useAdminAuth from '../useAdminAuth.js';
import { DEFAULT_CONTENT } from '../../content/defaultContent.js';
import { SECTION_TYPES, SITE_FIELDS, makeSection, newSectionId, normalizeContent, sectionLabel } from '../../content/schema.js';
import { DRAFT_DOC, HISTORY_COLLECTION, PUBLISHED_DOC } from '../../content/useSiteContent.js';
import { getAt, setAt, toPlain } from '../../content/paths.js';
import { Fields } from './FieldForm.jsx';
import ImagePicker from './ImagePicker.jsx';
import ImageAdjust from './ImageAdjust.jsx';
import ThemePanel from './ThemePanel.jsx';
import AssistantPanel from './AssistantPanel.jsx';

const DEVICES = {
  desktop: { width: '100%', icon: Monitor, label: 'Desktop' },
  tablet: { width: '820px', icon: Tablet, label: 'Tablet' },
  phone: { width: '390px', icon: Smartphone, label: 'Phone' },
};
const HISTORY_LIMIT = 100;
// Compares content regardless of key order (Firestore returns object keys sorted).
const canonical = (v) => {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, canonical(v[k])]));
  return v;
};
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

// ------------------------------------------------------------------ undo/redo state
function useUndoable() {
  const [state, setState] = useState({ past: [], present: null, future: [], lastKey: null, lastAt: 0 });
  const presentRef = useRef(null);
  useEffect(() => { presentRef.current = state.present; }, [state.present]);

  // `next` may be a value or a function of the current content.
  // `key` lets rapid typing in one field collapse into a single undo step.
  const change = useCallback((nextOrFn, key = null) => {
    setState((s) => {
      const next = typeof nextOrFn === 'function' ? nextOrFn(s.present) : nextOrFn;
      if (s.present === null || same(next, s.present)) return { ...s, present: next };
      const now = Date.now();
      const coalesce = key && key === s.lastKey && now - s.lastAt < 1500;
      return {
        past: coalesce ? s.past : [...s.past, s.present].slice(-HISTORY_LIMIT),
        present: next, future: [], lastKey: key, lastAt: now,
      };
    });
  }, []);
  const reset = useCallback((value) => setState({ past: [], present: value, future: [], lastKey: null, lastAt: 0 }), []);
  const undo = useCallback(() => setState((s) => (s.past.length ? {
    past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future], lastKey: null, lastAt: 0,
  } : s)), []);
  const redo = useCallback(() => setState((s) => (s.future.length ? {
    past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1), lastKey: null, lastAt: 0,
  } : s)), []);
  const getPresent = useCallback(() => presentRef.current, []);
  return { ...state, change, reset, undo, redo, getPresent };
}

// ------------------------------------------------------------------ page
export default function EditorPage() {
  const authState = useAdminAuth();
  const { user, ready, isAdmin, error: authError, signIn } = authState;

  if (!ready) return <FullScreen><Loader2 className="w-6 h-6 animate-spin text-[#6c5d84]" /></FullScreen>;
  if (!isAdmin) {
    return (
      <FullScreen>
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-sm w-full text-center">
          <Lock className="w-6 h-6 text-[#6c5d84] mx-auto mb-3" />
          <h1 className="font-semibold text-lg text-[#333036]">Website Editor</h1>
          <p className="text-sm text-[#333036]/70 mt-1 mb-6">Sign in with an approved Google account.</p>
          {authError && <p className="text-xs text-[#7a4d55] bg-[#d4a5a5]/25 rounded-md p-2 mb-4">{authError}</p>}
          <button onClick={signIn} className="w-full rounded-md bg-[#6c5d84] text-white py-2.5 text-sm font-semibold hover:bg-[#524569]">Sign in with Google</button>
          <a href="/" className="block text-xs text-[#333036]/60 mt-4 hover:underline">Back to the site</a>
        </div>
      </FullScreen>
    );
  }
  return <Editor auth={authState} email={user.email} />;
}

const FullScreen = ({ children }) => (
  <div className="min-h-screen bg-[#ebe4d8] flex items-center justify-center p-4 font-sans">{children}</div>
);

export function Editor({ auth, email, dryRun = false }) {
  const doc_ = useUndoable();
  const content = doc_.present;
  const [published, setPublished] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [remote, setRemote] = useState(null);         // someone else saved the draft: { by, content }
  const [saveState, setSaveState] = useState('saved'); // saved | saving | error
  const [selected, setSelected] = useState(null);       // null | 'site' | 'sections.N'
  const [device, setDevice] = useState('desktop');
  const [picker, setPicker] = useState(null);           // path of image field being changed
  const [adjusting, setAdjusting] = useState(null);     // path of image field being repositioned
  const [siteTab, setSiteTab] = useState('details');    // site settings: details | theme
  const [showHistory, setShowHistory] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [mobilePane, setMobilePane] = useState('preview'); // edit | preview | ai (small screens)
  const iframeRef = useRef(null);
  const frameReady = useRef(false);
  const lastSaved = useRef(null);

  // ---- load: draft if there is one, else published, else defaults
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [draftSnap, pubSnap] = await Promise.all([getDoc(doc(db, ...DRAFT_DOC)), getDoc(doc(db, ...PUBLISHED_DOC))]);
        if (cancelled) return;
        const pub = normalizeContent(pubSnap.exists() ? pubSnap.data().content : null, DEFAULT_CONTENT);
        const draft = draftSnap.exists() ? normalizeContent(draftSnap.data().content, DEFAULT_CONTENT) : pub;
        lastSaved.current = draft;
        doc_.reset(draft);
      } catch (err) {
        setLoadError(err.message);
      }
    })();
    const unsub = onSnapshot(doc(db, ...PUBLISHED_DOC), (snap) => {
      setPublished(normalizeContent(snap.exists() ? snap.data().content : null, DEFAULT_CONTENT));
    }, () => {});
    return () => { cancelled = true; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- watch for someone else (e.g. Sneha in another browser) saving the draft,
  // so two people editing at once don't silently overwrite each other.
  useEffect(() => {
    if (dryRun) return;
    return onSnapshot(doc(db, ...DRAFT_DOC), (snap) => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;
      const d = snap.data();
      if (!d.updatedBy || d.updatedBy === email || !lastSaved.current) return;
      const theirs = normalizeContent(d.content, DEFAULT_CONTENT);
      if (same(theirs, lastSaved.current)) return;
      setRemote({ by: d.updatedBy, content: theirs });
    }, () => {});
  }, [email, dryRun]);

  const takeTheirs = () => {
    lastSaved.current = remote.content;
    applyChange(remote.content, 'remote');
    setRemote(null);
    setSaveState('saved');
  };
  const keepMine = () => {
    lastSaved.current = remote.content; // forces the next autosave to write ours over theirs
    setRemote(null);
  };

  // ---- autosave draft (debounced). Paused while a conflicting save is unresolved.
  useEffect(() => {
    if (!content || same(content, lastSaved.current) || dryRun || remote) return;
    setSaveState('saving');
    const t = setTimeout(async () => {
      try {
        await setDoc(doc(db, ...DRAFT_DOC), { content: toPlain(content), updatedAt: serverTimestamp(), updatedBy: email });
        lastSaved.current = content;
        setSaveState('saved');
      } catch (err) {
        console.error(err);
        setSaveState('error');
      }
    }, 800);
    return () => clearTimeout(t);
  }, [content, email, dryRun, remote]);

  // Warn before closing with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e) => { if (saveState !== 'saved') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  // ---- editing helpers
  const { change, undo, redo, getPresent } = doc_;
  const setField = useCallback((path, value) => change((cur) => setAt(cur, path, value), path), [change]);
  const applyChange = useCallback((next, key) => change(next, key), [change]);

  // ---- preview iframe messaging
  const post = useCallback((msg) => {
    iframeRef.current?.contentWindow?.postMessage({ source: 'wedding-editor', ...msg }, window.location.origin);
  }, []);
  useEffect(() => { if (frameReady.current && content) post({ type: 'content', content }); }, [content, post]);
  useEffect(() => { if (frameReady.current) post({ type: 'selected', selected }); }, [selected, post]);

  const focusPath = useCallback((base) => {
    setSelected(base);
    post({ type: 'scrollTo', base });
  }, [post]);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || e.data?.source !== 'wedding-preview') return;
      const m = e.data;
      if (m.type === 'ready') {
        frameReady.current = true;
        post({ type: 'content', content: getPresent() });
        post({ type: 'selected', selected });
      }
      if (m.type === 'edit') setField(m.path, m.value);
      if (m.type === 'select') setSelected(m.base);
      if (m.type === 'pickImage') setPicker(m.path);
      if (m.type === 'adjustImage') setAdjusting(m.path);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post, setField, selected, getPresent]);

  // ---- keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== 'z') return;
      const t = e.target;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return; // let fields use native undo
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ---- section operations
  const sections = content?.sections || [];
  const updateSections = (next, key) => applyChange((cur) => ({ ...cur, sections: next }), key);
  const moveSection = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    updateSections(next);
    if (selected === `sections.${i}`) setSelected(`sections.${j}`);
  };
  const addSection = (type) => {
    const idx = selected?.startsWith('sections.') ? Number(selected.split('.')[1]) + 1 : sections.length;
    const next = [...sections];
    next.splice(idx, 0, makeSection(type, sections));
    updateSections(next);
    setTimeout(() => focusPath(`sections.${idx}`), 50);
  };
  const duplicateSection = (i) => {
    const copy = { ...structuredClone(sections[i]), id: newSectionId(sections[i].type, sections) };
    const next = [...sections];
    next.splice(i + 1, 0, copy);
    updateSections(next);
  };
  const deleteSection = (i) => {
    if (!confirm(`Delete the "${sectionLabel(sections[i])}" section? You can undo this.`)) return;
    updateSections(sections.filter((_, k) => k !== i));
    setSelected(null);
  };

  // ---- publish / history
  const hasUnpublished = content && published && !same(content, published);
  const publish = async () => {
    setPublishing(true);
    try {
      const plain = toPlain(content);
      const batch = writeBatch(db);
      batch.set(doc(db, ...PUBLISHED_DOC), { content: plain, publishedAt: serverTimestamp(), publishedBy: email });
      batch.set(doc(db, ...DRAFT_DOC), { content: plain, updatedAt: serverTimestamp(), updatedBy: email });
      batch.set(doc(collection(db, HISTORY_COLLECTION)), { content: plain, publishedAt: serverTimestamp(), publishedBy: email });
      await batch.commit();
      lastSaved.current = content;
      setSaveState('saved');
      setShowPublish(false);
    } catch (err) {
      alert(`Publishing failed: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  };

  if (loadError) {
    return (
      <FullScreen>
        <div className="bg-white rounded-xl shadow p-6 max-w-md text-sm text-[#333036]">
          <p className="font-semibold text-[#7a4d55] mb-2">Couldn't load the site content</p>
          <p className="mb-3">{loadError}</p>
          {/permission/i.test(loadError) && (
            <p className="text-[#333036]/70">The database rules probably haven't been updated yet. In the Firebase console, open Firestore → Rules, paste in the contents of <code>firestore.rules</code> from the project, and click Publish.</p>
          )}
        </div>
      </FullScreen>
    );
  }
  if (!content) return <FullScreen><Loader2 className="w-6 h-6 animate-spin text-[#6c5d84]" /></FullScreen>;

  const selIndex = selected?.startsWith('sections.') ? Number(selected.split('.')[1]) : -1;
  const selSection = selIndex >= 0 ? sections[selIndex] : null;

  // ---------------------------------------------------------------- side panel
  const sidePanel = (
    <div className="flex flex-col h-full min-h-0 bg-[#f7f3ec]">
      {selSection ? (
        <>
          <div className="px-4 py-3 border-b border-[#333036]/10 flex items-center gap-2">
            <button onClick={() => setSelected(null)} className="p-1 -ml-1 rounded hover:bg-[#333036]/5" aria-label="Back to sections"><ArrowLeft className="w-4 h-4" /></button>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#333036] truncate">{sectionLabel(selSection)}</p>
              <p className="text-[11px] text-[#333036]/60">{SECTION_TYPES[selSection.type].label} section</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <p className="text-[11px] text-[#333036]/60 bg-[#6c5d84]/5 rounded-md p-2">Tip: you can also click any text in the preview to edit it there.</p>
            <label className="flex items-center justify-between rounded-md bg-white border border-[#333036]/10 px-3 py-2">
              <span className="text-sm text-[#333036]">Visible on site</span>
              <input type="checkbox" className="accent-[#6c5d84] w-4 h-4" checked={selSection.visible !== false} onChange={(e) => setField(`${selected}.visible`, e.target.checked)} />
            </label>
            <Fields fields={SECTION_TYPES[selSection.type].fields} data={selSection} basePath={selected} onChange={setField} onPickImage={setPicker} onAdjustImage={setAdjusting} />
          </div>
        </>
      ) : selected === 'site' ? (
        <>
          <div className="px-4 py-3 border-b border-[#333036]/10 flex items-center gap-2">
            <button onClick={() => setSelected(null)} className="p-1 -ml-1 rounded hover:bg-[#333036]/5" aria-label="Back"><ArrowLeft className="w-4 h-4" /></button>
            <p className="text-sm font-semibold text-[#333036]">Site settings</p>
          </div>
          <div className="flex border-b border-[#333036]/10 text-sm">
            {[['details', 'Details'], ['theme', 'Colors & fonts']].map(([k, label]) => (
              <button key={k} onClick={() => setSiteTab(k)}
                className={`flex-1 py-2.5 ${siteTab === k ? 'text-[#6c5d84] font-semibold border-b-2 border-[#6c5d84]' : 'text-[#333036]/60 hover:text-[#333036]'}`}>{label}</button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {siteTab === 'details'
              ? <Fields fields={SITE_FIELDS} data={content.site} basePath="site" onChange={setField} onPickImage={setPicker} onAdjustImage={setAdjusting} />
              : <ThemePanel theme={content.theme} onChange={setField} getToken={auth.getToken} />}
          </div>
        </>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-[#333036]/10">
            <p className="text-sm font-semibold text-[#333036]">Page sections</p>
            <p className="text-[11px] text-[#333036]/60">Click a section to edit it. Reorder with the arrows.</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
            {sections.map((s, i) => (
              <div key={s.id} className={`group flex items-center gap-1 rounded-md border bg-white px-2 py-1.5 ${s.visible === false ? 'opacity-60' : ''} border-[#333036]/10 hover:border-[#6c5d84]/40`}>
                <button onClick={() => focusPath(`sections.${i}`)} className="flex-1 min-w-0 text-left px-1 py-1">
                  <span className="block text-sm text-[#333036] truncate">{sectionLabel(s)}</span>
                  <span className="block text-[11px] text-[#333036]/50">{SECTION_TYPES[s.type].label}{s.showInNav ? ' · in menu' : ''}</span>
                </button>
                <IconBtn title={s.visible === false ? 'Show' : 'Hide'} onClick={() => setField(`sections.${i}.visible`, s.visible === false)}>
                  {s.visible === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </IconBtn>
                <IconBtn title="Move up" disabled={i === 0} onClick={() => moveSection(i, -1)}><ChevronUp className="w-4 h-4" /></IconBtn>
                <IconBtn title="Move down" disabled={i === sections.length - 1} onClick={() => moveSection(i, 1)}><ChevronDown className="w-4 h-4" /></IconBtn>
                {!SECTION_TYPES[s.type].unique && <IconBtn title="Duplicate" onClick={() => duplicateSection(i)}><Copy className="w-3.5 h-3.5" /></IconBtn>}
                <IconBtn title="Delete" danger onClick={() => deleteSection(i)}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
              </div>
            ))}
            <AddSectionMenu sections={sections} onAdd={addSection} />
          </div>
          <button onClick={() => setSelected('site')} className="m-3 flex items-center gap-2 rounded-md border border-[#333036]/15 bg-white px-3 py-2.5 text-sm text-[#333036] hover:border-[#6c5d84]/40">
            <Settings2 className="w-4 h-4 text-[#6c5d84]" /> Site settings <span className="text-[11px] text-[#333036]/50 ml-auto">date, colors, fonts</span>
          </button>
        </>
      )}
    </div>
  );

  const preview = (
    <div className="h-full min-h-0 flex flex-col bg-[#d9d2c6]">
      <div className="flex items-center justify-center gap-1 py-2">
        {Object.entries(DEVICES).map(([key, d]) => (
          <button key={key} onClick={() => setDevice(key)} title={d.label}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ${device === key ? 'bg-white text-[#6c5d84] shadow-sm' : 'text-[#333036]/70 hover:bg-white/50'}`}>
            <d.icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{d.label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 flex justify-center px-2 pb-2">
        <iframe
          ref={iframeRef}
          src="/preview-frame"
          title="Website preview"
          className="h-full bg-white rounded-md shadow-xl transition-[width] duration-300 max-w-full"
          style={{ width: DEVICES[device].width }}
        />
      </div>
    </div>
  );

  const assistant = (
    <AssistantPanel
      content={content}
      getContent={getPresent}
      selected={selected}
      applyChange={applyChange}
      undo={doc_.undo}
      getToken={auth.getToken}
      userEmail={email}
      onFocusPath={focusPath}
    />
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-[#ebe4d8] font-sans text-[#333036]">
      {remote && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[250] w-[min(92vw,560px)] rounded-xl border border-[#e9d9a9] bg-[#fff8e6] shadow-xl p-4 text-sm text-[#333036]">
          <p className="font-semibold">{remote.by} just saved changes to the draft.</p>
          <p className="text-[#333036]/75 mt-1">Your edits are paused so nothing gets overwritten. Load their version (your unsaved edits are lost, but Undo can bring them back), or keep yours (their changes are replaced).</p>
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={keepMine} className="rounded-md px-3 py-1.5 border border-[#333036]/20 bg-white hover:bg-[#333036]/5">Keep mine</button>
            <button onClick={takeTheirs} className="rounded-md px-3 py-1.5 bg-[#6c5d84] text-white font-semibold hover:bg-[#524569]">Load their version</button>
          </div>
        </div>
      )}
      {/* top bar */}
      <header className="flex items-center gap-2 px-3 md:px-4 h-14 border-b border-[#333036]/10 bg-white shrink-0">
        <a href="/admin" className="p-1.5 rounded hover:bg-[#333036]/5" title="Back to dashboard"><ArrowLeft className="w-4 h-4" /></a>
        <p className="font-semibold text-sm hidden sm:block">Website Editor</p>
        <SaveBadge state={saveState} unpublished={hasUnpublished} />
        <div className="flex-1" />
        <IconBtn title="Undo (⌘Z)" disabled={!doc_.past.length} onClick={doc_.undo}><Undo2 className="w-4 h-4" /></IconBtn>
        <IconBtn title="Redo (⇧⌘Z)" disabled={!doc_.future.length} onClick={doc_.redo}><Redo2 className="w-4 h-4" /></IconBtn>
        <IconBtn title="Publish history" onClick={() => setShowHistory(true)}><History className="w-4 h-4" /></IconBtn>
        <a href="/" target="_blank" rel="noopener noreferrer" title="Open live site" className="p-1.5 rounded text-[#333036]/70 hover:bg-[#333036]/5"><ExternalLink className="w-4 h-4" /></a>
        <button
          onClick={() => setShowPublish(true)}
          disabled={!hasUnpublished || saveState === 'saving'}
          className="ml-1 flex items-center gap-1.5 rounded-md bg-[#6c5d84] text-white px-3 py-1.5 text-sm font-semibold hover:bg-[#524569] disabled:opacity-40"
        >
          <Upload className="w-4 h-4" /> Publish
        </button>
      </header>

      {/* Each panel is rendered exactly once (there must be only one preview iframe).
          Wide screens: three columns. Phone/tablet: one panel at a time via the bottom tabs. */}
      <div className="flex-1 min-h-0 lg:grid lg:grid-cols-[340px_minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)]">
        <div className={`${mobilePane === 'edit' ? 'h-full' : 'hidden'} lg:block lg:h-full min-h-0 lg:border-r border-[#333036]/10`}>{sidePanel}</div>
        <div className={`${mobilePane === 'preview' ? 'h-full' : 'hidden'} lg:block lg:h-full min-h-0`}>{preview}</div>
        <div className={`${mobilePane === 'ai' ? 'h-full' : 'hidden'} lg:block lg:h-full min-h-0 lg:border-l border-[#333036]/10`}>{assistant}</div>
      </div>
      <nav className="lg:hidden grid grid-cols-3 border-t border-[#333036]/10 bg-white shrink-0">
        {[['edit', PanelLeft, 'Sections'], ['preview', Eye, 'Preview'], ['ai', MessageSquare, 'Ask Claude']].map(([key, Icon, label]) => (
          <button key={key} onClick={() => setMobilePane(key)} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${mobilePane === key ? 'text-[#6c5d84] font-semibold' : 'text-[#333036]/60'}`}>
            <Icon className="w-5 h-5" /> {label}
          </button>
        ))}
      </nav>

      {picker && (
        <ImagePicker
          content={content}
          current={getAt(content, picker)}
          getToken={auth.getToken}
          onSelect={(url) => {
            // A new photo starts centered rather than inheriting the old photo's position.
            if (url !== getAt(content, picker)) setField(`${picker}Pos`, { x: 50, y: 50, zoom: 1 });
            setField(picker, url);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {adjusting && getAt(content, adjusting) && (
        <ImageAdjust
          src={getAt(content, adjusting)}
          pos={getAt(content, `${adjusting}Pos`)}
          onChange={(pos) => setField(`${adjusting}Pos`, pos)}
          onClose={() => setAdjusting(null)}
        />
      )}
      {showPublish && (
        <Modal onClose={() => setShowPublish(false)} title="Publish your changes?">
          <p className="text-sm text-[#333036]/80">Everyone visiting the website will see this version right away. A copy of it is kept in Publish history, so you can go back later.</p>
          <div className="flex gap-2 justify-end mt-6">
            <button onClick={() => setShowPublish(false)} className="rounded-md px-3 py-2 text-sm hover:bg-[#333036]/5">Cancel</button>
            <button onClick={publish} disabled={publishing} className="flex items-center gap-1.5 rounded-md bg-[#6c5d84] text-white px-4 py-2 text-sm font-semibold hover:bg-[#524569] disabled:opacity-50">
              {publishing && <Loader2 className="w-4 h-4 animate-spin" />} Publish now
            </button>
          </div>
        </Modal>
      )}
      {showHistory && (
        <HistoryModal
          onClose={() => setShowHistory(false)}
          onRestore={(c) => { applyChange(normalizeContent(c, DEFAULT_CONTENT), 'restore'); setShowHistory(false); }}
          onDiscard={() => { if (published) { applyChange(published, 'discard'); setShowHistory(false); } }}
          canDiscard={hasUnpublished}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ small pieces
function IconBtn({ children, danger, ...props }) {
  return (
    <button type="button" {...props}
      className={`p-1.5 rounded text-[#333036]/60 disabled:opacity-25 disabled:cursor-not-allowed ${danger ? 'hover:text-[#7a4d55] hover:bg-[#d4a5a5]/20' : 'hover:text-[#6c5d84] hover:bg-[#333036]/5'}`}>
      {children}
    </button>
  );
}

function SaveBadge({ state, unpublished }) {
  const text = state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved — check connection' : unpublished ? 'Draft saved · not published yet' : 'Published';
  const color = state === 'error' ? 'text-[#7a4d55] bg-[#d4a5a5]/25' : unpublished || state === 'saving' ? 'text-[#8a6d1f] bg-[#f3e3b5]/60' : 'text-[#4f7a5a] bg-[#cfe3d3]/60';
  return <span className={`ml-2 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${color}`}>{text}</span>;
}

function AddSectionMenu({ sections, onAdd }) {
  const [open, setOpen] = useState(false);
  const has = new Set(sections.map((s) => s.type));
  return (
    <div className="pt-2">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed border-[#6c5d84]/50 py-2.5 text-sm font-semibold text-[#6c5d84] hover:bg-[#6c5d84]/5">
        <Plus className="w-4 h-4" /> Add a section
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-[#333036]/10 bg-white divide-y divide-[#333036]/5">
          {Object.entries(SECTION_TYPES).map(([type, def]) => {
            const disabled = def.unique && has.has(type);
            return (
              <button key={type} disabled={disabled} onClick={() => { onAdd(type); setOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-[#6c5d84]/5 disabled:opacity-40 disabled:cursor-not-allowed">
                <span className="block text-sm text-[#333036]">{def.label}</span>
                <span className="block text-[11px] text-[#333036]/55">{disabled ? 'Already on the page' : def.description}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-[#333036] mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function HistoryModal({ onClose, onRestore, onDiscard, canDiscard }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    getDocs(query(collection(db, HISTORY_COLLECTION), orderBy('publishedAt', 'desc'), limit(30)))
      .then((snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => setItems([]));
  }, []);
  const fmt = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }), []);
  return (
    <Modal title="Publish history" onClose={onClose}>
      <p className="text-xs text-[#333036]/70 mb-4">Load an older version into the editor. Nothing changes on the live site until you publish again.</p>
      {canDiscard && (
        <button onClick={onDiscard} className="w-full mb-4 rounded-md border border-[#333036]/15 px-3 py-2 text-sm text-left hover:bg-[#333036]/5">
          <span className="font-semibold">Discard unpublished changes</span>
          <span className="block text-xs text-[#333036]/60">Go back to what's live right now (you can undo this).</span>
        </button>
      )}
      {items === null ? <Loader2 className="w-5 h-5 animate-spin text-[#6c5d84]" /> : items.length === 0 ? (
        <p className="text-sm text-[#333036]/60">Nothing published from the editor yet.</p>
      ) : (
        <ul className="divide-y divide-[#333036]/10">
          {items.map((h) => (
            <li key={h.id} className="flex items-center justify-between py-2.5 gap-3">
              <div>
                <p className="text-sm text-[#333036]">{h.publishedAt?.toDate ? fmt.format(h.publishedAt.toDate()) : 'Just now'}</p>
                <p className="text-[11px] text-[#333036]/55">{h.publishedBy}</p>
              </div>
              <button onClick={() => onRestore(h.content)} className="text-xs font-semibold text-[#6c5d84] hover:underline">Load this version</button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
