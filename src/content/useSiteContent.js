import { useEffect, useState } from 'react';
import { DEFAULT_CONTENT } from './defaultContent.js';
import { normalizeContent } from './schema.js';
import { readPublicDoc } from './publicRead.js';

// Firestore locations for site content.
export const PUBLISHED_DOC = ['settings', 'content'];      // what guests see (public read)
export const DRAFT_DOC = ['settings', 'contentDraft'];     // work in progress (admins only)
export const HISTORY_COLLECTION = 'contentHistory';        // one doc per publish (admins only)
export const REQUESTS_COLLECTION = 'editRequests';         // things the AI couldn't do (admins only)

// Published content for the public site. Waits briefly so guests don't see a flash
// of the built-in text, then falls back to the defaults if the read is slow or fails.
export const usePublishedContent = () => {
  const [content, setContent] = useState(null);
  useEffect(() => {
    let done = false;
    const timer = setTimeout(() => { if (!done) setContent((c) => c || DEFAULT_CONTENT); }, 2500);
    readPublicDoc(PUBLISHED_DOC.join('/'))
      .then((data) => setContent(normalizeContent(data?.content ?? null, DEFAULT_CONTENT)))
      .catch((err) => { console.error('Content read failed:', err); setContent((c) => c || DEFAULT_CONTENT); })
      .finally(() => { done = true; clearTimeout(timer); });
    return () => clearTimeout(timer);
  }, []);
  return content;
};
