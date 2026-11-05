// POST /api/rsvp  { name, guestId, memberId, event, answer }  →  { ok: true }
// Saves one Accept/Decline. The searching guest (name + guestId) may answer for anyone
// in their own household, only for events that person is invited to.
import { getDb, loadVerifiedGuest, methodGuard, readJsonBody } from './_lib.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  const { name, guestId, memberId, event, answer } = readJsonBody(req);

  if (answer !== 'yes' && answer !== 'no') return res.status(400).json({ error: 'Invalid answer.' });
  if (typeof event !== 'string' || !event || event.length > 100) return res.status(400).json({ error: 'Invalid event.' });
  if (typeof memberId !== 'string' || !memberId || memberId.includes('/')) return res.status(400).json({ error: 'Invalid guest.' });

  try {
    const searcher = await loadVerifiedGuest(name, guestId);
    if (!searcher) return res.status(403).json({ error: "We couldn't verify your invitation." });

    const ref = getDb().collection('guests').doc(memberId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Guest not found.' });
    const member = snap.data();

    if (member.householdId !== searcher.householdId) return res.status(403).json({ error: 'Not allowed.' });
    if (!(member.events || []).includes(event)) return res.status(400).json({ error: 'Not invited to that event.' });

    // Nested map update (not a dotted path) so event names containing "." are safe.
    await ref.set({ rsvps: { [event]: answer }, rsvpUpdatedAt: new Date() }, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('rsvp failed', err);
    return res.status(500).json({ error: 'Something went wrong saving your response.' });
  }
}
