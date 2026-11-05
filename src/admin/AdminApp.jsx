import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays, ExternalLink, Home, LayoutDashboard, Loader2, Lock, LogOut, PenLine, Users,
} from 'lucide-react';
import useAdminAuth from './useAdminAuth.js';
import useGuestData from './useGuestData.js';
import { Button, ToastProvider, cx } from './ui.jsx';
import Overview from './pages/Overview.jsx';
import Guests from './pages/Guests.jsx';
import Households from './pages/Households.jsx';
import Events from './pages/Events.jsx';
import { AddHouseholdDialog, GuestDialog, HouseholdDialog } from './dialogs.jsx';

// ---------------------------------------------------------------------------
// ADMIN DASHBOARD (/admin) — overview, guests, households (contacts), events.
// The website editor lives at /admin/editor (see editor/EditorPage.jsx).
// The open page is kept in the URL hash (#guests) so refreshing stays put.
// ---------------------------------------------------------------------------

const PAGES = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'guests', label: 'Guests', icon: Users },
  { key: 'households', label: 'Households', icon: Home },
  { key: 'events', label: 'Events', icon: CalendarDays },
];

const pageFromHash = () => {
  const h = window.location.hash.replace('#', '');
  return PAGES.some((p) => p.key === h) ? h : 'overview';
};

export default function AdminApp() {
  return (
    <ToastProvider>
      <Admin />
    </ToastProvider>
  );
}

function Admin() {
  const auth = useAdminAuth();

  if (!auth.ready) {
    return <div className="min-h-screen bg-[#f6f3ee] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#6c5d84]" /></div>;
  }
  if (!auth.isAdmin) {
    return (
      <div className="min-h-screen bg-[#f6f3ee] flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-2xl border border-[#e8e2d8] shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-11 h-11 rounded-full bg-[#efeaf5] flex items-center justify-center mx-auto mb-4"><Lock className="w-5 h-5 text-[#6c5d84]" /></div>
          <h1 className="text-lg font-semibold text-[#2b2830]">Josh & Sneha · Admin</h1>
          <p className="text-sm text-[#6f6a75] mt-1 mb-6">Sign in with an approved Google account.</p>
          {auth.error && <p className="text-xs text-[#a3401f] bg-[#fbe8e1] rounded-lg p-2.5 mb-4">{auth.error}</p>}
          <Button variant="primary" className="w-full h-10" onClick={auth.signIn}>Sign in with Google</Button>
          <a href="/" className="block text-xs text-[#8b8590] mt-4 hover:underline">Back to the website</a>
        </div>
      </div>
    );
  }
  return <Dashboard auth={auth} />;
}

function Dashboard({ auth }) {
  const data = useGuestData(true);
  const [page, setPage] = useState(pageFromHash);
  const [pageState, setPageState] = useState({});   // e.g. { event } when jumping from Overview
  const [dialog, setDialog] = useState(null);       // { type: 'addHousehold' | 'guest' | 'household', item }

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((key, state = {}) => {
    setPageState(state);
    setPage(key);
    window.history.replaceState(null, '', `#${key}`);
    window.scrollTo({ top: 0 });
  }, []);

  const open = {
    addHousehold: () => setDialog({ type: 'addHousehold' }),
    guest: (g) => setDialog({ type: 'guest', item: g }),
    household: (h) => setDialog({ type: 'household', item: h }),
  };
  const close = () => setDialog(null);

  const counts = { guests: data.guests.length, households: data.households.length, events: data.events.length };

  const nav = (
    <nav className="space-y-0.5">
      {PAGES.map(({ key, label, icon: Icon }) => (
        <button key={key} onClick={() => go(key)}
          className={cx('w-full flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm transition-colors',
            page === key ? 'bg-white text-[#2b2830] font-medium shadow-sm border border-[#e8e2d8]' : 'text-[#5b5661] hover:bg-[#ebe5db]')}>
          <Icon className={cx('w-4 h-4', page === key ? 'text-[#6c5d84]' : 'text-[#8b8590]')} />
          {label}
          {counts[key] != null && <span className="ml-auto text-xs text-[#a39d94] tabular-nums">{counts[key]}</span>}
        </button>
      ))}
    </nav>
  );

  const pageProps = { data, initial: pageState, onAddHousehold: open.addHousehold, onEditGuest: open.guest, onEditHousehold: open.household, go };

  return (
    <div className="min-h-screen bg-[#f6f3ee] font-sans text-[#2b2830]">
      {/* Sidebar (wide screens) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-[#e8e2d8] bg-[#f1ece4] px-3 py-5">
        <div className="px-3 mb-6">
          <p className="text-[15px] font-semibold tracking-tight">Josh & Sneha</p>
          <p className="text-xs text-[#8b8590]">Wedding admin</p>
        </div>
        {nav}
        <div className="mt-6 pt-4 border-t border-[#e2dbcf] space-y-0.5">
          <a href="/admin/editor" className="flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm text-[#5b5661] hover:bg-[#ebe5db]"><PenLine className="w-4 h-4 text-[#8b8590]" /> Edit website</a>
          <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm text-[#5b5661] hover:bg-[#ebe5db]"><ExternalLink className="w-4 h-4 text-[#8b8590]" /> View website</a>
        </div>
        <div className="mt-auto px-3 pt-4 border-t border-[#e2dbcf]">
          <p className="text-xs text-[#6f6a75] truncate" title={auth.user.email}>{auth.user.email}</p>
          <button onClick={auth.signOut} className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[#8b8590] hover:text-[#2b2830]"><LogOut className="w-3.5 h-3.5" /> Sign out</button>
        </div>
      </aside>

      {/* Top bar + tabs (phones/tablets) */}
      <header className="lg:hidden sticky top-0 z-30 bg-[#f1ece4]/95 backdrop-blur border-b border-[#e8e2d8]">
        <div className="flex items-center justify-between px-4 h-12">
          <p className="text-sm font-semibold">Josh & Sneha · Admin</p>
          <div className="flex items-center gap-1">
            <a href="/admin/editor" className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#6c5d84] hover:bg-[#ebe5db]"><PenLine className="w-3.5 h-3.5" /> Edit site</a>
            <button onClick={auth.signOut} aria-label="Sign out" className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#8b8590] hover:bg-[#ebe5db]"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex gap-1 px-2 pb-2 overflow-x-auto">
          {PAGES.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => go(key)}
              className={cx('flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm whitespace-nowrap', page === key ? 'bg-white shadow-sm font-medium' : 'text-[#5b5661]')}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="lg:pl-60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {data.error && <p className="mb-4 text-sm text-[#a3401f] bg-[#fbe8e1] border border-[#efcfc4] rounded-lg p-3">{data.error}</p>}
          {data.loading ? (
            <div className="flex items-center gap-2 text-sm text-[#8b8590] py-20 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading guests…</div>
          ) : (
            <>
              {page === 'overview' && <Overview {...pageProps} />}
              {page === 'guests' && <Guests key={pageState.event || 'all'} {...pageProps} />}
              {page === 'households' && <Households key={pageState.filter || 'all'} {...pageProps} />}
              {page === 'events' && <Events {...pageProps} />}
            </>
          )}
        </div>
      </main>

      {dialog?.type === 'addHousehold' && <AddHouseholdDialog data={data} onClose={close} />}
      {dialog?.type === 'guest' && <GuestDialog guest={dialog.item} data={data} onClose={close} />}
      {dialog?.type === 'household' && (
        <HouseholdDialog household={dialog.item} data={data} onClose={close} onEditGuest={open.guest} />
      )}
    </div>
  );
}
