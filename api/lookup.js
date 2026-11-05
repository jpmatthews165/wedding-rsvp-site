// POST /api/lookup  { name }  →  { matches: [{ guestId, name, household }] }
// Finds guests whose name matches what was typed. Returns only names, never contact info.
import { getDb, nameMatches, isValidFullName, methodGuard, readJsonBody } from './_lib.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  const { name } = readJsonBody(req);

  if (typeof name !== 'string' || name.length > 120 || !isValidFullName(name)) {
    return res.status(400).json({ error: 'Please enter your full first and last name.' });
  }

  try {
    const snap = await getDb().collection('guests').select('name', 'household').get();
    const matches = snap.docs
      .filter((d) => nameMatches(name, d.get('name')))
      .slice(0, 5)
      .map((d) => ({ guestId: d.id, name: d.get('name'), household: d.get('household') || '' }));
    return res.status(200).json({ matches });
  } catch (err) {
    console.error('lookup failed', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
