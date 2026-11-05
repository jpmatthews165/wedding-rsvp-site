// POST /api/lookup  { name }  →  { matches: [{ guestId, name, household }] }
// Finds guests whose name matches what was typed. Returns only names, never contact info.
import { getDb, nameMatches, isValidFullName, methodGuard, readJsonBody } from './_lib.js';

// Each Firestore document read counts against the free quota (50k/day), and a lookup
// needs every guest's name. Keep the name list in memory for a minute so repeated
// searches on a warm server instance don't re-read the whole collection.
const CACHE_MS = 60_000;
let cache = { at: 0, guests: [] };
const loadGuestNames = async () => {
  if (Date.now() - cache.at < CACHE_MS) return cache.guests;
  const snap = await getDb().collection('guests').select('name', 'household').get();
  cache = { at: Date.now(), guests: snap.docs.map((d) => ({ guestId: d.id, name: d.get('name'), household: d.get('household') || '' })) };
  return cache.guests;
};

// Best-effort brake on scripted guessing: 30 searches per 10 minutes per IP, per
// server instance. (Serverless instances don't share memory, so this is a speed
// bump, not a guarantee.)
const WINDOW_MS = 10 * 60_000;
const LIMIT = 30;
const hits = new Map();
const tooMany = (ip) => {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMIT;
};

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return res.status(429).json({ error: 'Too many searches. Please wait a few minutes and try again.' });

  const { name } = readJsonBody(req);
  if (typeof name !== 'string' || name.length > 120 || !isValidFullName(name)) {
    return res.status(400).json({ error: 'Please enter your full first and last name.' });
  }

  try {
    const guests = await loadGuestNames();
    const matches = guests.filter((g) => nameMatches(name, g.name)).slice(0, 5);
    return res.status(200).json({ matches });
  } catch (err) {
    console.error('lookup failed', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
