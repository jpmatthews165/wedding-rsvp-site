import { lazy, Suspense } from 'react';
import PublicSite from './site/PublicSite.jsx';

// Admin code (dashboard, editor) is only downloaded when someone visits /admin.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));
const EditorPage = lazy(() => import('./admin/editor/EditorPage.jsx'));
const PreviewFrame = lazy(() => import('./site/PreviewFrame.jsx'));

const Loading = () => <div className="min-h-screen bg-[#e6dbcc]" />;

// Tiny router:
//   /                → the wedding site
//   /admin           → guest & RSVP dashboard
//   /admin/editor    → website editor (+ AI assistant)
//   /preview-frame   → the live preview shown inside the editor
export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  let page = <PublicSite />;
  if (path === '/preview-frame') page = <PreviewFrame />;
  else if (path.startsWith('/admin/editor')) page = <EditorPage />;
  else if (path.startsWith('/admin')) page = <AdminApp />;
  return <Suspense fallback={<Loading />}>{page}</Suspense>;
}
