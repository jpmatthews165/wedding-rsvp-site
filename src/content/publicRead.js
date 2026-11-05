// Reads a publicly readable Firestore document over the REST API, without the
// Firebase SDK. Only works for documents firestore.rules lets anyone read
// (settings/content, settings/events).
import { firebaseConfig } from '../firebaseConfig.js';

const BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

// Firestore's REST format wraps every value in its type, e.g. { stringValue: "x" }.
const decode = (v) => {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]));
  return null;
};

// Returns the document's fields as plain JSON, or null if it doesn't exist.
export const readPublicDoc = async (path, { timeoutMs = 8000 } = {}) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/${path}?key=${firebaseConfig.apiKey}`, { signal: ctrl.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore read failed (${res.status})`);
    const json = await res.json();
    return decode({ mapValue: { fields: json.fields || {} } });
  } finally {
    clearTimeout(t);
  }
};
