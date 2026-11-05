// POST /api/household  { name, guestId }  →  { household, members: [{ id, name, events, rsvps }] }
// Returns the RSVP form for the searching guest's household, after re-checking their name.
import { loadVerifiedGuest, loadHouseholdMembers, methodGuard, readJsonBody } from './_lib.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res)) return;
  const { name, guestId } = readJsonBody(req);

  try {
    const guest = await loadVerifiedGuest(name, guestId);
    if (!guest) return res.status(404).json({ error: "We couldn't find your invitation." });

    const members = await loadHouseholdMembers(guest.householdId);
    return res.status(200).json({ household: guest.household || '', members });
  } catch (err) {
    console.error('household failed', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
