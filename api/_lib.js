// Shared helpers for the Vercel serverless functions in /api.
// These run on Vercel's servers (never in the guest's browser) and use the
// Firebase Admin SDK, which bypasses Firestore security rules. That is what lets
// us lock the database down completely while still letting guests RSVP.
//
// Required Vercel environment variable:
//   FIREBASE_SERVICE_ACCOUNT  – the full JSON of a Firebase service-account key
//   (Firebase console → Project settings → Service accounts → Generate new private key)
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db;
export const getDb = () => {
  if (db) return db;
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  db = getFirestore();
  return db;
};

export const normalizeName = (s) => (s || '').toString().toLowerCase().trim().replace(/\s+/g, ' ');

export const editDistance = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: a.length + 1 }, (_, j) => j);
  for (let i = 1; i <= b.length; i++) {
    const cur = [i];
    for (let j = 1; j <= a.length; j++) {
      cur[j] = b[i - 1] === a[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], cur[j - 1], prev[j]);
    }
    prev = cur;
  }
  return prev[a.length];
};

// A typed name "matches" a guest if it's exact or within a few typos.
// Scales the tolerance with name length so short names can't match loosely.
export const nameMatches = (typed, guestName) => {
  const a = normalizeName(typed);
  const b = normalizeName(guestName);
  if (!a || !b) return false;
  if (a === b) return true;
  const allowed = Math.min(3, Math.floor(b.length / 5));
  return editDistance(a, b) <= allowed;
};

export const isValidFullName = (typed) => normalizeName(typed).split(' ').length >= 2;

// Loads the searching guest and verifies the typed name really belongs to them.
// Every guest-facing endpoint calls this, so knowing a guest ID alone is not enough.
export const loadVerifiedGuest = async (name, guestId) => {
  if (typeof guestId !== 'string' || !guestId || guestId.includes('/')) return null;
  if (!isValidFullName(name)) return null;
  const snap = await getDb().collection('guests').doc(guestId).get();
  if (!snap.exists) return null;
  const guest = { id: snap.id, ...snap.data() };
  return nameMatches(name, guest.name) ? guest : null;
};

export const loadHouseholdMembers = async (householdId) => {
  const snap = await getDb().collection('guests').where('householdId', '==', householdId).get();
  // Only send what the RSVP form needs — never email, phone or address.
  return snap.docs.map((d) => {
    const g = d.data();
    return { id: d.id, name: g.name, events: g.events || [], rsvps: g.rsvps || {} };
  });
};

export const readJsonBody = (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
};

export const methodGuard = (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  res.setHeader('Cache-Control', 'no-store');
  return true;
};
