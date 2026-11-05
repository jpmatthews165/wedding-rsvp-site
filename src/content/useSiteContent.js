import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { DEFAULT_CONTENT } from './defaultContent.js';
import { normalizeContent } from './schema.js';

// Firestore locations for site content.
export const PUBLISHED_DOC = ['settings', 'content'];      // what guests see (public read)
export const DRAFT_DOC = ['settings', 'contentDraft'];     // work in progress (admins only)
export const HISTORY_COLLECTION = 'contentHistory';        // one doc per publish (admins only)
export const REQUESTS_COLLECTION = 'editRequests';         // things the AI couldn't do (admins only)

// Live published content for the public site. Waits briefly for Firestore so guests
// don't see a flash of old text, then falls back to the built-in defaults.
export const usePublishedContent = () => {
  const [content, setContent] = useState(null);
  useEffect(() => {
    const timer = setTimeout(() => setContent((c) => c || DEFAULT_CONTENT), 2500);
    const unsub = onSnapshot(
      doc(db, ...PUBLISHED_DOC),
      (snap) => {
        clearTimeout(timer);
        setContent(normalizeContent(snap.exists() ? snap.data().content : null, DEFAULT_CONTENT));
      },
      (err) => {
        console.error('Content listener error:', err);
        clearTimeout(timer);
        setContent((c) => c || DEFAULT_CONTENT);
      }
    );
    return () => { clearTimeout(timer); unsub(); };
  }, []);
  return content;
};
